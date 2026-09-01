from app.config import get_settings
from app.schemas import VoiceLanguage, VoicePersona
from app.services.jd import build_agent_from_jd, parse_search_params
from app.services.llm import complete

JD = "Hiring Delivery Riders in Bangalore. Must have own bike, 1+ year experience. Immediate joiners."


def test_build_agent_defaults_deterministic(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    get_settings.cache_clear()
    a = build_agent_from_jd(
        JD,
        language=VoiceLanguage.ENGLISH,
        voice_persona=VoicePersona.NEHA,
        company="Zap",
    )
    assert a.result_schema and len(a.result_schema) >= 1
    assert "{callee_name}" in a.introduction or "Zap" in a.introduction
    assert a.name


def test_parse_search_params_extracts_location():
    p = parse_search_params(JD)
    assert any("angalore" in loc for loc in p["locations"])


def test_llm_complete_returns_none_when_provider_none(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    get_settings.cache_clear()
    assert complete("hello") is None
