"""
Interview scheduling endpoints for HR (Agent 3).

Step 3: see how Agent 3 understood the candidate's interview times from the screening call.
Step 4: see Agent 3's suggested interview slot + backup slots (read-only).
Step 5: HR approves one slot (the human approval gate). HR's approval is FINAL:
        the interview is scheduled at once.
Step 7: the final emails + calendar invites go to the candidate and the interviewer (Outbox).
        The candidate's email has a link to choose another time if they can't make it.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.scheduling_agent import PAKISTAN_TIME, parse_availability
from app.agents.slot_matcher import BUSY_STATUSES, INTERVIEW_MINUTES, find_slots, is_slot_free
from app.booking_links import booking_url, cancel_open_links, create_link, latest_link, link_status
from app.database import get_db
from app.dependencies import get_current_user
from app.emails import send_cancellation, send_interview_invites, when_text
from app.invites import as_utc
from app.models import Candidate, Interview, Interviewer, Job, ScreeningCall, User, utc_now
from app.routers.candidates import record_decision
from app.schemas import BookingLinkOut, CandidateAvailabilityOut, InterviewApproveIn, InterviewOut, SlotSuggestionsOut

router = APIRouter(tags=["Interview scheduling (Agent 3)"], dependencies=[Depends(get_current_user)])


def get_candidate(candidate_id: int, db: Session) -> Candidate:
    candidate = db.get(Candidate, candidate_id)
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


def latest_completed_call(candidate: Candidate) -> ScreeningCall | None:
    """The newest finished screening call that has a report."""
    done = [call for call in candidate.screening_calls if call.status == "completed" and call.report]
    return done[-1] if done else None


def screening_details(candidate: Candidate) -> list[dict]:
    """The facts from the screening call (notice period, salary...), for the interviewer's email."""
    call = latest_completed_call(candidate)
    return call.report.get("details", []) if call else []


def availability_text(call: ScreeningCall) -> str | None:
    """What the candidate said about interview times (from the call's details card)."""
    for detail in call.report.get("details", []):  # old-style reports have no details: returns None
        if detail.get("key") == "interview_availability":
            return detail.get("value")
    return None


def read_availability(candidate: Candidate) -> CandidateAvailabilityOut:
    """Step 3: the AI turns the candidate's spoken times into real time windows."""
    call = latest_completed_call(candidate)
    if call is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This candidate has no completed screening call with a report yet.",
        )
    text = availability_text(call)
    call_day = as_utc(call.ended_at or call.started_at).astimezone(PAKISTAN_TIME).date()
    today = datetime.now(PAKISTAN_TIME).date()
    try:
        result = parse_availability(text, call_day, today)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI could not read the interview times. Please try again in a minute.",
        )
    return CandidateAvailabilityOut(source_text=text, call_date=call_day, **result)


def job_interviewers(job_id: int, db: Session) -> list[Interviewer]:
    """Active interviewers who interview for this job."""
    return list(
        db.scalars(
            select(Interviewer)
            .where(Interviewer.is_active.is_(True), Interviewer.jobs.any(Job.id == job_id))
            .order_by(Interviewer.id)
        ).all()
    )


def busy_times(
    interviewers: list[Interviewer], db: Session, exclude_id: int | None = None
) -> dict[int, list[tuple[datetime, datetime]]]:
    """Each interviewer's upcoming interviews (they can't be booked twice). Times in Pakistan time.

    exclude_id: ignore this interview (the candidate's own held slot, when they pick another time).
    """
    ids = [person.id for person in interviewers]
    now = datetime.now(PAKISTAN_TIME)
    busy: dict[int, list[tuple[datetime, datetime]]] = {person_id: [] for person_id in ids}
    if not ids:
        return busy
    interviews = db.scalars(
        select(Interview).where(Interview.interviewer_id.in_(ids), Interview.status.in_(BUSY_STATUSES))
    ).all()
    for interview in interviews:
        if interview.id == exclude_id:
            continue
        start = as_utc(interview.start_at).astimezone(PAKISTAN_TIME)
        end = as_utc(interview.end_at).astimezone(PAKISTAN_TIME)
        if end > now:  # past interviews don't block anything
            busy[interview.interviewer_id].append((start, end))
    return busy


# 🕒 How Agent 3 understood the candidate's interview times
@router.get("/api/candidates/{candidate_id}/availability", response_model=CandidateAvailabilityOut)
def candidate_availability(candidate_id: int, db: Session = Depends(get_db)):
    return read_availability(get_candidate(candidate_id, db))


# 🎯 Agent 3's suggested interview slot (+ backups). Read-only: nothing is booked yet.
@router.get("/api/candidates/{candidate_id}/slot-suggestions", response_model=SlotSuggestionsOut)
def slot_suggestions(candidate_id: int, db: Session = Depends(get_db)):
    candidate = get_candidate(candidate_id, db)
    availability = read_availability(candidate)
    interviewers = job_interviewers(candidate.job_id, db)
    result = find_slots(
        interviewers,
        busy_times(interviewers, db),
        [(w.day, w.start, w.end) for w in availability.windows],
        availability.flexible,
        datetime.now(PAKISTAN_TIME),
    )
    return SlotSuggestionsOut(availability=availability, **result)


# ---------- Step 5: HR approves a slot ----------

def active_interview(candidate_id: int, db: Session) -> Interview | None:
    """The candidate's current interview (held or confirmed), if any."""
    return db.scalar(
        select(Interview).where(Interview.candidate_id == candidate_id, Interview.status.in_(BUSY_STATUSES))
    )


# 📋 All interviews of one candidate (newest first)
@router.get("/api/candidates/{candidate_id}/interviews", response_model=list[InterviewOut])
def list_interviews(candidate_id: int, db: Session = Depends(get_db)):
    candidate = get_candidate(candidate_id, db)
    return db.scalars(
        select(Interview).where(Interview.candidate_id == candidate.id).order_by(Interview.id.desc())
    ).all()


# ✅ HR approves a slot: the interview is scheduled and the emails are queued for both people
@router.post("/api/candidates/{candidate_id}/interviews", response_model=InterviewOut, status_code=status.HTTP_201_CREATED)
def approve_interview(
    candidate_id: int,
    data: InterviewApproveIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    candidate = get_candidate(candidate_id, db)
    if candidate.status != "interview_invited":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite the candidate to an interview first.")
    if active_interview(candidate.id, db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This candidate already has an interview. Cancel it first to pick a new time.",
        )

    interviewer = db.get(Interviewer, data.interviewer_id)
    if interviewer is None or not interviewer.is_active or candidate.job_id not in [job.id for job in interviewer.jobs]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This interviewer can't take interviews for this job.")

    # Online → the interviewer's meeting link; on-site → the office address HR typed
    address = (data.location or "").strip()
    if data.mode == "onsite" and not address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please enter the office address for an on-site interview.")
    if data.mode == "online" and not interviewer.meeting_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{interviewer.name} has no meeting link. Add one on the Interviewers page, or choose on-site.",
        )

    # Check AGAIN that the slot is still free (another HR user may have just taken it)
    start = data.start.astimezone(PAKISTAN_TIME)
    busy = busy_times([interviewer], db)[interviewer.id]
    if not is_slot_free(interviewer, start, busy, datetime.now(PAKISTAN_TIME)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sorry, this time is no longer free. Please find the interview times again.",
        )

    interview = Interview(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        interviewer_id=interviewer.id,
        start_at=start.astimezone(timezone.utc),  # always saved in UTC
        end_at=(start + timedelta(minutes=INTERVIEW_MINUTES)).astimezone(timezone.utc),
        mode=data.mode,
        location=interviewer.meeting_link if data.mode == "online" else address,
        status="scheduled",  # HR's approval is final
        candidate_windows=[w.model_dump(mode="json") for w in data.candidate_windows],
        ai_reason=data.reason,
        approved_by=user.id,
        approved_at=utc_now(),
    )
    db.add(interview)
    db.flush()  # gives the interview its id now, for the link and the emails
    link = create_link(interview, db)  # 🔗 lets the candidate choose another time if needed
    record_decision(
        candidate, "interview_scheduled", f"Interview scheduled: {when_text(interview)} with {interviewer.name}", user, db
    )
    # 📧 + 📆 to the candidate and the interviewer (saved in the Outbox)
    send_interview_invites(interview, candidate, db, booking_url=booking_url(link), screening_details=screening_details(candidate))
    db.commit()
    db.refresh(interview)
    return interview


# ✖ HR cancels an interview: the slot is free again
@router.post("/api/interviews/{interview_id}/cancel", response_model=InterviewOut)
def cancel_interview(interview_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    interview = db.get(Interview, interview_id)
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Interview not found")
    if interview.status not in BUSY_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This interview is not active.")
    interview.status = "cancelled"
    cancel_open_links(interview.candidate_id, db)  # the candidate's link stops working
    candidate = interview.candidate
    send_cancellation(interview, candidate, db, notify_candidate=True)  # 📧 to both people
    # A scheduled interview was cancelled → the candidate goes back to "invited", ready for a new time
    if candidate.status == "interview_scheduled":
        record_decision(candidate, "interview_invited", "Interview cancelled by HR", user, db)
    db.commit()
    db.refresh(interview)
    return interview


# 🔗 The candidate's newest booking link (or null), so HR can copy it until emails are added
@router.get("/api/candidates/{candidate_id}/booking-link", response_model=BookingLinkOut | None)
def get_booking_link(candidate_id: int, db: Session = Depends(get_db)):
    link = latest_link(get_candidate(candidate_id, db).id, db)
    if link is None:
        return None
    return BookingLinkOut(
        token=link.token,
        status=link_status(link),
        expires_at=as_utc(link.expires_at),
        used_at=as_utc(link.used_at) if link.used_at else None,
    )
