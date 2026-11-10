"""
Talking to Vapi's API from the backend (with the PRIVATE key, never from the browser).

After a voice call ends, we fetch the transcript straight from Vapi, so the
browser can't send us a fake one.
"""

import httpx

from app.config import settings

VAPI_API_URL = "https://api.vapi.ai"


def fetch_vapi_call(vapi_call_id: str) -> dict:
    """Get one call from Vapi: its status, messages, and more."""
    if not settings.vapi_private_key:
        raise RuntimeError("VAPI_PRIVATE_KEY is missing in backend/.env")
    response = httpx.get(
        f"{VAPI_API_URL}/call/{vapi_call_id}",
        headers={"Authorization": f"Bearer {settings.vapi_private_key}"},
        timeout=15,
    )
    response.raise_for_status()  # 4xx/5xx → error
    return response.json()


def to_transcript(vapi_call: dict) -> list[dict]:
    """Turn Vapi's messages into our format: [{"role": "agent" or "candidate", "text": "..."}]."""
    messages = vapi_call.get("messages") or (vapi_call.get("artifact") or {}).get("messages") or []
    transcript = []
    for message in messages:
        role = message.get("role")
        text = (message.get("message") or message.get("content") or "").strip()
        if not text:
            continue
        if role in ("bot", "assistant"):
            transcript.append({"role": "agent", "text": text})
        elif role == "user":
            transcript.append({"role": "candidate", "text": text})
        # system / tool messages are skipped: they are not part of the conversation
    return transcript


def call_metadata(vapi_call: dict) -> dict:
    """The metadata we sent when the call started (if Vapi returns it)."""
    assistant = vapi_call.get("assistant") or {}
    return assistant.get("metadata") or vapi_call.get("metadata") or {}
