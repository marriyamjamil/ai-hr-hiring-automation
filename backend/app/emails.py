"""
Agent 3, step 7: interview emails + calendar invites (.ics files).

The emails are written from fixed templates, not by AI: the date, time and meeting link
must be exactly right every time, and a template can never invent anything.

Every email is saved in the email_outbox table first (status "queued").
mailer.py (step 8) sends them with Gmail, as a plain "real email" style HTML version.

Plain-text rules that mailer.py turns into simple HTML:
- "Label: value" lines together  → the label in bold
- a short line on its own         → a small bold heading
- lines starting with "- "        → a bullet list
- "→ Link text: https://..."      → a normal link with that text
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.agents.scheduling_agent import PAKISTAN_TIME
from app.config import settings
from app.invites import as_utc
from app.models import Candidate, EmailOutbox, Interview, utc_now


# ---------- Small helpers ----------

def clock(moment: datetime) -> str:
    """14:00 → "2:00 PM" """
    return moment.strftime("%I:%M %p").lstrip("0")


def when_text(interview: Interview) -> str:
    """"Monday, 16 November 2026, 2:00 PM - 2:45 PM (Pakistan time)" """
    start = as_utc(interview.start_at).astimezone(PAKISTAN_TIME)
    end = as_utc(interview.end_at).astimezone(PAKISTAN_TIME)
    return f"{start:%A}, {start.day} {start:%B %Y}, {clock(start)} - {clock(end)} (Pakistan time)"


def short_day(interview: Interview) -> str:
    """"Mon 16 Nov, 2:00 PM" (for subjects)"""
    start = as_utc(interview.start_at).astimezone(PAKISTAN_TIME)
    return f"{start:%a} {start.day} {start:%b}, {clock(start)}"


def duration_text(interview: Interview) -> str:
    minutes = int((as_utc(interview.end_at) - as_utc(interview.start_at)).total_seconds() // 60)
    return f"{minutes} minutes"


def where_text(interview: Interview) -> str:
    if interview.mode == "online":
        return f"Online video call: {interview.location}" if interview.location else "Online video call (link to follow)"
    return f"In person: {interview.location}" if interview.location else "In person at our office"


def person_name(name: str | None) -> str:
    """"MARRIYAM JAMIL" / "marriyam jamil" → "Marriyam Jamil" (mixed-case names are kept as typed)."""
    name = " ".join((name or "").split())
    return name.title() if name and (name.isupper() or name.islower()) else name


def first_name(name: str | None) -> str:
    full = person_name(name)
    return full.split()[0] if full else "there"


def interviewer_text(interview: Interview) -> str:
    person = interview.interviewer
    name = person_name(person.name)
    return f"{name}, {person.job_title}" if person.job_title else name


def signature() -> str:
    return f"Kind regards,\nTalent Acquisition Team\n{settings.company_name}"


def queue_email(
    db: Session,
    to_email: str | None,
    to_name: str | None,
    subject: str,
    body: str,
    ics: str | None = None,
    candidate_id: int | None = None,
    interview_id: int | None = None,
) -> EmailOutbox:
    """Put one email in the outbox. No address → saved as "failed" so HR can see it."""
    address = (to_email or "").strip()
    email = EmailOutbox(
        to_email=address or "(no email address)",
        to_name=person_name(to_name) or None,
        subject=subject,
        body=body,
        ics=ics,
        candidate_id=candidate_id,
        interview_id=interview_id,
        status="queued" if address else "failed",
        error=None if address else "No email address is saved for this person.",
    )
    db.add(email)
    return email


# ---------- The calendar invite (.ics) ----------
# METHOD:REQUEST + ORGANIZER + ATTENDEE makes Gmail / Outlook show a real invite
# with Yes / No / Maybe buttons. METHOD:CANCEL with the same UID removes it again.

def ics_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def ics_time(moment: datetime) -> str:
    return as_utc(moment).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def fold(line: str) -> str:
    """The calendar format wants lines of at most 75 characters (longer ones continue after a space)."""
    parts = []
    while len(line) > 75:
        parts.append(line[:75])
        line = " " + line[75:]
    parts.append(line)
    return "\r\n".join(parts)


def make_ics(
    interview: Interview,
    title: str,
    description: str,
    attendee_email: str | None,
    attendee_name: str | None,
    cancelled: bool = False,
) -> str:
    company = settings.company_name
    organizer = settings.smtp_user or "no-reply@example.com"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:-//{company}//Interview Scheduling//EN",
        "CALSCALE:GREGORIAN",
        f"METHOD:{'CANCEL' if cancelled else 'REQUEST'}",
        "BEGIN:VEVENT",
        f"UID:interview-{interview.id}@hireai",  # the same id for the invite, its update and its cancellation
        f"DTSTAMP:{ics_time(utc_now())}",
        f"DTSTART:{ics_time(interview.start_at)}",
        f"DTEND:{ics_time(interview.end_at)}",
        f"SUMMARY:{ics_escape(title)}",
        f"DESCRIPTION:{ics_escape(description)}",
        f"LOCATION:{ics_escape(interview.location or '')}",
        f"ORGANIZER;CN={ics_escape(company + ' Talent Acquisition')}:mailto:{organizer}",
    ]
    if attendee_email:
        lines.append(
            f"ATTENDEE;CN={ics_escape(person_name(attendee_name) or attendee_email)};ROLE=REQ-PARTICIPANT;"
            f"PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{attendee_email.strip()}"
        )
    lines += [
        f"STATUS:{'CANCELLED' if cancelled else 'CONFIRMED'}",
        # Each new version must have a higher number, so calendars replace the old one (new time / cancelled)
        f"SEQUENCE:{int(utc_now().timestamp())}",
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Interview in 30 minutes",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(fold(line) for line in lines) + "\r\n"


# ---------- The emails ----------

def send_interview_invites(
    interview: Interview,
    candidate: Candidate,
    db: Session,
    booking_url: str | None = None,
    screening_details: list[dict] | None = None,
    updated: bool = False,
) -> None:
    """The final interview emails: one to the candidate, one to the interviewer, both with a calendar invite."""
    company = settings.company_name
    job_title = candidate.job.title
    when, where = when_text(interview), where_text(interview)
    interviewer = interview.interviewer
    candidate_name = person_name(candidate.name)

    # 1. To the candidate
    opening = (
        f"Your interview for the {job_title} position at {company} has been rescheduled. "
        f"Please find the updated details below."
        if updated
        else f"Thank you for taking the time to speak with us. We are pleased to invite you to an interview "
        f"for the {job_title} position at {company}."
    )
    reschedule = (
        f"\n\nIf this time does not suit you, you may choose another available slot (one change allowed).\n"
        f"→ Choose another time: {booking_url}"
        if booking_url
        else ""
    )
    candidate_body = f"""Dear {first_name(candidate.name)},

{opening}

Interview details
Position: {job_title}
Date and time: {when}
Duration: {duration_text(interview)}
Interviewer: {interviewer_text(interview)}
Location: {where}

A calendar invitation is attached. Please accept it to add the interview to your calendar.{reschedule}

We recommend joining a few minutes early. If you have any questions, simply reply to this email.

We look forward to speaking with you.

{signature()}
"""
    queue_email(
        db, candidate.email, candidate.name,
        f"{'Updated: ' if updated else ''}Interview Invitation – {job_title} | {company}",
        candidate_body,
        ics=make_ics(
            interview,
            f"Interview: {job_title} – {company}",
            f"Interview with {interviewer_text(interview)}. {where}",
            candidate.email, candidate.name,
        ),
        candidate_id=candidate.id, interview_id=interview.id,
    )

    # 2. To the interviewer (with the candidate's prep pack)
    notes = "\n".join(f"- {d['label']}: {d['value']}" for d in (screening_details or []) if d.get("value"))
    score = candidate.evaluation.overall_score if candidate.evaluation else None
    interviewer_body = f"""Hi {first_name(interviewer.name)},

{'An interview on your calendar has been moved to a new time.' if updated else 'A new interview has been scheduled with you.'}

Interview details
Candidate: {candidate_name}
Position: {job_title}
Date and time: {when}
Duration: {duration_text(interview)}
Location: {where}
CV match score: {f"{score}/100" if score is not None else "Not scored"}

Screening call summary
{notes or "- No screening notes available."}

→ View full candidate profile: {settings.frontend_origin}/candidates/{candidate.id}

A calendar invitation is attached.

{signature()}
"""
    queue_email(
        db, interviewer.email, interviewer.name,
        f"{'Updated: ' if updated else ''}Interview Scheduled – {candidate_name}, {job_title} ({short_day(interview)})",
        interviewer_body,
        ics=make_ics(
            interview,
            f"Interview: {candidate_name} ({job_title})",
            f"Candidate: {candidate_name}. {where}",
            interviewer.email, interviewer.name,
        ),
        candidate_id=candidate.id, interview_id=interview.id,
    )


def send_cancellation(interview: Interview, candidate: Candidate, db: Session, notify_candidate: bool) -> None:
    """Tell the interviewer (and, if asked, the candidate) that an interview is cancelled."""
    company = settings.company_name
    job_title = candidate.job.title
    when = when_text(interview)
    interviewer = interview.interviewer
    candidate_name = person_name(candidate.name)

    if notify_candidate:
        queue_email(
            db, candidate.email, candidate.name,
            f"Interview Cancelled – {job_title} | {company}",
            f"""Dear {first_name(candidate.name)},

We are writing to let you know that your interview for the {job_title} position has been cancelled. We sincerely apologise for any inconvenience this may cause.

Cancelled interview
Position: {job_title}
Date and time: {when}

A member of our team will be in touch with you shortly regarding the next steps.

{signature()}
""",
            ics=make_ics(
                interview, f"Interview: {job_title} – {company}", "This interview has been cancelled.",
                candidate.email, candidate.name, cancelled=True,
            ),
            candidate_id=candidate.id, interview_id=interview.id,
        )

    queue_email(
        db, interviewer.email, interviewer.name,
        f"Interview Cancelled – {candidate_name}, {job_title} ({short_day(interview)})",
        f"""Hi {first_name(interviewer.name)},

The following interview has been cancelled. The attached update removes it from your calendar.

Cancelled interview
Candidate: {candidate_name}
Position: {job_title}
Date and time: {when}

No further action is needed from you.

{signature()}
""",
        ics=make_ics(
            interview, f"Interview: {candidate_name} ({job_title})", "This interview has been cancelled.",
            interviewer.email, interviewer.name, cancelled=True,
        ),
        candidate_id=candidate.id, interview_id=interview.id,
    )
