from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Analysis, MockTest, User
from app.schemas.analysis import AnalysisContent
from app.schemas.mock_test import MCQuestion, MockTestCreate, MockTestOut, MockTestResult, MockTestSubmit
from app.services import mock_test as mock_test_service

router = APIRouter(prefix="/mock-tests", tags=["mock-tests"])


def _to_out(row: MockTest) -> MockTestOut:
    questions = [MCQuestion.model_validate(q) for q in row.questions]
    result = MockTestResult.model_validate(row.result) if row.result else None
    return MockTestOut(
        id=row.id,
        analysis_id=row.analysis_id,
        role_title=row.role_title,
        questions=questions,
        result=result,
        created_at=row.created_at,
    )


def _get_owned(db: Session, user: User, mock_test_id: int) -> MockTest:
    row = db.get(MockTest, mock_test_id)
    if not row or row.user_id != user.id:
        raise AppError("Mock test not found.", 404)
    return row


@router.post("", response_model=MockTestOut, status_code=201)
def create_mock_test(
    body: MockTestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Verify analysis ownership
    analysis = db.get(Analysis, body.analysis_id)
    if not analysis or analysis.user_id != user.id:
        raise AppError("Analysis not found.", 404)

    # Extract skills from the analysis result
    content = AnalysisContent.model_validate(analysis.result)
    matched_skills = content.matched_skills
    missing_skills = content.missing_skills

    # Generate MCQs via LLM
    test_content = mock_test_service.generate(matched_skills, missing_skills, analysis.role_title)

    row = MockTest(
        user_id=user.id,
        analysis_id=analysis.id,
        role_title=analysis.role_title,
        questions=[q.model_dump(mode="json") for q in test_content.questions],
        result=None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


@router.get("", response_model=list[MockTestOut])
def list_mock_tests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(
        select(MockTest).where(MockTest.user_id == user.id).order_by(MockTest.created_at.desc())
    )
    return [_to_out(r) for r in rows]


@router.get("/{mock_test_id}", response_model=MockTestOut)
def get_mock_test(mock_test_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _to_out(_get_owned(db, user, mock_test_id))


@router.post("/{mock_test_id}/submit", response_model=MockTestOut)
def submit_mock_test(
    mock_test_id: int,
    body: MockTestSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = _get_owned(db, user, mock_test_id)

    if row.result is not None:
        raise AppError("This test has already been submitted.", 400)

    questions = [MCQuestion.model_validate(q) for q in row.questions]
    result = mock_test_service.score(questions, body.answers)

    row.result = result.model_dump(mode="json")
    db.commit()
    db.refresh(row)
    return _to_out(row)
