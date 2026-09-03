from app.config import get_settings


def test_webhook_publishes_update_keyed_by_id(monkeypatch):
    """Regression test: the SSE payload published on a webhook must carry the
    call id under the key "id" (matching frontend CallRow.id), not only
    "call_id" — otherwise the live dashboard never merges the update in.
    """
    monkeypatch.setenv("HUNAR_API_KEY", "")  # no keys -> skip signature
    get_settings.cache_clear()
    from app.main import app
    from app.db import init_db

    init_db()
    from fastapi.testclient import TestClient

    client = TestClient(app)
    from app.db import engine
    from sqlmodel import Session
    from app.models import Call, Campaign
    import app.routers.webhooks as webhooks_module

    with Session(engine) as s:
        c = Campaign(name="z", kind="hiring")
        s.add(c)
        s.commit()
        s.refresh(c)
        s.add(Call(id="call-id-key", campaign_id=c.id, status="IN_PROGRESS"))
        s.commit()

    published = {}

    async def fake_publish(campaign_id, payload):
        published["campaign_id"] = campaign_id
        published["payload"] = payload

    monkeypatch.setattr(webhooks_module, "publish", fake_publish)

    r = client.post(
        "/webhooks/hunar",
        json={
            "event_type": "call_result",
            "call_id": "call-id-key",
            "status": "COMPLETED",
            "result": {"interested": True},
        },
    )
    assert r.status_code == 200
    assert "payload" in published
    assert published["payload"]["id"] == "call-id-key"


def test_webhook_updates_call_result(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")  # no keys -> skip signature
    get_settings.cache_clear()
    from app.main import app
    from app.db import init_db

    init_db()
    from fastapi.testclient import TestClient

    client = TestClient(app)
    # seed a call
    from app.db import engine
    from sqlmodel import Session
    from app.models import Call, Campaign

    with Session(engine) as s:
        c = Campaign(name="x", kind="hiring")
        s.add(c)
        s.commit()
        s.refresh(c)
        s.add(Call(id="call-9", campaign_id=c.id, status="IN_PROGRESS"))
        s.commit()
        cid = c.id
    r = client.post(
        "/webhooks/hunar",
        json={
            "event_type": "call_result",
            "call_id": "call-9",
            "status": "COMPLETED",
            "result": {"interested": True},
        },
    )
    assert r.status_code == 200
    with Session(engine) as s:
        call = s.get(Call, "call-9")
        assert call.status == "COMPLETED"
        assert call.result == {"interested": True}


def test_webhook_duplicate_delivery_is_idempotent(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")  # no keys -> skip signature
    get_settings.cache_clear()
    from app.main import app
    from app.db import init_db

    init_db()
    from fastapi.testclient import TestClient

    client = TestClient(app)
    from app.db import engine
    from sqlmodel import Session, select
    from app.models import Call, Campaign, WebhookEvent

    with Session(engine) as s:
        c = Campaign(name="y", kind="hiring")
        s.add(c)
        s.commit()
        s.refresh(c)
        s.add(Call(id="call-dup", campaign_id=c.id, status="IN_PROGRESS"))
        s.commit()

    payload = {
        "event_type": "call_result",
        "call_id": "call-dup",
        "status": "COMPLETED",
        "result": {"interested": False},
    }
    r1 = client.post("/webhooks/hunar", json=payload)
    assert r1.status_code == 200
    assert r1.json()["status"] == "ok"

    r2 = client.post("/webhooks/hunar", json=payload)
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"

    with Session(engine) as s:
        events = s.exec(
            select(WebhookEvent).where(
                WebhookEvent.call_id == "call-dup",
                WebhookEvent.event_type == "call_result",
            )
        ).all()
        assert len(events) == 1
