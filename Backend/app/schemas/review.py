from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class LLMHighlight(CamelModel):
    kind: Literal["strength", "weakness"]
    quote: str = Field(min_length=3, max_length=300)
    comment: str = Field(min_length=1, max_length=400)
    suggestion: str | None = Field(default=None, max_length=500)


class ReviewContent(CamelModel):
    """Shape the model must return."""

    highlights: list[LLMHighlight] = Field(min_length=2, max_length=24)


class Rect(CamelModel):
    page: int  # 1-based
    x: float  # all values are fractions of the page size
    y: float
    w: float
    h: float


class Highlight(CamelModel):
    id: str
    kind: Literal["strength", "weakness"]
    quote: str
    comment: str
    suggestion: str | None = None
    start: int  # character span inside the extracted resume text
    end: int
    rects: list[Rect] = Field(default_factory=list)


class ReviewOut(CamelModel):
    analysis_id: int
    mode: Literal["pdf", "text"]
    page_count: int = 0
    resume_text: str | None = None
    highlights: list[Highlight]
