from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.agents.jd_generator import _valid_rubric, generate_jd
from app.config import settings
from app.database import get_db
from app.models import Job
from app.schemas import JDGenerateRequest, JDGenerateResponse, JobCreate, JobOut, JobUpdate

# All endpoints in this file start with /api/jobs and appear under "Jobs" on /docs
router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


def get_job_or_404(job_id: int, db: Session) -> Job:
    """Find a job by id, or send a 404 error if it doesn't exist."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


# 🤖 Agent 0: write a JD draft (not saved; HR reviews it first)
@router.post("/generate-jd", response_model=JDGenerateResponse)
def generate_job_description(request: JDGenerateRequest):
    """AI writes a job description, scoring rubric and screening questions."""
    if not (settings.azure_openai_endpoint and settings.azure_openai_api_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Azure OpenAI is not configured. Check the .env file.",
        )
    try:
        return generate_jd(request.model_dump(mode="json"))
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI could not generate the job description: {error}",
        )


# ➕ Save a new job
@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
def create_job(job_in: JobCreate, db: Session = Depends(get_db)):
    """Create a new job (as a draft)."""
    job = Job(**job_in.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# 👀 Show all jobs
@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db)):
    """List all jobs, newest first."""
    return db.scalars(select(Job).order_by(Job.id.desc())).all()


# 👀 Show one job
@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: int, db: Session = Depends(get_db)):
    """Get one job by its id."""
    return get_job_or_404(job_id, db)


# ✏️ Change a job
@router.patch("/{job_id}", response_model=JobOut)
def update_job(job_id: int, job_in: JobUpdate, db: Session = Depends(get_db)):
    """Update only the fields that were sent."""
    job = get_job_or_404(job_id, db)
    for field, value in job_in.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    db.commit()
    db.refresh(job)
    return job


# ✅ HR approves the job description
@router.post("/{job_id}/approve", response_model=JobOut)
def approve_job(job_id: int, db: Session = Depends(get_db)):
    """HR confirms the job description is final. Only approved jobs can receive resumes later."""
    job = get_job_or_404(job_id, db)
    if not job.jd_text or len(job.jd_text.strip()) < 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add or generate a full job description before approving.",
    )
    if not _valid_rubric(job.rubric or {}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The scoring rubric must have the five criteria and add up to 100.",
        )
    
    job.status = "approved"
    db.commit()
    db.refresh(job)
    return job


# 🗑️ Delete a job
@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(job_id: int, db: Session = Depends(get_db)):
    """Delete a job."""
    job = get_job_or_404(job_id, db)
    db.delete(job)
    db.commit()