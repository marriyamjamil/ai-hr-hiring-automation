from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.resume_scorer import extract_text, score_resume
from app.config import settings
from app.database import get_db
from app.models import Candidate, Job, ResumeEvaluation
from app.schemas import CandidateDetail, CandidateSummary, UploadResult, UploadSummary

router = APIRouter(tags=["Candidates"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


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

    candidates = db.scalars(select(Candidate).where(Candidate.job_id == job_id)).all()
    ranked = sorted(
        candidates,
        key=lambda c: c.evaluation.overall_score if c.evaluation else -1,
        reverse=True,
    )
    return [
        CandidateSummary(
            id=c.id,
            name=c.name,
            email=c.email,
            status=c.status,
            overall_score=c.evaluation.overall_score if c.evaluation else None,
            summary=c.evaluation.summary if c.evaluation else None,
        )
        for c in ranked
    ]


# 👤 Full details of one candidate
@router.get("/api/candidates/{candidate_id}", response_model=CandidateDetail)
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    """One candidate with their full score breakdown, evidence and summary."""
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate