"""Tests for domain schemas mirroring the Hunar API contract."""

from app.schemas import AgentCreate, RecipientData, VoicePersona
import pytest


def test_agent_create_requires_result_schema():
    """Test that AgentCreate accepts a valid result_schema."""
    a = AgentCreate(
        name="Screen",
        voice_persona=VoicePersona.NEHA,
        agent_prompt="ask x",
        objective="screen",
        introduction="hello",
        result_prompt="extract",
        result_schema={"interested": "boolean"},
    )
    assert a.result_schema == {"interested": "boolean"}


def test_recipient_custom_data_str_values():
    """Test that RecipientData custom_data stores string values."""
    r = RecipientData(
        callee_name="A",
        mobile_number="+918837518407",
        custom_data={"job_role": "Rider"},
    )
    assert r.custom_data["job_role"] == "Rider"


def test_agent_create_without_result_prompt_succeeds():
    """Test that AgentCreate can be constructed without result_prompt."""
    a = AgentCreate(
        name="Screening Agent",
        voice_persona=VoicePersona.NEHA,
        agent_prompt="ask things",
        objective="screen",
        introduction="hi there",
        result_schema={"interested": "boolean"},
    )
    assert a.result_prompt is None


def test_empty_result_schema_raises_validation_error():
    """Test that an empty result_schema raises a validation error."""
    with pytest.raises(ValueError):
        AgentCreate(
            name="Screen",
            voice_persona=VoicePersona.NEHA,
            agent_prompt="ask x",
            objective="screen",
            introduction="hi",
            result_prompt="extract",
            result_schema={},
        )
