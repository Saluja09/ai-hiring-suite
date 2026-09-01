import httpx
import pytest
import respx

from app.clients.hunar import HunarAPIError, HunarClient
from app.schemas import AgentCreate, BulkCallCreate, RecipientData, VoicePersona

BASE_URL = "https://api.voice.hunar.ai/external/v1"


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
@respx.mock
async def test_create_agent_sends_api_key():
    route = respx.post(f"{BASE_URL}/agents/").mock(
        return_value=httpx.Response(200, json={"id": "agent-123"})
    )
    c = HunarClient("KEY", BASE_URL)
    out = await c.create_agent(
        AgentCreate(
            name="Screen",
            voice_persona=VoicePersona.NEHA,
            agent_prompt="ask",
            objective="screen",
            introduction="hi there",
            result_prompt="xyz",
            result_schema={"interested": "boolean"},
        )
    )
    assert out["id"] == "agent-123"
    assert route.calls.last.request.headers["X-API-Key"] == "KEY"


@pytest.mark.anyio
@respx.mock
async def test_create_agent_raises_hunar_api_error_on_422():
    respx.post(f"{BASE_URL}/agents/").mock(
        return_value=httpx.Response(422, json={"detail": "invalid"})
    )
    c = HunarClient("KEY", BASE_URL)
    with pytest.raises(HunarAPIError) as exc_info:
        await c.create_agent(
            AgentCreate(
                name="Screen",
                voice_persona=VoicePersona.NEHA,
                agent_prompt="ask",
                objective="screen",
                introduction="hi there",
                result_prompt="xyz",
                result_schema={"interested": "boolean"},
            )
        )
    assert exc_info.value.status == 422
    assert exc_info.value.body == {"detail": "invalid"}


@pytest.mark.anyio
@respx.mock
async def test_create_bulk_calls_posts_to_bulk_endpoint():
    route = respx.post(f"{BASE_URL}/calls/bulk/").mock(
        return_value=httpx.Response(200, json={"created": 1})
    )
    c = HunarClient("KEY", BASE_URL)
    out = await c.create_bulk_calls(
        BulkCallCreate(
            agent_id="agent-123",
            data=[
                RecipientData(callee_name="John", mobile_number="+919999999999")
            ],
        )
    )
    assert out["created"] == 1
    assert route.called
    assert route.calls.last.request.headers["X-API-Key"] == "KEY"


@pytest.mark.anyio
@respx.mock
async def test_get_call_gets_by_id():
    respx.get(f"{BASE_URL}/calls/call-1/").mock(
        return_value=httpx.Response(200, json={"id": "call-1", "status": "COMPLETED"})
    )
    c = HunarClient("KEY", BASE_URL)
    out = await c.get_call("call-1")
    assert out["id"] == "call-1"


@pytest.mark.anyio
@respx.mock
async def test_list_numbers_unwraps_paginated_results():
    respx.get(f"{BASE_URL}/numbers/").mock(
        return_value=httpx.Response(
            200,
            json={
                "count": 2,
                "next": None,
                "previous": None,
                "results": [{"number": "+1"}, {"number": "+2"}],
            },
        )
    )
    c = HunarClient("KEY", BASE_URL)
    out = await c.list_numbers()
    assert out == [{"number": "+1"}, {"number": "+2"}]


@pytest.mark.anyio
@respx.mock
async def test_list_numbers_returns_plain_list_as_is():
    respx.get(f"{BASE_URL}/numbers/").mock(
        return_value=httpx.Response(200, json=[{"number": "+1"}])
    )
    c = HunarClient("KEY", BASE_URL)
    out = await c.list_numbers()
    assert out == [{"number": "+1"}]
