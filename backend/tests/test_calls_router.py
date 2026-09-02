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


class FakeHunarNoAgentId:
    async def create_agent(self, agent_create):
        return {"name": agent_create.name}


class FakeHunarPartialCallIds:
    def __init__(self):
        self.received_payload = None

    async def create_bulk_calls(self, payload):
        self.received_payload = payload
        return {
            "data": [
                {
                    "id": "call-good",
                    "mobile_number": payload.data[0].mobile_number,
                    "status": "SCHEDULED",
                },
                {
                    "mobile_number": payload.data[1].mobile_number,
                    "status": "SCHEDULED",
                },
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
    assert r.json()[0]["callee_name"] == "A"


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


def test_create_agent_missing_id_returns_5xx_and_persists_nothing(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")
    get_settings.cache_clear()
    from sqlmodel import Session, select

    from app.db import engine, init_db
    from app.models import Campaign

    init_db()
    fake = FakeHunarNoAgentId()
    app.dependency_overrides[get_hunar_client] = lambda: fake
    client = TestClient(app)
    r = client.post(
        "/api/agents",
        json={
            "name": "no-id-agent",
            "language": "ENGLISH",
            "voice_persona": "NEHA",
            "persona_name": "Ava",
            "agent_prompt": "prompt",
            "objective": "objective",
            "introduction": "intro",
            "result_prompt": "result",
            "result_schema": {"field": "string"},
        },
    )
    app.dependency_overrides.clear()
    assert r.status_code >= 500
    with Session(engine) as s:
        rows = s.exec(select(Campaign).where(Campaign.name == "no-id-agent")).all()
        assert all(row.agent_id for row in rows)


def test_create_calls_skips_row_with_missing_id_but_persists_good_row(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://api.example.com")
    get_settings.cache_clear()
    from sqlmodel import Session, select

    from app.db import engine, init_db
    from app.models import Call

    init_db()
    fake = FakeHunarPartialCallIds()
    app.dependency_overrides[get_hunar_client] = lambda: fake
    client = TestClient(app)
    cid = _seed_campaign()
    r = client.post(
        f"/api/campaigns/{cid}/calls",
        json=[
            {"name": "Good", "phone": "8837518407", "custom_data": {}},
            {"name": "Bad", "phone": "8837518408", "custom_data": {}},
        ],
    )
    app.dependency_overrides.clear()
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 2
    bad_entries = [row for row in body if row.get("error") == "missing call id"]
    assert len(bad_entries) == 1
    assert bad_entries[0]["callee_name"] == "Bad"
    good_entries = [row for row in body if row.get("error") != "missing call id"]
    assert good_entries[0]["callee_name"] == "Good"
    with Session(engine) as s:
        rows = s.exec(select(Call).where(Call.id == "call-good")).all()
        assert len(rows) == 1
