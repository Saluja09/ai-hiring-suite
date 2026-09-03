from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.routers.calls import get_hunar_client
from app.schemas import AgentCreate, VoiceLanguage, VoicePersona
from app.services.attendance import build_attendance_agent


class FakeHunar:
    """Stubs the two Hunar calls the rollcall route makes."""

    async def create_agent(self, agent):
        return {"id": "agent-rollcall-1"}

    async def create_call(self, call):
        return {
            "id": "call-rollcall-1",
            "callee_name": call.callee_name,
            "mobile_number": call.mobile_number,
            "status": "SCHEDULED",
        }


def test_rollcall_route_creates_campaign_and_call(monkeypatch):
    # Drives the FULL /api/attendance/rollcall route end-to-end (with Hunar
    # stubbed) so session-scoping / serialization bugs are caught — the
    # build_attendance_agent unit test alone never exercised the handler.
    monkeypatch.setenv("HUNAR_API_KEY", "")
    monkeypatch.setenv("PUBLIC_BASE_URL", "")
    init_db()
    app.dependency_overrides[get_hunar_client] = lambda: FakeHunar()
    try:
        client = TestClient(app)
        resp = client.post(
            "/api/attendance/rollcall",
            json={
                "location": "Warehouse A",
                "supervisor_phone": "8837518407",
                "worker_names": ["Asha", "Ravi", "Priya", "Kiran"],
                "language": "ENGLISH",
                "voice_persona": "NEHA",
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["agent_id"] == "agent-rollcall-1"
        assert isinstance(body["campaign_id"], int)
        assert body["call"]["id"] == "call-rollcall-1"
        assert body["call"]["mobile_number"] == "+918837518407"
        assert body["call"]["status"] == "SCHEDULED"
    finally:
        app.dependency_overrides.clear()


def test_build_attendance_agent_returns_valid_agent_create():
    agent = build_attendance_agent(
        "Warehouse A",
        ["Asha", "Ravi"],
        VoiceLanguage.ENGLISH,
        VoicePersona.NEHA,
    )

    assert isinstance(agent, AgentCreate)
    assert set(agent.result_schema.keys()) == {"present", "absent", "late", "notes"}
    assert all(v == "string" for v in agent.result_schema.values())
    assert "{callee_name}" in agent.introduction or "Warehouse A" in agent.introduction
    assert "Warehouse A" in agent.name
    assert "Asha" in agent.agent_prompt
    assert "Ravi" in agent.agent_prompt
    assert agent.voice_persona == VoicePersona.NEHA
    assert agent.language == VoiceLanguage.ENGLISH
