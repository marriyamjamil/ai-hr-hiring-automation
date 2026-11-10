"""
Screening call endpoints for HR (Agent 2).

Calls happen by voice only: the candidate opens their private link and talks
to Agent 2 (see routers/interview.py). Here HR reads the transcript and report,
and can ask the AI to write the report again if it failed.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agents.screening_agent import hr_questions, write_report
from app.database import get_db
from app.dependencies import get_current_user
from app.invites import create_invite, invite_status, latest_invite
from app.models import Candidate, Job, ScreeningCall, ScreeningInvite, User
from app.schemas import InviteOut, ScreeningCallOut

# Every endpoint here needs a logged-in user (call data is private)
router = APIRouter(tags=["Screening calls (Agent 2)"], dependencies=[Depends(get_current_user)])


def get_call(call_id: int, db: Session) -> ScreeningCall:
    call = db.get(ScreeningCall, call_id)
    if call is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening call not found")
    return call


def finish_report(call: ScreeningCall, db: Session) -> None:
    """Ask GPT to write the report. If GPT fails, the call is still saved and HR can retry."""
    job = db.get(Job, call.job_id)
    try:
        result = write_report(job.title, hr_questions(job.location), call.transcript)
    except Exception:
        return  # the report stays empty; HR can retry with POST /report
    call.report = result["report"]
    call.overall_score = result["overall_score"]
    call.model_version = result["model_version"]


# 🔁 Retry the report (if GPT failed the first time)
@router.post("/api/screening-calls/{call_id}/report", response_model=ScreeningCallOut)
def retry_report(call_id: int, db: Session = Depends(get_db)):
    call = get_call(call_id, db)
    if call.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The report can only be written after the call is completed.",
        )
    finish_report(call, db)
    if call.report is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI could not write the report. Please try again in a minute.",
        )
    db.commit()
    db.refresh(call)
    return call


# 📋 All calls for one candidate (oldest first)
@router.get("/api/candidates/{candidate_id}/screening-calls", response_model=list[ScreeningCallOut])
def list_calls(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate.screening_calls


# ---------- Interview links (HR sees, copies and renews them) ----------

def to_invite_out(invite: ScreeningInvite) -> InviteOut:
    return InviteOut(
        id=invite.id,
        token=invite.token,
        status=invite_status(invite),
        expires_at=invite.expires_at,
        created_at=invite.created_at,
        used_at=invite.used_at,
    )


def get_candidate(candidate_id: int, db: Session) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


# 🔗 The candidate's newest interview link (or null if they have none)
@router.get("/api/candidates/{candidate_id}/invite", response_model=InviteOut | None)
def get_invite(candidate_id: int, db: Session = Depends(get_db)):
    invite = latest_invite(get_candidate(candidate_id, db), db)
    return to_invite_out(invite) if invite else None


# 🔁 Make a new link (the old one stops working)
@router.post("/api/candidates/{candidate_id}/invite", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def new_invite(candidate_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    candidate = get_candidate(candidate_id, db)
    if candidate.status != "shortlisted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only shortlisted candidates can get an interview link.",
        )
    invite = create_invite(candidate, user, db)
    db.commit()
    db.refresh(invite)
    return to_invite_out(invite)
