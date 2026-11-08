from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
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