"""In-memory async pub/sub for broadcasting call updates to SSE subscribers.

Keyed by campaign_id. Each subscriber gets its own asyncio.Queue registered
in a module-level dict of sets; publish() fans a payload out to every queue
registered for that campaign.
"""

import asyncio
from typing import AsyncIterator

_subscribers: dict[int, set[asyncio.Queue]] = {}


async def publish(campaign_id: int, payload: dict) -> None:
    """Push payload to every subscriber currently listening on campaign_id."""
    queues = _subscribers.get(campaign_id)
    if not queues:
        return
    for queue in list(queues):
        queue.put_nowait(payload)


async def subscribe(campaign_id: int) -> AsyncIterator[dict]:
    """Yield published payloads for campaign_id until the consumer stops iterating."""
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(campaign_id, set()).add(queue)
    try:
        while True:
            payload = await queue.get()
            yield payload
    finally:
        queues = _subscribers.get(campaign_id)
        if queues is not None:
            queues.discard(queue)
            if not queues:
                _subscribers.pop(campaign_id, None)
