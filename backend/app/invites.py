"""
Screening invites: the private links candidates use for their voice screening call.

HR never starts calls one by one. Shortlisting a candidate makes their link
automatically; rejecting them (or undoing the shortlist) makes it stop working.
"""

import secrets
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Candidate, ScreeningInvite, User, utc_now

INVITE_DAYS = 7  # a link works for 7 days


def cancel_open_invites(candidate: Candidate, db: Session) -> None:
    """Make every unused link for this candidate stop working."""
    open_invites = db.scalars(
        select(ScreeningInvite).where(
            ScreeningInvite.candidate_id == candidate.id,
            ScreeningInvite.status == "pending",
        )
    )
    for invite in open_invites:
        invite.status = "cancelled"


def create_invite(candidate: Candidate, user: User, db: Session) -> ScreeningInvite:
    """Make a new private link for this candidate (only one link works at a time)."""
    cancel_open_invites(candidate, db)
    invite = ScreeningInvite(
        candidate_id=candidate.id,
        job_id=candidate.job_id,
        token=secrets.token_urlsafe(32),  # ~43 random characters: impossible to guess
        expires_at=utc_now() + timedelta(days=INVITE_DAYS),
        created_by=user.id,
    )
    db.add(invite)
    return invite
