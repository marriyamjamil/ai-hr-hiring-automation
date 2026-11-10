"""
Booking links (Agent 3): the private link where a candidate confirms their interview time
or picks another free one. Same idea as the screening links in invites.py.

HR approving a slot makes the link automatically; cancelling the interview (or rejecting
the candidate) makes it stop working. Only one link per candidate works at a time.
"""

import secrets
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.invites import as_utc
from app.models import BookingLink, Interview, utc_now

LINK_DAYS = 3  # the candidate can change their interview time for 3 days


def cancel_open_links(candidate_id: int, db: Session) -> None:
    """Make every unused booking link for this candidate stop working."""
    for link in db.scalars(
        select(BookingLink).where(BookingLink.candidate_id == candidate_id, BookingLink.status == "pending")
    ):
        link.status = "cancelled"


def create_link(interview: Interview, db: Session) -> BookingLink:
    """A new link for the held interview (older links stop working)."""
    cancel_open_links(interview.candidate_id, db)
    link = BookingLink(
        candidate_id=interview.candidate_id,
        job_id=interview.job_id,
        interview_id=interview.id,
        token=secrets.token_urlsafe(32),  # ~43 random characters: impossible to guess
        expires_at=utc_now() + timedelta(days=LINK_DAYS),
    )
    db.add(link)
    return link


def booking_url(link: BookingLink) -> str:
    """The full link the candidate opens, e.g. http://localhost:3000/book/abc123"""
    return f"{settings.frontend_origin}/book/{link.token}"


def link_status(link: BookingLink) -> str:
    """pending / used / cancelled, or "expired" if a pending link is too old."""
    if link.status == "pending" and as_utc(link.expires_at) < utc_now():
        return "expired"
    return link.status


def latest_link(candidate_id: int, db: Session) -> BookingLink | None:
    """The newest booking link made for this candidate (or None)."""
    return db.scalar(
        select(BookingLink).where(BookingLink.candidate_id == candidate_id).order_by(BookingLink.id.desc()).limit(1)
    )
