from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.resume_scorer import extract_text, score_resume
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Candidate, CandidateDecision, Job, ResumeEvaluation, User
from app.schemas import (
    CandidateDetail,
    CandidateSummary,
    DecisionIn,
    ShortlistIn,
    ShortlistResult,
    UploadResult,
    UploadSummary,
)

# Every endpoint here needs a logged-in user (candidate data is private)
router = APIRouter(tags=["Candidates"], dependencies=[Depends(get_current_user)])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}

# 🚦 The candidate "state machine": a new status is only allowed FROM these statuses.
# (Undo is handled separately: it goes back to the status before the last decision.)
ALLOWED_FROM = {
    "shortlisted": {"scored", "needs_manual_review"},
    "rejected": {"scored", "needs_manual_review", "shortlisted"},
}
UNDOABLE = {"shortlisted", "rejected"}


def get_job_ready_for_resumes(job_id: int, db: Session) -> Job:
    """Make sure the job exists, is approved, and the AI is configured."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approve the job description before uploading resumes.",
        )
    if not (settings.azure_openai_endpoint and settings.azure_openai_api_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure OpenAI is not configured. Check the .env file.",
        )
    return job


def process_resume(job: Job, file: UploadFile, db: Session) -> UploadResult:
    """Check, save, read and score one uploaded resume."""
    file_name = Path(file.filename or "resume").name
    extension = Path(file_name).suffix.lower()

    # 1. Check the file type and size
    if extension not in ALLOWED_EXTENSIONS:
        return UploadResult(file_name=file_name, status="rejected",
                            detail="Only PDF and DOCX files are allowed.")
    data = file.file.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        return UploadResult(file_name=file_name, status="rejected",
                            detail=f"File is larger than {settings.max_upload_mb} MB.")

    # 2. Save the file with a random name (never trust the uploaded file name)
    job_folder = Path(settings.upload_dir) / f"job_{job.id}"
    job_folder.mkdir(parents=True, exist_ok=True)
    saved_path = job_folder / f"{uuid4().hex}{extension}"
    saved_path.write_bytes(data)

    candidate = Candidate(
        job_id=job.id,
        name=Path(file_name).stem[:100],  # temporary name until the AI reads the resume
        resume_file=str(saved_path),
        status="resume_received",
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    # 3. Read the text from the file
    try:
        resume_text = extract_text(file_name, data)
    except Exception:
        resume_text = ""
    candidate.resume_text = resume_text

    if len(resume_text.strip()) < 50:
        candidate.status = "needs_manual_review"
        db.commit()
        return UploadResult(file_name=file_name, status="needs_manual_review",
                            candidate_id=candidate.id,
                            detail="Could not read enough text (it may be a scanned image).")

    # 4. Ask Agent 1 to score it
    try:
        result = score_resume(job.jd_text, job.rubric, resume_text)
    except Exception as error:
        candidate.status = "needs_manual_review"
        db.commit()
        return UploadResult(file_name=file_name, status="needs_manual_review",
                            candidate_id=candidate.id,
                            detail=f"AI scoring failed: {error}")

    # 5. Save the contact details and the evaluation
    contact = result["candidate"]
    candidate.name = (contact.get("name") or candidate.name)[:100]
    candidate.email = contact.get("email")
    candidate.phone = contact.get("phone")
    candidate.status = "scored"
    db.add(ResumeEvaluation(
        candidate_id=candidate.id,
        job_id=job.id,
        overall_score=result["overall_score"],
        criterion_scores=result["criterion_scores"],
        evidence=result["evidence"],
        missing_or_unclear=result["missing_or_unclear"],
        warnings=result["warnings"],
        summary=result["summary"],
        model_version=result["model_version"],
    ))
    db.commit()

    return UploadResult(file_name=file_name, status="scored",
                        candidate_id=candidate.id,
                        overall_score=result["overall_score"])


# 📄 Upload ONE resume (shows a "Choose File" button on /docs)
@router.post("/api/jobs/{job_id}/resume", response_model=UploadResult)
def upload_one_resume(
    job_id: int,
    file: UploadFile = File(..., description="One resume (PDF or DOCX)"),
    db: Session = Depends(get_db),
):
    """Upload a single resume for an approved job. It is saved and scored by Agent 1."""
    job = get_job_ready_for_resumes(job_id, db)
    return process_resume(job, file, db)


# 📥 Upload MANY resumes at once (used by the website later)
@router.post("/api/jobs/{job_id}/resumes", response_model=UploadSummary)
def upload_resumes(
    job_id: int,
    files: list[UploadFile] = File(..., description="One or more resumes (PDF or DOCX)"),
    db: Session = Depends(get_db),
):
    """Upload several resumes for an approved job. Each one is saved and scored by Agent 1."""
    job = get_job_ready_for_resumes(job_id, db)
    results = [process_resume(job, file, db) for file in files]
    return UploadSummary(job_id=job.id, total_files=len(files), results=results)


# 🏆 Ranked list of candidates for a job
@router.get("/api/jobs/{job_id}/candidates", response_model=list[CandidateSummary])
def list_candidates(job_id: int, db: Session = Depends(get_db)):
    """All candidates for a job, highest score first. Unscored candidates come last."""
    if db.get(Job, job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return [to_summary(c) for c in ranked_candidates(job_id, db)]


def ranked_candidates(job_id: int, db: Session) -> list[Candidate]:
    """All candidates for a job, highest score first (unscored ones last)."""
    candidates = db.scalars(select(Candidate).where(Candidate.job_id == job_id)).all()
    return sorted(
        candidates,
        key=lambda c: c.evaluation.overall_score if c.evaluation else -1,
        reverse=True,
    )


def to_summary(c: Candidate) -> CandidateSummary:
    """One row of the ranked list."""
    return CandidateSummary(
        id=c.id,
        name=c.name,
        email=c.email,
        status=c.status,
        overall_score=c.evaluation.overall_score if c.evaluation else None,
        summary=c.evaluation.summary if c.evaluation else None,
    )


# 👤 Full details of one candidate
@router.get("/api/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """One candidate with their full score breakdown, evidence and summary."""
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


# ---------- HR decisions: the human approval gate ----------

def record_decision(candidate: Candidate, new_status: str, reason: str | None, user: User, db: Session):
    """Save one history row (who, what, why, when), then change the candidate's status."""
    db.add(CandidateDecision(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        from_status=candidate.status,
        to_status=new_status,
        reason=reason,
        decided_by=user.id,
    ))
    candidate.status = new_status


# 💡 Suggest a shortlist: the top N scored candidates above a minimum score
@router.get("/api/jobs/{job_id}/shortlist-suggestion", response_model=list[CandidateSummary])
def suggest_shortlist(
    job_id: int,
    top: int = Query(10, ge=1, le=100, description="How many candidates to suggest"),
    min_score: int = Query(60, ge=0, le=100, description="Nobody below this score is suggested"),
    db: Session = Depends(get_db),
):
    """Only a SUGGESTION: nothing changes until HR approves it with POST /shortlist.
    Candidates with the same score as the last place are all included (ties are fair)."""
    if db.get(Job, job_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    # Only candidates that are scored, not decided yet, and good enough
    pool = [
        c for c in ranked_candidates(job_id, db)
        if c.status == "scored" and c.evaluation and c.evaluation.overall_score >= min_score
    ]
    if len(pool) > top:
        cutoff = pool[top - 1].evaluation.overall_score  # the score of the last place
        pool = [c for c in pool if c.evaluation.overall_score >= cutoff]  # keep ties
    return [to_summary(c) for c in pool]


# ✅ HR approves a shortlist (many candidates in one click)
@router.post("/api/jobs/{job_id}/shortlist", response_model=ShortlistResult)
def approve_shortlist(
    job_id: int,
    body: ShortlistIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Shortlist the candidates HR selected. Each one gets its own history row."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if job.status == "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Approve the job before shortlisting candidates.")

    shortlisted = 0
    skipped: list[str] = []
    for candidate_id in dict.fromkeys(body.candidate_ids):  # dict.fromkeys removes duplicate ids
        candidate = db.get(Candidate, candidate_id)
        if candidate is None or candidate.job_id != job_id:
            skipped.append(f"#{candidate_id}: not a candidate for this job")
            continue
        if candidate.status not in ALLOWED_FROM["shortlisted"]:
            skipped.append(f"{candidate.name}: already {candidate.status.replace('_', ' ')}")
            continue

        if body.note:
            reason = body.note
        elif candidate.evaluation:
            reason = f"Approved from the suggested shortlist (AI score {candidate.evaluation.overall_score})"
        else:
            reason = "Approved by HR after a manual CV review"
        record_decision(candidate, "shortlisted", reason, current_user, db)
        shortlisted += 1

    db.commit()
    return ShortlistResult(job_id=job_id, shortlisted=shortlisted, skipped=skipped)


# 👩‍💼 HR decides about ONE candidate: shortlist, reject (reason required) or undo
@router.post("/api/candidates/{candidate_id}/decision", response_model=CandidateDetail)
def decide_candidate(
    candidate_id: int,
    decision_in: DecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change a candidate's status. The rules (state machine) are checked here, and
    every decision is saved in the history with who made it and why."""
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    reason = (decision_in.reason or "").strip() or None

    if decision_in.decision == "undo":
        # Go back to the status the candidate had before the last decision
        if candidate.status not in UNDOABLE or not candidate.decisions:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="There is no decision to undo.")
        new_status = candidate.decisions[-1].from_status
        reason = reason or "Decision undone"
    else:
        new_status = decision_in.decision
        if candidate.status not in ALLOWED_FROM[new_status]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Can't change a candidate from '{candidate.status}' to '{new_status}'.",
            )
        if new_status == "rejected" and not reason:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Please give a job-related reason for rejecting this candidate.")

    record_decision(candidate, new_status, reason, current_user, db)
    db.commit()
    db.refresh(candidate)
    return candidate