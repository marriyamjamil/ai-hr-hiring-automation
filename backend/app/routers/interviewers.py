"""
Interviewers (Agent 3): the people who take interviews, the jobs they interview for,
their weekly free hours and their days off. Agent 3 reads this to find interview times.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Interview, Interviewer, InterviewerAvailability, InterviewerTimeOff, Job
from app.schemas import InterviewerIn, InterviewerOut

# Every endpoint here needs a logged-in user
router = APIRouter(
    prefix="/api/interviewers",
    tags=["Interviewers (Agent 3)"],
    dependencies=[Depends(get_current_user)],
)


def get_interviewer(interviewer_id: int, db: Session) -> Interviewer:
    interviewer = db.get(Interviewer, interviewer_id)
    if interviewer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interviewer not found")
    return interviewer


def clean(text: str | None) -> str | None:
    """Trim spaces; an empty box becomes None."""
    return text.strip() or None if text else None


def fill(interviewer: Interviewer, data: InterviewerIn, db: Session) -> None:
    """Copy the form into the interviewer. Weekly hours and days off are REPLACED by the new lists."""
    email = data.email.strip().lower()

    # 1. Checks first (before changing anything)
    same_email = db.scalar(select(Interviewer).where(Interviewer.email == email))
    if same_email and same_email.id != interviewer.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An interviewer with this email already exists.")

    jobs = []
    for job_id in set(data.job_ids):  # set() removes repeated ids
        job = db.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {job_id} not found")
        jobs.append(job)

    # 2. Copy the values
    interviewer.name = data.name.strip()
    interviewer.email = email
    interviewer.job_title = clean(data.job_title)
    interviewer.meeting_link = clean(data.meeting_link)
    interviewer.is_active = data.is_active
    interviewer.jobs = jobs
    # The old rows are removed automatically (cascade="all, delete-orphan" in models.py)
    interviewer.availability = [
        InterviewerAvailability(weekday=s.weekday, start_time=s.start_time, end_time=s.end_time)
        for s in data.availability
    ]
    interviewer.time_off = [
        InterviewerTimeOff(start_date=t.start_date, end_date=t.end_date, reason=clean(t.reason))
        for t in data.time_off
    ]


# 📋 All interviewers (active ones first, then A-Z)
@router.get("", response_model=list[InterviewerOut])
def list_interviewers(db: Session = Depends(get_db)):
    return db.scalars(select(Interviewer).order_by(Interviewer.is_active.desc(), Interviewer.name)).all()


# 👤 One interviewer
@router.get("/{interviewer_id}", response_model=InterviewerOut)
def read_interviewer(interviewer_id: int, db: Session = Depends(get_db)):
    return get_interviewer(interviewer_id, db)


# ➕ Add an interviewer
@router.post("", response_model=InterviewerOut, status_code=status.HTTP_201_CREATED)
def create_interviewer(data: InterviewerIn, db: Session = Depends(get_db)):
    interviewer = Interviewer()
    fill(interviewer, data, db)
    db.add(interviewer)
    db.commit()
    db.refresh(interviewer)
    return interviewer


# ✏️ Edit an interviewer (send the whole form again)
@router.put("/{interviewer_id}", response_model=InterviewerOut)
def update_interviewer(interviewer_id: int, data: InterviewerIn, db: Session = Depends(get_db)):
    interviewer = get_interviewer(interviewer_id, db)
    fill(interviewer, data, db)
    db.commit()
    db.refresh(interviewer)
    return interviewer


# 🗑️ Delete an interviewer (only if they never had an interview: the history must stay)
@router.delete("/{interviewer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interviewer(interviewer_id: int, db: Session = Depends(get_db)):
    interviewer = get_interviewer(interviewer_id, db)
    interview_count = db.scalar(
        select(func.count()).select_from(Interview).where(Interview.interviewer_id == interviewer.id)
    )
    if interview_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This interviewer already has interviews. Mark them as inactive instead of deleting.",
        )
    db.delete(interviewer)
    db.commit()
