from datetime import datetime
from urllib.parse import quote_plus

from pydantic import Field, model_validator

from app.schemas.common import CamelModel


YT_SEARCH = "https://www.youtube.com/results?search_query="
YT_PLAYLIST_FILTER = "&sp=EgIQAw%253D%253D"


class Link(CamelModel):
    title: str = ""
    url: str = ""
    channel: str = ""
    description: str = ""


class Problem(CamelModel):
    title: str = ""
    url: str = ""
    difficulty: str = ""
    topic: str = ""


class Resource(CamelModel):
    """A YouTube search the candidate can open. Links are built here, never taken from the model."""

    topic: str = Field(min_length=1, max_length=120)
    query: str = Field(min_length=1, max_length=120)
    video_url: str = ""
    playlist_url: str = ""
    videos: list[Link] = Field(default_factory=list, max_length=3)
    playlist: Link | None = None
    gfg_slugs: list[str] = Field(default_factory=list, max_length=4)
    articles: list[Link] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def _build_links(self):
        q = quote_plus(self.query.strip())
        self.video_url = YT_SEARCH + q
        self.playlist_url = YT_SEARCH + q + YT_PLAYLIST_FILTER
        return self


class RoadmapDay(CamelModel):
    day: int = Field(ge=1, le=7)
    title: str = Field(min_length=1, max_length=120)
    focus: str = Field(min_length=1, max_length=300)
    hours: float = Field(ge=0.5, le=8)
    tasks: list[str] = Field(min_length=2, max_length=6)
    closes: str = Field(default="", max_length=120)
    resources: list[Resource] = Field(default_factory=list, max_length=3)
    dsa_topics: list[str] = Field(default_factory=list, max_length=3)
    practice: list[Problem] = Field(default_factory=list, max_length=6)


class RoadmapContent(CamelModel):
    summary: str = Field(min_length=1, max_length=600)
    days: list[RoadmapDay] = Field(min_length=7, max_length=7)

    @model_validator(mode="after")
    def _days_in_order(self):
        if [d.day for d in self.days] != list(range(1, 8)):
            raise ValueError("days must be numbered 1 to 7 in order")
        return self


class RoadmapCreate(CamelModel):
    analysis_id: int
    interview_id: int | None = None


class ProgressUpdate(CamelModel):
    done: list[str] = Field(default_factory=list)  # list of task IDs like ["1-0", "1-1", "2-0"]


class RoadmapOut(RoadmapContent):
    id: int
    analysis_id: int
    interview_id: int | None
    created_at: datetime
    progress: dict = Field(default_factory=dict)
