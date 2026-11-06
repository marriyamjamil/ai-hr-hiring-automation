from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# What HR sends when creating a job
class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200, examples=["Python Developer"])
    department: str | None = Field(default=None, examples=["Engineering"])
    location: str | None = Field(default=None, examples=["Lahore (Hybrid)"])
    experience: str | None = Field(default=None, examples=["2-4 years"])
    required_skills: list[str] = Field(default_factory=list, examples=[["Python", "SQL", "REST APIs"]])
    preferred_skills: list[str] = Field(default_factory=list, examples=[["Docker", "AWS"]])
    jd_text: str | None = Field(default=None, examples=["We are looking for a Python Developer..."])


# What HR sends when updating a job (every field is optional)
class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    department: str | None = None
    location: str | None = None
    experience: str | None = None
    required_skills: list[str] | None = None
    preferred_skills: list[str] | None = None
    jd_text: str | None = None
    status: str | None = Field(default=None, examples=["draft"])


# What the API sends back
class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # allows reading data from a database object

    id: int
    title: str
    department: str | None
    location: str | None
    experience: str | None
    required_skills: list[str]
    preferred_skills: list[str]
    jd_text: str | None
    rubric: dict
    screening_questions: list
    status: str
    created_at: datetime