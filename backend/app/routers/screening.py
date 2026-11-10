"""
Agent 2 endpoints: run a screening call (Stage 2.1: typed in the browser).

HR starts a call for a shortlisted candidate. Each reply moves the call one
step forward: consent → question 1 → question 2 → ... → closing message.
When the last question is answered, GPT writes the report and the candidate
becomes "screened". HR then reads the report and decides (human approval gate).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agents.screening_agent import (
    CLOSING_MESSAGE,
    NO_CONSENT_MESSAGE,
    gave_consent,
    opening_message,
    question_message,
    write_report,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Candidate, Job, ScreeningCall, User, utc_now
from app.routers.candidates import record_decision
from app.schemas import ScreeningCallOut, ScreeningReplyIn

# Every endpoint here needs a logged-in user (call data is private)
router = APIRouter(tags=["Screening calls (Agent 2)"], dependencies=[Depends(get_current_user)])


def add_message(call: ScreeningCall, role: str, text: str) -> None:
    """Add one message to the transcript.
    We assign a NEW list (not .append) so SQLAlchemy notices the change and saves it."""
    call.transcript = [*call.transcript, {"role": role, "text": text}]


def get_call(call_id: int, db: Session) -> ScreeningCall:
    call = db.get(ScreeningCall, call_id)
    if call is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Screening call not found")
    return call


def finish_report(call: ScreeningCall, db: Session) -> None:
    """Ask GPT to write the report. If GPT fails, the call is still saved and HR can retry."""
    job = db.get(Job, call.job_id)
    try:
        result = write_report(job.title, job.screening_questions, call.transcript)
    except Exception:
        return  # the report stays empty; HR can retry with POST /report
    call.report = result["report"]
    call.overall_score = result["overall_score"]
    call.model_version = result["model_version"]


# 📞 Start a call (only for shortlisted candidates)
@router.post(
    "/api/candidates/{candidate_id}/screening-calls",
    response_model=ScreeningCallOut,
    status_code=status.HTTP_201_CREATED,
)
def start_call(candidate_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    if candidate.status != "shortlisted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only shortlisted candidates can have a screening call (status is now: {candidate.status}).",
        )
    job = candidate.job
    if not job.screening_questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This job has no screening questions. Add them to the job first.",
        )

    call = ScreeningCall(candidate_id=candidate.id, job_id=job.id, mode="text", started_by=user.id, transcript=[])
    add_message(call, "agent", opening_message(candidate.name, job.title))
    db.add(call)
    record_decision(candidate, "screening_in_progress", "Screening call started (text mode)", user, db)
    db.commit()
    db.refresh(call)
    return call


# 💬 The candidate answers: the call moves one step forward
@router.post("/api/screening-calls/{call_id}/reply", response_model=ScreeningCallOut)
def reply(
    call_id: int,
    body: ScreeningReplyIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    call = get_call(call_id, db)
    if call.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This call has already ended.")
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please type an answer.")

    candidate = call.candidate
    questions = db.get(Job, call.job_id).screening_questions
    add_message(call, "candidate", text)

    if not call.consent_given:
        # This reply is the answer to "Is it OK to continue?"
        if gave_consent(text):
            call.consent_given = True
            add_message(call, "agent", question_message(0, questions))
        else:
            add_message(call, "agent", NO_CONSENT_MESSAGE)
            call.status = "cancelled"
            call.ended_at = utc_now()
            record_decision(
                candidate, "shortlisted", "Screening call stopped: the candidate did not give consent", user, db
            )
    else:
        # This reply is the answer to question number question_index
        call.question_index += 1
        if call.question_index < len(questions):
            add_message(call, "agent", question_message(call.question_index, questions))
        else:
            # That was the last question: end the call and write the report
            add_message(call, "agent", CLOSING_MESSAGE)
            call.status = "completed"
            call.ended_at = utc_now()
            record_decision(candidate, "screened", "Screening call completed", user, db)
            db.commit()  # save the conversation FIRST, so nothing is lost if GPT fails
            finish_report(call, db)

    db.commit()
    db.refresh(call)
    return call


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


# ⛔ HR stops a call that is still running
@router.post("/api/screening-calls/{call_id}/cancel", response_model=ScreeningCallOut)
def cancel_call(call_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    call = get_call(call_id, db)
    if call.status != "in_progress":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This call has already ended.")
    add_message(call, "agent", "This call was ended by the HR team.")
    call.status = "cancelled"
    call.ended_at = utc_now()
    record_decision(call.candidate, "shortlisted", "Screening call cancelled by HR", user, db)
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
