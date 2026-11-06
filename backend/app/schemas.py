from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

EmploymentType = Literal["Full-time", "Part-time", "Contract", "Internship", "Temporary"]
WorkArrangement = Literal["On-site", "Hybrid", "Remote"]
Tone = Literal["Professional", "Friendly", "Startup"]


# ---------- Jobs and JD generation (Agent 0) ----------

# What HR sends to Agent 0 to generate a job description
class JDGenerateRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "title": "Python Developer",
                    "company_name": "ABC Tech",
                    "about_company": "ABC Tech is a Lahore-based software company building "
                    "AI-powered HR tools that help businesses hire faster and more fairly.",
                    "employment_type": "Full-time",
                    "location": "Lahore",
                    "work_arrangement": "Hybrid",
                    "experience": "2-4 years",
                    "required_skills": ["Python", "SQL", "REST APIs"],
                    "key_responsibilities": [
                        "Build and maintain REST APIs for our hiring platform",
                        "Design database tables and write efficient SQL queries",
                        "Write unit tests and fix bugs",
                    ],
                    "department": "Engineering",
                    "reports_to": "Engineering Lead",
                    "preferred_skills": ["Docker", "AWS"],
                    "education": "Bachelor's degree in Computer Science or a related field",
                    "salary_range": "PKR 150,000 - 250,000 per month",
                    "benefits": ["Health insurance", "Flexible working hours", "Learning budget"],
                    "application_deadline": "2026-11-30",
                    "how_to_apply": "Apply through careers.abctech.example with your CV",
                    "extra_notes": "Small team; mentoring available for growth.",
                    "tone": "Professional",
                }
            ]
        }
    )

    # Required: HR must fill these in
    title: str = Field(min_length=2, max_length=200)
    company_name: str = Field(min_length=2, max_length=200)
    about_company: str = Field(min_length=20, max_length=1500)
    employment_type: EmploymentType
    location: str = Field(min_length=2, max_length=100)
    work_arrangement: WorkArrangement
    experience: str = Field(min_length=1, max_length=50)
    required_skills: list[str] = Field(min_length=1)
    key_responsibilities: list[str] = Field(min_length=1)

    # Optional: only used if HR fills them in
    department: str | None = None
    reports_to: str | None = None
    preferred_skills: list[str] = Field(default_factory=list)
    education: str | None = None
    salary_range: str | None = None
    benefits: list[str] = Field(default_factory=list)
    application_deadline: date | None = None
    how_to_apply: str | None = None
    extra_notes: str | None = None
    tone: Tone = "Professional"


# What Agent 0 sends back (a draft for HR to review, not saved yet)
class JDGenerateResponse(BaseModel):
    jd_text: str
    rubric: dict[str, int]
    screening_questions: list[str]


# What HR sends when creating a job
class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200, examples=["Python Developer"])
    department: str | None = Field(default=None, examples=["Engineering"])
    location: str | None = Field(default=None, examples=["Lahore (Hybrid)"])
    experience: str | None = Field(default=None, examples=["2-4 years"])
    required_skills: list[str] = Field(default_factory=list, examples=[["Python", "SQL", "REST APIs"]])
    preferred_skills: list[str] = Field(default_factory=list, examples=[["Docker", "AWS"]])
    jd_text: str | None = Field(default=None, examples=["# Python Developer\n..."])
    rubric: dict[str, int] = Field(default_factory=dict)
    screening_questions: list[str] = Field(default_factory=list)


# What HR sends when updating a job (every field is optional)
class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    department: str | None = None
    location: str | None = None
    experience: str | None = None
    required_skills: list[str] | None = None
    preferred_skills: list[str] | None = None
    jd_text: str | None = None
    rubric: dict[str, int] | None = None
    screening_questions: list[str] | None = None
    status: str | None = Field(default=None, examples=["draft"])


# What the API sends back for a job
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


# ---------- Candidates and resume scoring (Agent 1) ----------

# The AI's marks for one resume
class EvaluationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    overall_score: int
    criterion_scores: dict
    evidence: list
    missing_or_unclear: list
    warnings: list
    summary: str | None
    model_version: str | None
    created_at: datetime


# One row in the ranked candidate list
class CandidateSummary(BaseModel):
    id: int
    name: str
    email: str | None
    status: str
    overall_score: int | None
    summary: str | None


# Full details of one candidate
class CandidateDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    name: str
    email: str | None
    phone: str | None
    status: str
    created_at: datetime
    evaluation: EvaluationOut | None


# What happened to each uploaded file
class UploadResult(BaseModel):
    file_name: str
    status: str  # scored / needs_manual_review / rejected
    candidate_id: int | None = None
    overall_score: int | None = None
    detail: str | None = None


# The reply after uploading resumes
class UploadSummary(BaseModel):
    job_id: int
    total_files: int
    results: list[UploadResult]