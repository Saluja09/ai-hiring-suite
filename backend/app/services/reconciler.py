"""Background polling reconciler: catches missed webhooks by polling Hunar
for the current state of any call still in a non-terminal status.

Mirrors the field mapping used by app.routers.webhooks so that a reconciled
row looks identical to one updated by a real webhook delivery.
"""

import asyncio
import logging
from datetime import datetime

from sqlmodel import Session, select

from app.clients.hunar import HunarAPIError, HunarClient
from app.config import get_settings
from app.db import engine
from app.events import publish
from app.models import Call

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {"COMPLETED", "NOT_CONNECTED", "FAILED", "CANCELLED"}

_CALL_FIELDS = (
    "status",
    "lifecycle_status",
    "engagement_status",
    "answered_by",
    "duration_seconds",
    "recording_url",
    "result",
)


def _is_terminal(call: Call) -> bool:
    return (call.status in TERMINAL_STATUSES) or (
        call.lifecycle_status in TERMINAL_STATUSES
    )


async def reconcile_pending(session: Session, hunar_client) -> int:
    """Poll Hunar for every non-terminal Call and update+publish its state.

    Returns the number of rows updated.
    """
    calls = session.exec(select(Call)).all()
    pending = [c for c in calls if not _is_terminal(c)]

    updated = 0
    for call in pending:
        try:
            data = await hunar_client.get_call(call.id)
        except HunarAPIError:
            logger.warning("reconciler: failed to poll call %s", call.id)
            continue

        for field in _CALL_FIELDS:
            value = data.get(field)
            if value is not None:
                setattr(call, field, value)
        call.updated_at = datetime.utcnow()

        session.add(call)
        session.commit()
        session.refresh(call)

        update = {
            "id": call.id,
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
        await publish(call.campaign_id, update)
        updated += 1

    return updated


async def reconciler_loop() -> None:
    """Poll for missed webhooks on a fixed interval while an API key is set.

    No-op (returns immediately) when no Hunar API key is configured.
    """
    settings = get_settings()
    if not settings.hunar_api_key:
        return

    interval = getattr(settings, "reconciler_interval_seconds", 30)

    while True:
        try:
            with Session(engine) as session:
                hunar_client = HunarClient(
                    settings.hunar_api_key, settings.hunar_base_url
                )
                await reconcile_pending(session, hunar_client)
        except Exception:
            logger.exception("reconciler_loop: iteration failed")

        await asyncio.sleep(interval)
