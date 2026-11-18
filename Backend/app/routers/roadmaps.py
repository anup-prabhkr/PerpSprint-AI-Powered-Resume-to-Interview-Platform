from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import InterviewSession, Roadmap, User
from app.routers.analyses import get_owned as get_owned_analysis
from app.routers.interviews import get_owned as get_owned_interview
from app.errors import AppError
from app.schemas.roadmap import ProgressUpdate, RoadmapContent, RoadmapCreate, RoadmapOut
from app.services import roadmap as roadmap_service

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


def to_out(row: Roadmap) -> RoadmapOut:
    return RoadmapOut(
        **RoadmapContent.model_validate(row.content).model_dump(),
        id=row.id,
        analysis_id=row.analysis_id,
        interview_id=row.interview_id,
        created_at=row.created_at,
        progress=row.progress or {},
    )


@router.post("", response_model=RoadmapOut, status_code=201)
def create_roadmap(body: RoadmapCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    analysis = get_owned_analysis(db, user, body.analysis_id)
    if body.interview_id:
        interview = get_owned_interview(db, user, body.interview_id)
    else:
        # Default to the most recent interview for this analysis that has answers.
        candidates = db.scalars(
            select(InterviewSession)
            .where(InterviewSession.user_id == user.id, InterviewSession.analysis_id == analysis.id)
            .order_by(InterviewSession.created_at.desc())
        )
        interview = next((i for i in candidates if i.answers), None)

    content = roadmap_service.generate(analysis, interview)
    row = Roadmap(
        user_id=user.id,
        analysis_id=analysis.id,
        interview_id=interview.id if interview else None,
        content=content.model_dump(mode="json"),
    )
    db.add(row)
    db.commit()
    return to_out(row)


@router.patch("/{roadmap_id}/progress", response_model=RoadmapOut)
def update_progress(
    roadmap_id: int,
    body: ProgressUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = db.get(Roadmap, roadmap_id)
    if not row or row.user_id != user.id:
        raise AppError("Roadmap not found.", 404)
    row.progress = {"done": body.done}
    db.commit()
    return to_out(row)


@router.get("", response_model=list[RoadmapOut])
def list_roadmaps(
    analysis_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    query = select(Roadmap).where(Roadmap.user_id == user.id).order_by(Roadmap.created_at.desc())
    if analysis_id is not None:
        query = query.where(Roadmap.analysis_id == analysis_id)
    return [to_out(r) for r in db.scalars(query)]


@router.get("/{roadmap_id}", response_model=RoadmapOut)
def get_roadmap(roadmap_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = db.get(Roadmap, roadmap_id)
    if not row or row.user_id != user.id:
        raise AppError("Roadmap not found.", 404)
    return to_out(row)
