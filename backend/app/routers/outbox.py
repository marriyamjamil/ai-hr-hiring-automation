"""
The email Outbox (Agent 3, step 7): every email the system wrote, newest first.

With EMAIL_SENDING_ENABLED=true (step 8) a background loop in mailer.py sends new emails
with Gmail automatically. HR can also send a failed or held email again with one click.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.mailer import gmail_ready, send_queued_emails
from app.models import EmailOutbox
from app.schemas import EmailOut

router = APIRouter(tags=["Email outbox"], dependencies=[Depends(get_current_user)])


# 📬 All emails (or only one candidate's emails), newest first
@router.get("/api/emails", response_model=list[EmailOut])
def list_emails(
    candidate_id: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = select(EmailOutbox).order_by(EmailOutbox.id.desc()).limit(limit)
    if candidate_id is not None:
        query = query.where(EmailOutbox.candidate_id == candidate_id)
    return db.scalars(query).all()


# 📨 Send one email now (Retry a failed one, or send a held / queued one)
@router.post("/api/emails/{email_id}/send", response_model=EmailOut)
async def send_email_now(email_id: int, db: Session = Depends(get_db)):
    email = db.get(EmailOutbox, email_id)
    if email is None:
        raise HTTPException(status_code=404, detail="Email not found")
    if email.status == "sent":
        raise HTTPException(status_code=400, detail="This email was already sent.")
    if "@" not in email.to_email:
        raise HTTPException(status_code=400, detail="This person has no email address. Add it first.")
    if not gmail_ready():
        raise HTTPException(
            status_code=400,
            detail="Gmail sending is off. Set EMAIL_SENDING_ENABLED=true and the Gmail login in backend/.env, then restart.",
        )

    email.status, email.error = "queued", None
    db.commit()

    await run_in_threadpool(send_queued_emails)  # sends it (and anything else waiting)

    db.refresh(email)
    if email.status == "queued":  # Gmail could not be reached / login failed
        raise HTTPException(status_code=502, detail="Could not reach Gmail. Check the backend terminal and try again.")
    return email
