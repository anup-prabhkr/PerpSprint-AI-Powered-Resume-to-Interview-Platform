from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import InterviewSession, User
from app.routers.analyses import get_owned as get_owned_analysis
from app.schemas.interview import AnswerOut, InterviewCreate, InterviewOut, FollowUpOut
from app.services import interview as interview_service
from app.services import llm

router = APIRouter(prefix="/interviews", tags=["interviews"])

MIN_TRANSCRIPT_CHARS = 10


def to_out(row: InterviewSession) -> InterviewOut:
    answers = [
        AnswerOut(question_index=int(i), transcript=a["transcript"], evaluation=a["evaluation"])
        for i, a in sorted((row.answers or {}).items(), key=lambda kv: int(kv[0]))
    ]
    scores = [a.evaluation.score for a in answers]
    return InterviewOut(
        id=row.id,
        analysis_id=row.analysis_id,
        role_title=row.role_title,
        questions=row.questions,
        answers=answers,
        average_score=round(sum(scores) / len(scores)) if scores else None,
        created_at=row.created_at,
    )


def get_owned(db: Session, user: User, interview_id: int) -> InterviewSession:
    row = db.get(InterviewSession, interview_id)
    if not row or row.user_id != user.id:
        raise AppError("Interview not found.", 404)
    return row


@router.post("", response_model=InterviewOut, status_code=201)
def create_interview(
    body: InterviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    analysis = get_owned_analysis(db, user, body.analysis_id) if body.analysis_id else None
    role = analysis.role_title if analysis else (body.role_title or "").strip()
    qs = interview_service.generate_questions(role, body.question_count, analysis)
    row = InterviewSession(
        user_id=user.id,
        analysis_id=analysis.id if analysis else None,
        role_title=role,
        questions=[q.model_dump(mode="json") for q in qs.questions],
        answers={},
    )
    db.add(row)
    db.commit()
    return to_out(row)


@router.get("", response_model=list[InterviewOut])
def list_interviews(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(InterviewSession)
        .where(InterviewSession.user_id == user.id)
        .order_by(InterviewSession.created_at.desc())
    )
    return [to_out(r) for r in rows]


@router.get("/{interview_id}", response_model=InterviewOut)
def get_interview(interview_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return to_out(get_owned(db, user, interview_id))


@router.post("/{interview_id}/answers", response_model=AnswerOut)
def submit_answer(
    interview_id: int,
    question_index: int = Form(..., ge=0),
    audio: UploadFile | None = File(None),
    transcript: str = Form("", max_length=6000),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Accepts a recorded answer (transcribed with Whisper) or typed text as a fallback."""
    row = get_owned(db, user, interview_id)
    if question_index >= len(row.questions):
        raise AppError("That question does not exist.", 404)

    text = transcript.strip()
    if audio is not None:
        limit = get_settings().max_audio_bytes
        data = audio.file.read(limit + 1)
        if len(data) > limit:
            raise AppError("That recording is too large. Please keep answers under a few minutes.", 413)
        if not data:
            raise AppError("The recording was empty. Please try again.", 422)
        text = llm.transcribe(audio.filename or "answer.webm", data)
    if len(text) < MIN_TRANSCRIPT_CHARS:
        raise AppError("We couldn't hear a clear answer. Please try recording again.", 422)

    evaluation = interview_service.evaluate_answer(row, question_index, text)
    row.answers = {
        **(row.answers or {}),
        str(question_index): {"transcript": text, "evaluation": evaluation.model_dump(mode="json")},
    }
    db.commit()
    return AnswerOut(question_index=question_index, transcript=text, evaluation=evaluation)


@router.post("/{interview_id}/follow-up", response_model=FollowUpOut)
def get_follow_up(
    interview_id: int,
    question_index: int = Form(..., ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = get_owned(db, user, interview_id)
    if question_index >= len(row.questions):
        raise AppError("That question does not exist.", 404)
    answers = row.answers or {}
    answer_data = answers.get(str(question_index))
    if not answer_data:
        raise AppError("Answer that question first before requesting a follow-up.", 422)
    follow_up = interview_service.generate_follow_up(
        row, question_index, answer_data["transcript"], answer_data["evaluation"]["score"]
    )
    return FollowUpOut(follow_up=follow_up)
