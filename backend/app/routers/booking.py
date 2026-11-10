"""
Public booking endpoints (Agent 3): used by the CANDIDATE, not HR.

There is no login here. The secret token in the link IS the permission.

HR's approval already scheduled the interview, and the candidate got an email with the time.
This link (in that email) shows the interview, and lets the candidate choose another free
time ONCE if they can't make it. Then the old time is freed, and new emails go out.
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.scheduling_agent import PAKISTAN_TIME
from app.agents.slot_matcher import BUSY_STATUSES, INTERVIEW_MINUTES, find_slots, is_slot_free
from app.booking_links import link_status
from app.config import settings
from app.database import get_db
from app.emails import send_cancellation, send_interview_invites
from app.invites import as_utc
from app.models import BookingLink, Interview, Interviewer, Job, utc_now
from app.routers.candidates import record_decision
from app.routers.scheduling import busy_times, job_interviewers, screening_details
from app.schemas import BookingChooseIn, BookingInfo, BookingSlot

# ⚠️ No login dependency on purpose: candidates don't have accounts
router = APIRouter(tags=["Candidate booking (public)"])

OPTION_COUNT = 6  # how many other free times the candidate sees
OPEN_STATUSES = {"interview_invited", "interview_scheduled"}  # the candidate's statuses where the link works

CLOSED_MESSAGES = {
    "used": "You have already changed your interview time once. Please contact the HR team for any other change.",
    "cancelled": "This booking link is no longer active. Please contact the HR team.",
    "expired": "This booking link has expired. Please contact the HR team.",
}


def get_link(token: str, db: Session) -> BookingLink:
    link = db.scalar(select(BookingLink).where(BookingLink.token == token))
    if link is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This booking link is not valid.")
    return link


def get_open_link(token: str, db: Session) -> BookingLink:
    """The link, but only if it can still be used (and the candidate is still in the process)."""
    link = get_link(token, db)
    current = link_status(link)
    if current != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CLOSED_MESSAGES.get(current, "Not active."))
    if link.candidate.status not in OPEN_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CLOSED_MESSAGES["cancelled"])
    return link


def held_interview(link: BookingLink, db: Session) -> Interview | None:
    return db.get(Interview, link.interview_id) if link.interview_id else None


def to_slot(interview: Interview) -> BookingSlot:
    return BookingSlot(
        interviewer_id=interview.interviewer_id,
        interviewer_name=interview.interviewer_name,
        start=as_utc(interview.start_at).astimezone(PAKISTAN_TIME),
        end=as_utc(interview.end_at).astimezone(PAKISTAN_TIME),
    )


def bookable_interviewers(job_id: int, mode: str, db: Session) -> list[Interviewer]:
    """Interviewers for this job. For online interviews, only those with a meeting link."""
    people = job_interviewers(job_id, db)
    return [p for p in people if p.meeting_link] if mode == "online" else people


def other_times(link: BookingLink, held: Interview | None, db: Session) -> list[BookingSlot]:
    """Fresh free times (checked right now), the candidate's own interview not counted as busy."""
    mode = held.mode if held else "online"
    people = bookable_interviewers(link.job_id, mode, db)
    busy = busy_times(people, db, exclude_id=held.id if held else None)
    result = find_slots(people, busy, [], False, datetime.now(PAKISTAN_TIME), backup_count=OPTION_COUNT)
    held_start = as_utc(held.start_at) if held else None
    return [
        BookingSlot(**slot)
        for slot in result["backups"]
        if not (held and slot["interviewer_id"] == held.interviewer_id and slot["start"] == held_start)
    ]


def finish_booking(link: BookingLink, interview: Interview, reason: str, db: Session) -> None:
    """The link is used up, and the candidate's status is "interview_scheduled"."""
    link.status = "used"
    link.used_at = utc_now()
    link.interview_id = interview.id
    record_decision(link.candidate, "interview_scheduled", reason, None, db)


# 👋 What the candidate sees when they open the link
@router.get("/api/booking/{token}", response_model=BookingInfo)
def booking_info(token: str, db: Session = Depends(get_db)):
    link = get_link(token, db)
    job = db.get(Job, link.job_id)
    held = held_interview(link, db)
    current = link_status(link)
    in_process = link.candidate.status in OPEN_STATUSES
    active = held is not None and held.status in BUSY_STATUSES and in_process
    can_change = current == "pending" and in_process
    return BookingInfo(
        candidate_name=link.candidate.name,
        job_title=job.title,
        company_name=settings.company_name,
        status=current if in_process else "cancelled",
        held=to_slot(held) if active else None,
        confirmed=bool(active and held.status == "scheduled"),
        mode=held.mode if held else None,
        # The meeting link / address is only shown once the time is final
        location=held.location if active and held.status == "scheduled" else None,
        options=other_times(link, held if active else None, db) if can_change else [],
        expires_at=as_utc(link.expires_at),
    )


# ✅ Confirm a held time (only for interviews held before "HR approve = final" was added)
@router.post("/api/booking/{token}/confirm", response_model=BookingInfo)
def confirm_booking(token: str, db: Session = Depends(get_db)):
    link = get_open_link(token, db)
    held = held_interview(link, db)
    if held is None or held.status != "awaiting_candidate":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="There is nothing to confirm.")
    held.status = "scheduled"
    finish_booking(link, held, "Candidate confirmed the interview time", db)
    send_interview_invites(held, link.candidate, db, screening_details=screening_details(link.candidate))
    db.commit()
    return booking_info(token, db)


# 🔁 The candidate can't make it: they choose another free time (once)
@router.post("/api/booking/{token}/choose", response_model=BookingInfo)
def choose_booking(token: str, data: BookingChooseIn, db: Session = Depends(get_db)):
    link = get_open_link(token, db)
    candidate = link.candidate
    held = held_interview(link, db)
    if held is not None and held.status not in BUSY_STATUSES:
        held = None  # HR cancelled it: nothing to replace
    mode = held.mode if held else "online"

    interviewer = db.get(Interviewer, data.interviewer_id)
    if interviewer is None or interviewer not in bookable_interviewers(link.job_id, mode, db):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This time can't be booked. Please choose another one.")

    # Check again that the time is STILL free (another candidate may have just taken it)
    start = data.start.astimezone(PAKISTAN_TIME)
    busy = busy_times([interviewer], db, exclude_id=held.id if held else None)[interviewer.id]
    if not is_slot_free(interviewer, start, busy, datetime.now(PAKISTAN_TIME)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sorry, that time was just taken. Please choose another one.",
        )

    # 1. Free the old time (and tell its interviewer)
    if held:
        held.status = "cancelled"
        send_cancellation(held, candidate, db, notify_candidate=False)

    # 2. Book the new time
    interview = Interview(
        candidate_id=link.candidate_id,
        job_id=link.job_id,
        interviewer_id=interviewer.id,
        start_at=start.astimezone(timezone.utc),
        end_at=(start + timedelta(minutes=INTERVIEW_MINUTES)).astimezone(timezone.utc),
        mode=mode,
        location=interviewer.meeting_link if mode == "online" else (held.location if held else None),
        status="scheduled",
        candidate_windows=held.candidate_windows if held else [],
        ai_reason="The candidate chose another free time",
        approved_by=held.approved_by if held else None,  # HR approved sending this link
        approved_at=held.approved_at if held else None,
    )
    db.add(interview)
    db.flush()  # gives the new interview its id
    finish_booking(link, interview, "Candidate changed the interview time", db)

    # 3. New emails + calendar invites to both people (no change link: it is used up)
    send_interview_invites(interview, candidate, db, screening_details=screening_details(candidate), updated=True)
    db.commit()
    return booking_info(token, db)
