from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class MCQOption(CamelModel):
    text: str = Field(min_length=1, max_length=300)


class MCQuestion(CamelModel):
    question: str = Field(min_length=5, max_length=500)
    options: list[MCQOption] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    topic: str = Field(min_length=1, max_length=100)
    difficulty: Literal["easy", "medium", "hard"]
    explanation: str = Field(min_length=1, max_length=500)


class MockTestContent(CamelModel):
    questions: list[MCQuestion] = Field(min_length=10, max_length=15)


class MockTestCreate(CamelModel):
    analysis_id: int


class MockTestSubmit(CamelModel):
    answers: dict[str, int]  # {"0": 2, "1": 0, ...} question_index -> selected_option_index


class QuestionResult(CamelModel):
    question_index: int
    selected: int
    correct: int
    is_correct: bool
    topic: str


class WeakTopic(CamelModel):
    topic: str
    correct: int
    total: int


class MockTestResult(CamelModel):
    score: int
    total: int
    percentage: int
    results: list[QuestionResult]
    weak_topics: list[WeakTopic]


class MockTestOut(CamelModel):
    id: int
    analysis_id: int
    role_title: str
    questions: list[MCQuestion]
    result: MockTestResult | None
    created_at: datetime
