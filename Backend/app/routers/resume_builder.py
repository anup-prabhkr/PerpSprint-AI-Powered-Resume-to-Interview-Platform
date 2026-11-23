import logging

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Resume, User
from app.schemas.resume_builder import ResumeCreate, ResumeData, ResumeOut
from app.services import resume_builder as resume_builder_service
from app.services.resume_parser import extract_resume_text

router = APIRouter(prefix="/resumes", tags=["resumes"])
logger = logging.getLogger(__name__)


def _to_out(row: Resume) -> ResumeOut:
    return ResumeOut(
        id=row.id,
        data=ResumeData.model_validate(row.data),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _get_owned(db: Session, user: User, resume_id: int) -> Resume:
    row = db.get(Resume, resume_id)
    if not row or row.user_id != user.id:
        raise AppError("Resume not found.", 404)
    return row


@router.post("/parse", response_model=ResumeData)
def parse_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    limit = get_settings().max_resume_bytes
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise AppError("That file is over 5 MB. Please upload a smaller version.", 413)

    text = extract_resume_text(file.filename or "", data)
    return resume_builder_service.parse(text)


@router.post("", response_model=ResumeOut, status_code=201)
def create_resume(
    body: ResumeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = Resume(
        user_id=user.id,
        data=body.data.model_dump(mode="json"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.get("", response_model=list[ResumeOut])
def list_resumes(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(Resume).where(Resume.user_id == user.id).order_by(Resume.created_at.desc())
    )
    return [_to_out(r) for r in rows]


@router.get("/{resume_id}", response_model=ResumeOut)
def get_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _to_out(_get_owned(db, user, resume_id))


@router.put("/{resume_id}", response_model=ResumeOut)
def update_resume(
    resume_id: int,
    body: ResumeCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_owned(db, user, resume_id)
    row.data = body.data.model_dump(mode="json")
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = _get_owned(db, user, resume_id)
    db.delete(row)
    db.commit()


@router.get("/{resume_id}/export")
def export_resume(
    resume_id: int,
    template: str = Query("professional", pattern="^(professional|minimal)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_owned(db, user, resume_id)
    data = ResumeData.model_validate(row.data)
    try:
        pdf_bytes = resume_builder_service.export_pdf(data, template)
    except Exception as exc:  # noqa: BLE001 - reported to the user as a 500
        # An unhandled error here is answered by Starlette's outermost error
        # middleware, whose response carries no CORS headers; the browser then
        # reports a network failure instead of the real problem.
        logger.exception("PDF export failed for resume %s", resume_id)
        raise AppError(
            "The PDF could not be generated for this resume. Please try again.", 500
        ) from exc

    filename = f"resume_{resume_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
