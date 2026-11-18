from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import CamelModel


class Question(CamelModel):
    question: str = Field(min_length=5, max_length=400)
    category: Literal["technical", "behavioral", "situational"]
    focus: str = Field(min_length=1, max_length=120)


class QuestionSet(CamelModel):
    questions: list[Question] = Field(min_length=3, max_length=10)


class DimensionScores(CamelModel):
    communication: int = Field(ge=0, le=100)
    technical_depth: int = Field(ge=0, le=100)
    problem_solving: int = Field(ge=0, le=100)
    confidence: int = Field(ge=0, le=100)


class AnswerEvaluation(CamelModel):
    score: int = Field(ge=0, le=100)
    dimensions: DimensionScores = Field(
        default_factory=lambda: DimensionScores(
            communication=0, technical_depth=0, problem_solving=0, confidence=0
        )
    )
    feedback: str = Field(min_length=1, max_length=800)
    strengths: list[str] = Field(default_factory=list, max_length=5)
    improvements: list[str] = Field(default_factory=list, max_length=5)


class FollowUpQuestion(CamelModel):
    question: str = Field(min_length=5, max_length=400)
    focus: str = Field(min_length=1, max_length=120)


class FollowUpOut(CamelModel):
    follow_up: FollowUpQuestion


class InterviewCreate(CamelModel):
    analysis_id: int | None = None
    role_title: str | None = Field(default=None, max_length=160)
    question_count: int = Field(default=5, ge=3, le=8)

    @model_validator(mode="after")
    def _needs_target(self):
        if self.analysis_id is None and not (self.role_title or "").strip():
            raise ValueError("Provide an analysis or a role title")
        return self


class AnswerOut(CamelModel):
    question_index: int
    transcript: str
    evaluation: AnswerEvaluation


class InterviewOut(CamelModel):
    id: int
    analysis_id: int | None
    role_title: str
    questions: list[Question]
    answers: list[AnswerOut]
    average_score: int | None
    created_at: datetime
