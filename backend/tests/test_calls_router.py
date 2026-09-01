from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.routers.calls import get_hunar_client


class FakeHunar:
    def __init__(self, call_id="call-1"):
        self.received_payload = None
        self.call_id = call_id

    async def create_bulk_calls(self, payload):
        self.received_payload = payload
        return {
            "data": [
                {
                    "id": self.call_id,
                    "mobile_number": payload.data[0].mobile_number,
                    "status": "SCHEDULED",
                }
            ]
        }


def _seed_campaign():
    from app.db import engine
    from sqlmodel import Session
    from app.models import Campaign

    with Session(engine) as s:
        c = Campaign(name="x", kind="hiring", agent_id="agent-1")
        s.add(c)
        s.commit()
        s.refresh(c)
        return c.id


def test_create_calls_normalizes_and_injects_callback(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://api.example.com")
    get_settings.cache_clear()
    from app.db import init_db

    init_db()
    fake = FakeHunar()
    app.dependency_overrides[get_hunar_client] = lambda: fake
    client = TestClient(app)
    cid = _seed_campaign()
    r = client.post(
        f"/api/campaigns/{cid}/calls",
        json=[{"name": "A", "phone": "8837518407", "custom_data": {"job_role": "Rider"}}],
    )
    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json()[0]["mobile_number"] == "+918837518407"


def test_create_calls_injects_public_base_url_callback(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://api.example.com")
    get_settings.cache_clear()
    from app.db import init_db

    init_db()
    fake = FakeHunar(call_id="call-2")
    app.dependency_overrides[get_hunar_client] = lambda: fake
    client = TestClient(app)
    cid = _seed_campaign()
    r = client.post(
        f"/api/campaigns/{cid}/calls",
        json=[{"name": "A", "phone": "8837518407", "custom_data": {"job_role": "Rider"}}],
    )
    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert fake.received_payload is not None
    callback_config = fake.received_payload.callback_config
    assert callback_config is not None
    assert callback_config["call_status_callback_url"] == "https://api.example.com/webhooks/hunar"
    assert callback_config["call_result_callback_url"] == "https://api.example.com/webhooks/hunar"
    assert callback_config["call_summary_callback_url"] == "https://api.example.com/webhooks/hunar"
