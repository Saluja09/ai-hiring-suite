from app.schemas import AgentCreate, VoiceLanguage, VoicePersona
from app.services.attendance import build_attendance_agent


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
