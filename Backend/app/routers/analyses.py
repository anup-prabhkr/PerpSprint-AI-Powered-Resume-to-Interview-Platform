from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Analysis, ResumeReview, User
from app.schemas.analysis import AnalysisContent, AnalysisOut
from app.services import analysis as analysis_service
from app.services.resume_parser import extract_resume_text

router = APIRouter(prefix="/analyses", tags=["analyses"])

MIN_JD_CHARS = 50


def resume_path(analysis_id: int) -> Path:
    return Path(get_settings().upload_dir) / f"{analysis_id}.pdf"


def to_out(row: Analysis) -> AnalysisOut:
    content = AnalysisContent.model_validate(row.result)
    return AnalysisOut(
        **content.model_dump(),
        id=row.id,
        role_title=row.role_title,
        company=row.company,
        job_description=row.job_description,
        resume_file_name=row.resume_file_name,
        created_at=row.created_at,
    )


def get_owned(db: Session, user: User, analysis_id: int) -> Analysis:
    row = db.get(Analysis, analysis_id)
    if not row or row.user_id != user.id:
        raise AppError("Analysis not found.", 404)
    return row


@router.post("", response_model=AnalysisOut, status_code=201)
def create_analysis(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
    role_title: str = Form(..., max_length=160),
    company: str = Form("", max_length=160),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    job_description, role_title, company = job_description.strip(), role_title.strip(), company.strip()
    if not role_title:
        raise AppError("Role title is required.", 422)
    if len(job_description) < MIN_JD_CHARS:
        raise AppError("Please paste the full job description (at least a few sentences).", 422)

    limit = get_settings().max_resume_bytes
    data = resume.file.read(limit + 1)
    if len(data) > limit:
        raise AppError("That file is over 5 MB. Please upload a smaller version.", 413)

    text = extract_resume_text(resume.filename or "", data)
    content = analysis_service.analyze(text, job_description, role_title, company or None)

    row = Analysis(
        user_id=user.id,
        role_title=role_title,
        company=company or None,
        job_description=job_description,
        resume_file_name=(resume.filename or "resume")[:255],
        resume_text=text,
        overall_score=content.overall_score,
        match_percent=content.match_percent,
        result=content.model_dump(mode="json"),
    )
    db.add(row)
    db.commit()
    if (resume.filename or "").lower().endswith(".pdf"):  # kept so the review page can show the original
        path = resume_path(row.id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return to_out(row)


@router.get("", response_model=list[AnalysisOut])
def list_analyses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at.desc())
    )
    return [to_out(r) for r in rows]


@router.get("/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return to_out(get_owned(db, user, analysis_id))


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = get_owned(db, user, analysis_id)
    for review in db.scalars(select(ResumeReview).where(ResumeReview.analysis_id == row.id)):
        db.delete(review)
    db.delete(row)
    db.commit()
    resume_path(analysis_id).unlink(missing_ok=True)
