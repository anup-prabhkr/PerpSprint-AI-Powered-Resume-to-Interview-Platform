from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

import pymupdf

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import ResumeReview, User
from app.routers.analyses import get_owned, resume_path
from app.schemas.review import ReviewOut
from app.services import review as review_service

router = APIRouter(prefix="/analyses", tags=["review"])


def _to_out(analysis_id: int, content: dict, resume_text: str) -> ReviewOut:
    return ReviewOut(
        analysis_id=analysis_id,
        mode=content["mode"],
        page_count=content["page_count"],
        resume_text=resume_text if content["mode"] == "text" else None,
        highlights=content["highlights"],
    )


@router.post("/{analysis_id}/review", response_model=ReviewOut)
def review_resume(
    analysis_id: int,
    regenerate: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Line-by-line markup of the resume. Generated once, then cached."""
    analysis = get_owned(db, user, analysis_id)
    row = db.scalar(select(ResumeReview).where(ResumeReview.analysis_id == analysis.id))
    if row and not regenerate:
        return _to_out(analysis.id, row.content, analysis.resume_text)

    content = review_service.generate(analysis, resume_path(analysis.id))
    if row:
        row.content = content
    else:
        db.add(ResumeReview(analysis_id=analysis.id, content=content))
    db.commit()
    return _to_out(analysis.id, content, analysis.resume_text)


@router.get("/{analysis_id}/resume/pages/{page}")
def resume_page(analysis_id: int, page: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_owned(db, user, analysis_id)
    path = resume_path(analysis_id)
    if not path.exists():
        raise AppError("The original resume file is not available.", 404)
    with pymupdf.open(path) as doc:
        if not 1 <= page <= doc.page_count:
            raise AppError("Page not found.", 404)
        png = doc[page - 1].get_pixmap(dpi=140).tobytes("png")
    return Response(png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})
