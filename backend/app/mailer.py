"""
Agent 3, step 8: send the queued Outbox emails for real, with Gmail.

How it works:
- emails.py writes every email into the Outbox as "queued"
- a small background loop (started in main.py) calls send_queued_emails() every few seconds
- it logs in to Gmail once, sends every queued email, and marks each one:
  "sent" (with the time) or "failed" (with the reason, so HR can see it and retry)
- if Gmail can't be reached right now, emails simply stay "queued" and are tried again later
"""

import asyncio
import html
import logging
import re
import smtplib
import ssl
import threading
from email.message import EmailMessage
from email.utils import formataddr

from sqlalchemy import select, update

from app.config import settings
from app.database import SessionLocal
from app.models import EmailOutbox, utc_now

log = logging.getLogger("uvicorn.error")  # shows up in the normal uvicorn terminal

SEND_EVERY_SECONDS = 10

# Only one sending round at a time (the background loop and the Send button),
# so the same email can never go out twice
_sending = threading.Lock()


def gmail_ready() -> bool:
    """True only when sending is switched on AND the Gmail login is in .env."""
    return settings.email_sending_enabled and bool(settings.smtp_user and settings.smtp_password)


# ---------- The HTML version of an email ----------
# Plain "real email" style, like a recruiter typed it in Gmail: normal font, no banner,
# no colored boxes. Only small touches: bold labels, a bold heading, normal links.

DETAIL_LINE = re.compile(r"^([A-Z][A-Za-z ()/]{1,28}): (.+)$")
LINK_LINE = re.compile(r"^→ (.+?): (https?://\S+)$")
URL = re.compile(r"(https?://[^\s<]+)")
SIGN_OFFS = ("kind regards,", "best regards,", "regards,", "thank you,")
P = "margin:0 0 14px;"


def _text(value: str) -> str:
    """Escape the text and turn web addresses into normal links."""
    return URL.sub(lambda m: f'<a href="{m.group(1)}">{m.group(1)}</a>', html.escape(value))


def _is_heading(line: str) -> bool:
    """A short line with no end punctuation, e.g. "Interview details"."""
    return len(line) < 40 and line[-1] not in ",.:;!?" and ":" not in line and not line.startswith(("- ", "→"))


def _line(line: str) -> str:
    link = LINK_LINE.match(line)
    if link:  # "→ Choose another time: URL" → a normal link with that text
        return f'<a href="{html.escape(link.group(2))}">{html.escape(link.group(1))}</a>'
    detail = DETAIL_LINE.match(line)
    if detail:  # "When: ..." → "<b>When:</b> ..."
        return f"<b>{html.escape(detail.group(1))}:</b> {_text(detail.group(2))}"
    return _text(line)


def _block(lines: list[str]) -> str:
    """One paragraph: an optional bold heading, then normal lines and bullet lists."""
    parts: list[str] = []
    if len(lines) > 1 and _is_heading(lines[0]) and lines[0].lower() not in SIGN_OFFS:
        parts.append(f"<b>{html.escape(lines[0])}</b>")
        lines = lines[1:]
    elif len(lines) == 1 and _is_heading(lines[0]):
        return f'<p style="margin:0 0 4px;"><b>{html.escape(lines[0])}</b></p>'

    html_out, text_lines, bullets = "", parts, []
    for line in lines + [""]:  # the empty line at the end flushes the last group
        if line.startswith("- "):
            bullets.append(f"<li>{_text(line[2:])}</li>")
            continue
        if bullets:
            if text_lines:
                html_out += f'<p style="margin:0 0 4px;">{"<br>".join(text_lines)}</p>'
                text_lines = []
            html_out += f'<ul style="margin:0 0 14px;padding-left:22px;">{"".join(bullets)}</ul>'
            bullets = []
        if line:
            text_lines.append(_line(line))
    if text_lines:
        html_out += f'<p style="{P}">{"<br>".join(text_lines)}</p>'
    return html_out


def render_html(email: EmailOutbox) -> str:
    blocks = []
    for paragraph in re.split(r"\n\s*\n", email.body.strip()):
        lines = [line.strip() for line in paragraph.splitlines() if line.strip()]
        if lines:
            blocks.append(_block(lines))

    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>'
        '<body><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222222;">'
        f'{"".join(blocks)}'
        "</div></body></html>"
    )


def build_message(email: EmailOutbox) -> EmailMessage:
    """Turn one Outbox row into a real email: plain text + simple HTML + the calendar invite."""
    from_name = settings.email_from_name or f"{settings.company_name} Careers"
    message = EmailMessage()
    message["From"] = formataddr((from_name, settings.smtp_user))
    message["To"] = formataddr((email.to_name or "", email.to_email))
    message["Subject"] = email.subject
    message["Content-Language"] = "en"
    message.set_content(email.body)                          # for email apps that only show plain text
    message.add_alternative(render_html(email), subtype="html")  # what Gmail / Outlook show

    if email.ics:
        method = "CANCEL" if "METHOD:CANCEL" in email.ics else "REQUEST"
        message.add_attachment(
            email.ics.encode("utf-8"),
            maintype="text",
            subtype="calendar",
            filename="cancel.ics" if method == "CANCEL" else "invite.ics",
            params={"method": method},
        )
    return message


def send_queued_emails(limit: int = 20) -> int:
    """Send up to `limit` queued emails. Returns how many were sent."""
    if not gmail_ready():
        return 0
    with _sending:
        return _send_round(limit)


def _send_round(limit: int) -> int:
    db = SessionLocal()
    sent = 0
    try:
        emails = db.scalars(
            select(EmailOutbox)
            .where(EmailOutbox.status == "queued")
            .order_by(EmailOutbox.id)
            .limit(limit)
        ).all()
        if not emails:
            return 0

        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=context, timeout=30) as server:
            server.login(settings.smtp_user, settings.smtp_password)

            for email in emails:
                try:
                    server.send_message(build_message(email))
                    email.status = "sent"
                    email.sent_at = utc_now()
                    email.error = None
                    sent += 1
                except smtplib.SMTPServerDisconnected:
                    raise  # connection lost: stop, the rest stay "queued" for next time
                except smtplib.SMTPException as exc:
                    # Gmail refused THIS email (e.g. a wrong address): mark it, go on with the rest
                    email.status = "failed"
                    email.error = f"Gmail refused this email: {exc}"
                db.commit()  # save after every email, so nothing is sent twice

        if sent:
            log.info("Gmail: sent %s email(s)", sent)

    except smtplib.SMTPAuthenticationError:
        log.error("Gmail login failed. Check SMTP_USER and SMTP_PASSWORD (the 16-letter App Password) in .env")
    except (OSError, smtplib.SMTPException) as exc:
        log.warning("Could not reach Gmail right now, will try again later: %s", exc)
    finally:
        db.close()

    return sent


def hold_old_test_emails() -> int:
    """
    Run once when the backend starts.
    Emails that were queued BEFORE Gmail was switched on are old test emails:
    they get the status "held" so they never surprise anyone. HR can still send one
    with the Send button on the Outbox page.
    """
    db = SessionLocal()
    try:
        result = db.execute(
            update(EmailOutbox)
            .where(EmailOutbox.status == "queued", EmailOutbox.created_at < utc_now())
            .values(status="held", error="Written before Gmail sending was switched on. Not sent automatically.")
        )
        db.commit()
        return result.rowcount or 0
    finally:
        db.close()


async def email_sender_loop() -> None:
    """Runs in the background while the backend is running: sends new emails every few seconds."""
    if not gmail_ready():
        log.info("Gmail sending is OFF: emails stay in the Outbox (set EMAIL_SENDING_ENABLED=true in .env)")
        return

    held = await asyncio.to_thread(hold_old_test_emails)
    log.info("Gmail sending is ON (%s). Old queued emails held: %s", settings.smtp_user, held)

    while True:
        try:
            await asyncio.to_thread(send_queued_emails)
        except Exception:  # never let one bad round stop the loop
            log.exception("Email sender round failed")
        await asyncio.sleep(SEND_EVERY_SECONDS)
