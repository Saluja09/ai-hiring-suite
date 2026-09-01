from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlmodel import Session, select

from app.config import get_settings
from app.db import engine
from app.events import publish
from app.models import Call, WebhookEvent
from app.security.hmac import verify_signature

router = APIRouter()

_CALL_FIELDS = (
    "status",
    "lifecycle_status",
    "engagement_status",
    "answered_by",
    "duration_seconds",
    "recording_url",
    "result",
)


@router.post("/webhooks/hunar")
async def hunar_webhook(request: Request):
    raw_body = await request.body()

    settings = get_settings()
    keys = [settings.hunar_api_key] if settings.hunar_api_key else []

    signature_valid = None
    if keys:
        signature_valid = verify_signature(
            raw_body,
            request.headers.get("X-Hunar-Signature", ""),
            request.headers.get("X-Hunar-Timestamp", ""),
            keys,
        )
        if not signature_valid:
            return JSONResponse(status_code=401, content={"status": "invalid_signature"})

    payload = await request.json()
    call_id = payload.get("call_id")
    event_type = payload.get("event_type")

    with Session(engine) as session:
        existing = session.exec(
            select(WebhookEvent).where(
                WebhookEvent.call_id == call_id,
                WebhookEvent.event_type == event_type,
            )
        ).first()
        if existing is not None:
            return {"status": "duplicate"}

        session.add(
            WebhookEvent(
                call_id=call_id,
                event_type=event_type,
                raw_payload=payload,
                signature_valid=signature_valid,
            )
        )
        session.commit()

        call = session.get(Call, call_id) if call_id else None
        if call is None:
            return {"status": "ok"}

        for field in _CALL_FIELDS:
            value = payload.get(field)
            if value is not None:
                setattr(call, field, value)
        call.updated_at = datetime.utcnow()

        session.add(call)
        session.commit()
        session.refresh(call)

        campaign_id = call.campaign_id
        update = {
            "call_id": call.id,
            "campaign_id": call.campaign_id,
            "candidate_id": call.candidate_id,
            "status": call.status,
            "lifecycle_status": call.lifecycle_status,
            "engagement_status": call.engagement_status,
            "answered_by": call.answered_by,
            "duration_seconds": call.duration_seconds,
            "recording_url": call.recording_url,
            "result": call.result,
        }

    await publish(campaign_id, update)

    return {"status": "ok"}
