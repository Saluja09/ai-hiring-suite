import pytest
from sqlmodel import Session

from app.db import engine
from app.models import Call, Campaign
from app.services.reconciler import reconcile_pending


@pytest.fixture
def anyio_backend():
    return "asyncio"


class FakeHunarClient:
    def __init__(self, responses=None, raise_error=False):
        self.responses = responses or {}
        self.calls = []
        self.raise_error = raise_error

    async def get_call(self, call_id: str) -> dict:
        self.calls.append(call_id)
        if self.raise_error:
            from app.clients.hunar import HunarAPIError

            raise HunarAPIError(500, "boom")
        return self.responses[call_id]


@pytest.mark.anyio
async def test_reconcile_pending_updates_non_terminal_call():
    with Session(engine) as s:
        c = Campaign(name="x", kind="hiring")
        s.add(c)
        s.commit()
        s.refresh(c)
        s.add(Call(id="call-recon-1", campaign_id=c.id, status="IN_PROGRESS"))
        s.commit()

    fake = FakeHunarClient(
        responses={
            "call-recon-1": {
                "status": "COMPLETED",
                "result": {"interested": True},
            }
        }
    )

    with Session(engine) as s:
        count = await reconcile_pending(s, fake)

    assert count == 1
    assert fake.calls == ["call-recon-1"]

    with Session(engine) as s:
        call = s.get(Call, "call-recon-1")
        assert call.status == "COMPLETED"
        assert call.result == {"interested": True}


@pytest.mark.anyio
async def test_reconcile_pending_skips_terminal_calls():
    with Session(engine) as s:
        c = Campaign(name="y", kind="hiring")
        s.add(c)
        s.commit()
        s.refresh(c)
        s.add(Call(id="call-recon-2", campaign_id=c.id, status="COMPLETED"))
        s.commit()

    fake = FakeHunarClient(raise_error=True)

    with Session(engine) as s:
        count = await reconcile_pending(s, fake)

    assert count == 0
    assert fake.calls == []
