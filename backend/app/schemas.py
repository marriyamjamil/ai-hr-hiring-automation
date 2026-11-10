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
    about_company: str | None = Field(default=None, max_length=1500)  # optional
    employment_type: EmploymentType
    location: str = Field(min_length=2, max_length=100)
    work_arrangement: WorkArrangement
    experience: str = Field(min_length=1, max_length=50)
    required_skills: list[str] = Field(min_length=1)
    key_responsibilities: list[str] = Field(default_factory=list)  # optional: AI writes them if empty

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
    # HR's own values with spelling corrected, so the job is saved correctly
    title: str
    required_skills: list[str]
    preferred_skills: list[str]


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


# One row on the "all candidates" page (includes which job they applied for)
class CandidateListItem(BaseModel):
    id: int
    name: str
    email: str | None
    status: str
    overall_score: int | None
    job_id: int
    job_title: str
    created_at: datetime


# ---------- HR decisions (shortlist / reject), the human approval gate ----------

# One row of a candidate's decision history
class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: str
    to_status: str
    reason: str | None
    decided_by_name: str | None
    created_at: datetime


# What HR sends to decide about ONE candidate
class DecisionIn(BaseModel):
    decision: Literal["shortlisted", "rejected", "undo", "interview_invited"] = Field(examples=["rejected"])
    reason: str | None = Field(default=None, max_length=500, examples=["Less than 1 year of Python experience"])


# What HR sends to approve the suggested shortlist (many candidates in one click)
class ShortlistIn(BaseModel):
    candidate_ids: list[int] = Field(min_length=1, examples=[[1, 2, 3]])
    note: str | None = Field(default=None, max_length=500)


# The reply after approving a shortlist
class ShortlistResult(BaseModel):
    job_id: int
    shortlisted: int  # how many were shortlisted
    skipped: list[str]  # why some were not (e.g. "Ali: already rejected")


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
    decisions: list[DecisionOut] = []  # HR's decision history, oldest first


# What happened to each uploaded file
class UploadResult(BaseModel):
    file_name: str
    status: str  # scored / updated / duplicate / blocked / needs_manual_review / rejected
    candidate_id: int | None = None
    overall_score: int | None = None
    detail: str | None = None


# The reply after uploading resumes
class UploadSummary(BaseModel):
    job_id: int
    total_files: int
    results: list[UploadResult]


# ---------- Users and login ----------

UserRole = Literal["admin", "hr", "manager"]


# What the login endpoint sends back
class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


# A user as the API shows it (never includes the password)
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    created_at: datetime


# What an admin sends to create a new account
class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100, examples=["Sara Khan"])
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=255, examples=["sara@abctech.example"])
    password: str = Field(min_length=8, max_length=72)
    role: UserRole = "hr"


# ---------- Screening calls (Agent 2) ----------

# One message in the call
class ScreeningMessage(BaseModel):
    role: Literal["agent", "candidate"]
    text: str


# A screening call as the API shows it
class ScreeningCallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    job_id: int
    mode: str  # text / voice
    status: str  # in_progress / completed / cancelled
    consent_given: bool
    transcript: list[ScreeningMessage]
    question_index: int
    report: dict | None  # filled in when the call is completed
    overall_score: int | None
    model_version: str | None
    started_at: datetime
    ended_at: datetime | None


# ---------- Candidate interview page (Agent 2, Stage 2.2: no login, the token is the key) ----------

# What the candidate's page shows before the call (no scores, no private data)
class InterviewInfo(BaseModel):
    candidate_name: str
    job_title: str
    question_count: int
    status: str  # pending / used / cancelled / expired
    expires_at: datetime


# Sent back when the candidate presses "Start": the voice agent's settings for Vapi
class InterviewStartOut(BaseModel):
    screening_call_id: int
    assistant: dict


# The browser tells us Vapi's id for this call (letters, digits and dashes only)
class InterviewConnectedIn(BaseModel):
    vapi_call_id: str = Field(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9-]+$")


# What the candidate sees after the call (never the report: that is for HR only)
class InterviewFinishOut(BaseModel):
    status: str  # completed / cancelled / processing
    message: str


# A candidate's interview link, as HR sees it
class InviteOut(BaseModel):
    id: int
    token: str
    status: str  # pending / used / cancelled / expired
    expires_at: datetime
    created_at: datetime
    used_at: datetime | None