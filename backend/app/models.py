from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, Column, Date, DateTime, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="hr")  # hr / manager / admin
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(100))
    experience: Mapped[str | None] = mapped_column(String(50))
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    preferred_skills: Mapped[list] = mapped_column(JSON, default=list)

    # Filled in by Agent 0 (JD Generator), then approved by HR
    jd_text: Mapped[str | None] = mapped_column(Text)
    rubric: Mapped[dict] = mapped_column(JSON, default=dict)
    screening_questions: Mapped[list] = mapped_column(JSON, default=list)

    status: Mapped[str] = mapped_column(String(30), default="draft")  # draft / approved / closed
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(30))
    resume_file: Mapped[str | None] = mapped_column(String(500))
    resume_text: Mapped[str | None] = mapped_column(Text)
    # resume_received / needs_manual_review / scored / shortlisted / rejected / ...
    status: Mapped[str] = mapped_column(String(40), default="resume_received")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    job: Mapped["Job"] = relationship(back_populates="candidates")
    evaluation: Mapped[Optional["ResumeEvaluation"]] = relationship(back_populates="candidate")
    # Every HR decision about this candidate, oldest first (the audit trail)
    decisions: Mapped[list["CandidateDecision"]] = relationship(
        back_populates="candidate", order_by="CandidateDecision.id"
    )
    # Every CV file uploaded for this candidate (the current one + replaced ones)
    versions: Mapped[list["ResumeVersion"]] = relationship(
        back_populates="candidate", order_by="ResumeVersion.id"
    )
    # Every screening call with this candidate (Agent 2), oldest first
    screening_calls: Mapped[list["ScreeningCall"]] = relationship(
        back_populates="candidate", order_by="ScreeningCall.id"
    )


class ResumeEvaluation(Base):
    """Agent 1's score for one candidate's resume against one job."""

    __tablename__ = "resume_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), unique=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    overall_score: Mapped[int]
    criterion_scores: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    missing_or_unclear: Mapped[list] = mapped_column(JSON, default=list)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    summary: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship(back_populates="evaluation")


class CandidateDecision(Base):
    """One HR decision about a candidate (shortlist, reject or undo).

    Rows are only ever added, never changed or deleted, so this table is the
    audit trail: who decided what, why, and when.
    """

    __tablename__ = "candidate_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    from_status: Mapped[str] = mapped_column(String(40))  # e.g. "scored"
    to_status: Mapped[str] = mapped_column(String(40))  # e.g. "shortlisted"
    reason: Mapped[str | None] = mapped_column(Text)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship(back_populates="decisions")
    decided_by_user: Mapped[Optional["User"]] = relationship()

    @property
    def decided_by_name(self) -> str | None:
        """The name of the person who made the decision (shown in the history)."""
        return self.decided_by_user.name if self.decided_by_user else None


class ResumeVersion(Base):
    """One CV file uploaded for a candidate.

    When a candidate sends an updated CV, the old version is kept here
    (is_current = False) instead of being deleted, for the audit trail.
    """

    __tablename__ = "resume_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    file_hash: Mapped[str] = mapped_column(String(64), index=True)  # SHA-256 "fingerprint" of the file
    file_name: Mapped[str] = mapped_column(String(255))  # the name HR uploaded (for display only)
    resume_file: Mapped[str | None] = mapped_column(String(500))  # where it is saved on disk
    overall_score: Mapped[int | None]  # the score this version got (None = not scored)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship(back_populates="versions")


class ScreeningCall(Base):
    """One screening call between Agent 2 and a candidate.

    mode "text" = a pretend call typed in the browser (Stage 2.1).
    mode "voice" = a real voice call through Vapi (Stage 2.2, later).
    """

    __tablename__ = "screening_calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    mode: Mapped[str] = mapped_column(String(10), default="text")  # text / voice
    status: Mapped[str] = mapped_column(String(20), default="in_progress")  # in_progress / completed / cancelled
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)

    # The whole conversation, in order: [{"role": "agent" or "candidate", "text": "..."}]
    transcript: Mapped[list] = mapped_column(JSON, default=list)
    # Which screening question we are on (0 = the first one)
    question_index: Mapped[int] = mapped_column(default=0)

    # Filled in by GPT when the call ends
    report: Mapped[dict | None] = mapped_column(JSON)  # summary, answers, red flags, recommendation
    overall_score: Mapped[int | None]  # 0-100
    model_version: Mapped[str | None] = mapped_column(String(100))

    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # the HR user who started it
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    candidate: Mapped["Candidate"] = relationship(back_populates="screening_calls")


class ScreeningInvite(Base):
    """A private link that lets one candidate do their voice screening call (Stage 2.2).

    Made automatically when HR shortlists a candidate. The candidate opens
    /interview/<token> (no login needed), talks to Agent 2, and the link is used up.
    """

    __tablename__ = "screening_invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # the secret part of the link
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending / used / cancelled
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    # Filled in when the candidate does the call
    screening_call_id: Mapped[int | None] = mapped_column(ForeignKey("screening_calls.id"))
    vapi_call_id: Mapped[str | None] = mapped_column(String(100))  # Vapi's id, to fetch the transcript
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # the HR user who shortlisted
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship()


# ======================= Agent 3: interview scheduling =======================

# Which interviewer can interview for which job (many-to-many: just pairs of ids)
interviewer_jobs = Table(
    "interviewer_jobs",
    Base.metadata,
    Column("interviewer_id", ForeignKey("interviewers.id"), primary_key=True),
    Column("job_id", ForeignKey("jobs.id"), primary_key=True),
)


class Interviewer(Base):
    """A person in the company who takes interviews (not a login user)."""

    __tablename__ = "interviewers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    job_title: Mapped[str | None] = mapped_column(String(100))  # e.g. "Senior Developer"
    meeting_link: Mapped[str | None] = mapped_column(String(500))  # their Zoom / Google Meet room
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # False = don't book them any more
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    jobs: Mapped[list["Job"]] = relationship(secondary=interviewer_jobs)
    # delete-orphan: when HR saves new weekly hours, the old rows are removed automatically
    availability: Mapped[list["InterviewerAvailability"]] = relationship(
        back_populates="interviewer", order_by="InterviewerAvailability.weekday", cascade="all, delete-orphan"
    )
    time_off: Mapped[list["InterviewerTimeOff"]] = relationship(
        back_populates="interviewer", order_by="InterviewerTimeOff.start_date", cascade="all, delete-orphan"
    )


class InterviewerAvailability(Base):
    """One block of free time that repeats every week, e.g. Monday 14:00-17:00 (Pakistan time)."""

    __tablename__ = "interviewer_availability"

    id: Mapped[int] = mapped_column(primary_key=True)
    interviewer_id: Mapped[int] = mapped_column(ForeignKey("interviewers.id"))
    weekday: Mapped[int]  # 0 = Monday ... 6 = Sunday (same as Python's date.weekday())
    start_time: Mapped[str] = mapped_column(String(5))  # "14:00"
    end_time: Mapped[str] = mapped_column(String(5))  # "17:00"

    interviewer: Mapped["Interviewer"] = relationship(back_populates="availability")


class InterviewerTimeOff(Base):
    """Days when an interviewer is away (leave, holiday). No interviews are booked on these days."""

    __tablename__ = "interviewer_time_off"

    id: Mapped[int] = mapped_column(primary_key=True)
    interviewer_id: Mapped[int] = mapped_column(ForeignKey("interviewers.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)  # the last day away (included)
    reason: Mapped[str | None] = mapped_column(String(200))

    interviewer: Mapped["Interviewer"] = relationship(back_populates="time_off")


class Interview(Base):
    """One interview booking made by Agent 3.

    awaiting_candidate = HR approved Agent 3's slot; it is held while the candidate confirms
    scheduled          = the candidate confirmed; emails and calendar invites go to both people
    cancelled / completed
    """

    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    interviewer_id: Mapped[int] = mapped_column(ForeignKey("interviewers.id"))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # saved in UTC
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    mode: Mapped[str] = mapped_column(String(20), default="online")  # online / onsite
    location: Mapped[str | None] = mapped_column(String(500))  # the meeting link or office address
    status: Mapped[str] = mapped_column(String(20), default="proposed")

    # How Agent 3 decided (shown to HR, for the audit trail)
    candidate_windows: Mapped[list] = mapped_column(JSON, default=list)  # what the AI understood from the call
    ai_reason: Mapped[str | None] = mapped_column(Text)  # e.g. "Earliest time both are free"

    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))  # the HR user who approved
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship()
    interviewer: Mapped["Interviewer"] = relationship()

    @property
    def interviewer_name(self) -> str:
        """Shown on the HR page and in emails."""
        return self.interviewer.name


class BookingLink(Base):
    """A private link where the candidate confirms the held interview time or picks another one.

    Made automatically when HR approves a slot. The candidate opens /book/<token> (no login).
    pending = can be used, used = the candidate confirmed or chose, cancelled = HR cancelled
    """

    __tablename__ = "booking_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    interview_id: Mapped[int | None] = mapped_column(ForeignKey("interviews.id"))  # the held interview
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # the secret part of the link
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    candidate: Mapped["Candidate"] = relationship()


class EmailOutbox(Base):
    """Every email the system sends. For now they wait here (safe testing); later Gmail sends them."""

    __tablename__ = "email_outbox"

    id: Mapped[int] = mapped_column(primary_key=True)
    to_email: Mapped[str] = mapped_column(String(255))
    to_name: Mapped[str | None] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    ics: Mapped[str | None] = mapped_column(Text)  # the calendar file (.ics), if there is one
    candidate_id: Mapped[int | None] = mapped_column(ForeignKey("candidates.id"))
    interview_id: Mapped[int | None] = mapped_column(ForeignKey("interviews.id"))
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued / sent / failed / held (old test email)
    error: Mapped[str | None] = mapped_column(Text)  # why sending failed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))