from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class PersonalInfo(CamelModel):
    name: str = Field(default="", max_length=100)
    email: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=30)
    location: str = Field(default="", max_length=100)
    linkedin: str = Field(default="", max_length=200)
    portfolio: str = Field(default="", max_length=200)


class Experience(CamelModel):
    company: str = Field(min_length=1, max_length=160)
    role: str = Field(min_length=1, max_length=160)
    start_date: str = Field(default="", max_length=20)
    end_date: str = Field(default="", max_length=20)
    description: str = Field(default="", max_length=2000)
    current: bool = False


class Project(CamelModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1500)
    technologies: list[str] = Field(default_factory=list, max_length=15)
    link: str = Field(default="", max_length=300)


class Education(CamelModel):
    institution: str = Field(min_length=1, max_length=200)
    degree: str = Field(default="", max_length=160)
    field: str = Field(default="", max_length=160)
    start_date: str = Field(default="", max_length=20)
    end_date: str = Field(default="", max_length=20)
    gpa: str = Field(default="", max_length=10)


class Certification(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    issuer: str = Field(default="", max_length=160)
    date: str = Field(default="", max_length=20)


class ResumeData(CamelModel):
    personal: PersonalInfo = Field(default_factory=PersonalInfo)
    summary: str = Field(default="", max_length=2000)
    skills: list[str] = Field(default_factory=list, max_length=50)
    experience: list[Experience] = Field(default_factory=list, max_length=20)
    projects: list[Project] = Field(default_factory=list, max_length=15)
    education: list[Education] = Field(default_factory=list, max_length=10)
    certifications: list[Certification] = Field(default_factory=list, max_length=20)


class ResumeCreate(CamelModel):
    data: ResumeData


class ResumeOut(CamelModel):
    id: int
    data: ResumeData
    created_at: datetime
    updated_at: datetime
