import json

from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.events import subscribe

router = APIRouter()


@router.get("/stream/{campaign_id}")
async def stream_campaign(campaign_id: int, request: Request):
    async def event_generator():
        async for payload in subscribe(campaign_id):
            if await request.is_disconnected():
                break
            yield {"data": json.dumps(payload)}

    return EventSourceResponse(event_generator())
