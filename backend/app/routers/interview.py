"""
Public interview endpoints (Agent 2, Stage 2.2): used by the CANDIDATE, not HR.

There is no login here. The secret token in the link IS the permission, so
every endpoint checks the token first (it exists, is unused, and has not expired).
The report is never sent to the candidate: only HR sees it.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.screening_agent import gave_consent, hr_questions, voice_assistant_config
from app.agents.vapi_client import call_metadata, fetch_vapi_call, to_transcript
from app.database import get_db
from app.invites import invite_status
from app.models import Job, ScreeningCall, ScreeningInvite, utc_now
from app.routers.candidates import record_decision
from app.routers.screening import finish_report
from app.schemas import InterviewConnectedIn, InterviewFinishOut, InterviewInfo, InterviewStartOut

# ⚠️ No login dependency on purpose: candidates don't have accounts
router = APIRouter(tags=["Candidate interview (public)"])

CLOSED_MESSAGES = {
    "used": "This interview has already been completed. Thank you!",
    "cancelled": "This interview link is no longer active.",
    "expired": "This interview link has expired. Please contact the HR team.",
}


def get_invite(token: str, db: Session) -> ScreeningInvite:
    invite = db.scalar(select(ScreeningInvite).where(ScreeningInvite.token == token))
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This interview link is not valid.")
    return invite


def get_open_invite(token: str, db: Session) -> ScreeningInvite:
    """The invite, but only if it can still be used."""
    invite = get_invite(token, db)
    current = invite_status(invite)
    if current != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CLOSED_MESSAGES.get(current, "Not active."))
    return invite


# 👋 What the candidate sees when they open the link
@router.get("/api/interview/{token}", response_model=InterviewInfo)
def interview_info(token: str, db: Session = Depends(get_db)):
    invite = get_invite(token, db)
    job = db.get(Job, invite.job_id)
    return InterviewInfo(
        candidate_name=invite.candidate.name,
        job_title=job.title,
        question_count=len(hr_questions(job.location)),
        status=invite_status(invite),
        expires_at=invite.expires_at,
    )


# ▶️ The candidate presses "Start": create the call and send the voice agent's settings
@router.post("/api/interview/{token}/start", response_model=InterviewStartOut)
def start_interview(token: str, db: Session = Depends(get_db)):
    invite = get_open_invite(token, db)
    candidate = invite.candidate
    job = db.get(Job, invite.job_id)
    if candidate.status not in {"shortlisted", "screening_in_progress"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CLOSED_MESSAGES["cancelled"])

    # Started before but closed the page? Close that attempt and start fresh.
    if invite.screening_call_id:
        old_call = db.get(ScreeningCall, invite.screening_call_id)
        if old_call and old_call.status == "in_progress":
            old_call.status = "cancelled"
            old_call.ended_at = utc_now()

    call = ScreeningCall(candidate_id=candidate.id, job_id=job.id, mode="voice", transcript=[])
    db.add(call)
    db.flush()  # gives the new call its id right now (before commit)
    invite.screening_call_id = call.id
    invite.vapi_call_id = None
    if candidate.status == "shortlisted":
        record_decision(candidate, "screening_in_progress", "Candidate started the voice screening call", None, db)
    db.commit()

    return InterviewStartOut(
        screening_call_id=call.id,
        assistant=voice_assistant_config(candidate.name, job.title, job.location, call.id),
    )


# 🔌 The browser connected to Vapi: remember Vapi's id for this call
@router.post("/api/interview/{token}/connected", status_code=status.HTTP_204_NO_CONTENT)
def interview_connected(token: str, body: InterviewConnectedIn, db: Session = Depends(get_db)):
    invite = get_open_invite(token, db)
    if not invite.screening_call_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please start the interview first.")
    invite.vapi_call_id = body.vapi_call_id
    db.commit()


# ⏹️ The call ended: fetch the transcript from Vapi, check consent, write the report
@router.post("/api/interview/{token}/finish", response_model=InterviewFinishOut)
def finish_interview(token: str, db: Session = Depends(get_db)):
    invite = get_open_invite(token, db)
    if not invite.vapi_call_id or not invite.screening_call_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The call was not connected.")
    call = db.get(ScreeningCall, invite.screening_call_id)

    try:
        vapi_call = fetch_vapi_call(invite.vapi_call_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't reach the voice service. Please try again in a moment.",
        )

    # Is this really the call we started? (only checked if Vapi returns our metadata)
    sent_id = call_metadata(vapi_call).get("screening_call_id")
    if sent_id is not None and int(sent_id) != call.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This call does not match the interview.")

    # Vapi needs a few seconds after hang-up to save everything
    if vapi_call.get("status") != "ended":
        return InterviewFinishOut(status="processing", message="Your call is still being saved. Please wait a few seconds.")

    transcript = to_transcript(vapi_call)
    candidate = invite.candidate
    call.transcript = transcript
    call.ended_at = utc_now()

    replies = [m["text"] for m in transcript if m["role"] == "candidate"]
    said_yes = any(gave_consent(text) for text in replies[:2])
    answers = replies[1:]  # everything after the reply to "Is it OK to continue?"

    # Not counted: no answers at all, or no clear "yes" and almost nothing said.
    # The link keeps working, so a dropped call or mic problem never becomes a 0 score.
    if not answers or (not said_yes and len(answers) < 2):
        call.status = "cancelled"
        invite.vapi_call_id = None  # the next try gets a new Vapi call
        record_decision(
            candidate, "shortlisted",
            "Voice screening call not counted: no consent or no answers (the link still works)", None, db,
        )
        db.commit()
        return InterviewFinishOut(
            status="cancelled",
            message="The call ended before the questions were answered. You can open your link again to try when you're ready.",
        )

    invite.status = "used"  # the link is used up now
    invite.used_at = utc_now()

    call.consent_given = True
    call.status = "completed"
    record_decision(candidate, "screened", "Voice screening call completed", None, db)
    db.commit()  # save the transcript FIRST, so nothing is lost if GPT fails
    finish_report(call, db)  # the SAME report as the text call (Stage 2.1)
    db.commit()
    return InterviewFinishOut(status="completed", message="Thank you! Your answers have been sent to the HR team.")
