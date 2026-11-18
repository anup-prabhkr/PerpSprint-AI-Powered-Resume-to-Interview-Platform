from datetime import datetime
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.common import CamelModel

Score = Field(ge=0, le=100)


class ScoreBreakdown(CamelModel):
    technical_skills: int = Score
    experience_relevance: int = Score
    keyword_coverage: int = Score
    project_relevance: int = Score
    readability: int = Score


class Requirement(CamelModel):
    id: str = ""
    requirement: str = Field(min_length=1, max_length=200)
    status: Literal["strong", "partial", "missing"]
    evidence: str | None = Field(default=None, max_length=400)

    @model_validator(mode="after")
    def _evidence_matches_status(self):
        if self.status == "missing":
            self.evidence = None
        elif not (self.evidence or "").strip():
            self.status, self.evidence = "missing", None
        return self


class Suggestion(CamelModel):
    id: str = ""
    priority: Literal["critical", "recommended", "optional"]
    title: str = Field(min_length=1, max_length=200)
    gap: str = Field(min_length=1, max_length=600)
    why: str = Field(min_length=1, max_length=600)
    how_to_improve: str = Field(min_length=1, max_length=800)


class AnalysisContent(CamelModel):
    """Shape the model must return; validated before anything is stored."""

    overall_score: int = Score
    match_percent: int = Score
    breakdown: ScoreBreakdown
    requirements: list[Requirement] = Field(min_length=1, max_length=15)
    suggestions: list[Suggestion] = Field(min_length=1, max_length=8)
    takeaways: list[str] = Field(min_length=1, max_length=5)
    matched_skills: list[str] = Field(default_factory=list, max_length=40)
    missing_skills: list[str] = Field(default_factory=list, max_length=40)


class AnalysisOut(AnalysisContent):
    id: int
    role_title: str
    company: str | None
    job_description: str
    resume_file_name: str
    created_at: datetime
