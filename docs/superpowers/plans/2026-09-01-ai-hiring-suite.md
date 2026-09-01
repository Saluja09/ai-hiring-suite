# AI Hiring Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified Next.js + FastAPI app that turns a job description into a live multilingual Hunar voice agent, triggers calls, and streams structured conversation answers into a dashboard — covering the hiring assistant, people search & reachout, and no-smartphone attendance deliverables.

**Architecture:** FastAPI backend wraps the Hunar Voice API (agents/calls/webhooks), persists to SQLite, and streams updates to a Next.js + shadcn/ui frontend over SSE. A people-search adapter (mock-first, PDL-optional) feeds the same call/dashboard engine. The Hunar API key lives only in the backend env — never in the frontend or git.

**Tech Stack:** Python 3.11+, FastAPI, SQLModel, httpx, respx (tests), pytest; Next.js 14 (App Router) + TypeScript + shadcn/ui + Tailwind; Groq/Gemini free-tier LLM with deterministic fallback.

**Spec:** `docs/superpowers/specs/2026-09-01-ai-hiring-suite-design.md`

## Global Constraints

- Language: TypeScript on frontend (never plain JS); Python on backend (preferred over Node).
- UI kit: shadcn/ui components + Tailwind.
- Hunar API base: `https://api.voice.hunar.ai/external/v1/`; auth header `X-API-Key`. Contract file: `docs/hunar-openapi.json`.
- `HUNAR_API_KEY` and all provider keys: backend `.env` only (gitignored). `.env.example` holds placeholders. Never commit a real key; never expose to frontend.
- Hunar `result_schema` = flat JSON object `{field: "string"|"number"|"boolean"}`, min 1 property.
- Hunar `custom_data` values MUST be strings.
- All phone numbers E.164 (India default `+91`). Test target: `+918837518407`.
- Voice personas: NEHA, ROY, ZOE, SAM, MIRA, EESHA. Languages: ENGLISH, HINDI, TAMIL, TELUGU, KANNADA, MARATHI, MALAYALAM, GUJARATI, BENGALI, TURKISH, ARABIC, SPANISH.
- Webhook HMAC: SHA-256 over `"{timestamp}.{raw_body}"`, header `X-Hunar-Signature` (base64, comma-separated per key), `X-Hunar-Timestamp`; reject if outside 300s; constant-time compare.
- Commit author: `saluja09 <saluja09@users.noreply.github.com>`. No Claude co-author trailer anywhere.
- TDD: every code task is failing-test → run → implement → run → commit.

---

## Phase A — Shared engine (must work end-to-end before any flow)

### Task 1: Backend scaffold + config

**Files:**
- Create: `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/main.py`, `backend/.env.example`, `backend/tests/__init__.py`, `backend/tests/test_config.py`
- Test: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `Settings` (pydantic-settings) with fields `hunar_api_key: str`, `hunar_base_url: str = "https://api.voice.hunar.ai/external/v1"`, `public_base_url: str = ""`, `llm_provider: str = "none"`, `groq_api_key: str = ""`, `gemini_api_key: str = ""`, `pdl_api_key: str = ""`, `database_url: str = "sqlite:///./app.db"`, `cors_origins: str = "*"`. `get_settings() -> Settings` (cached). FastAPI `app` in `main.py` with `GET /health → {"status":"ok"}`.

- [ ] **Step 1: Write the failing test**
```python
# backend/tests/test_config.py
from app.config import get_settings

def test_settings_defaults(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "test_key")
    get_settings.cache_clear()
    s = get_settings()
    assert s.hunar_api_key == "test_key"
    assert s.hunar_base_url.endswith("/external/v1")
    assert s.database_url.startswith("sqlite")
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: FAIL (module `app.config` not found).

- [ ] **Step 3: Write pyproject + config + main**
`pyproject.toml` deps: `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlmodel`, `httpx`, `sse-starlette`; dev: `pytest`, `respx`, `anyio`. Set `[tool.pytest.ini_options] pythonpath = ["."]`.
```python
# backend/app/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    hunar_api_key: str = ""
    hunar_base_url: str = "https://api.voice.hunar.ai/external/v1"
    public_base_url: str = ""
    llm_provider: str = "none"
    groq_api_key: str = ""
    gemini_api_key: str = ""
    pdl_api_key: str = ""
    database_url: str = "sqlite:///./app.db"
    cors_origins: str = "*"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```
```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings

app = FastAPI(title="AI Hiring Suite")
app.add_middleware(CORSMiddleware, allow_origins=get_settings().cors_origins.split(","),
                   allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health():
    return {"status": "ok"}
```
`.env.example`: `HUNAR_API_KEY=your_hunar_key_here` plus every other Settings field with placeholder values, no real secrets.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/pyproject.toml backend/app backend/tests backend/.env.example
git commit -m "feat: backend scaffold with settings and health endpoint"
```

---

### Task 2: Domain schemas mirroring the Hunar contract

**Files:**
- Create: `backend/app/schemas.py`, `backend/tests/test_schemas.py`
- Test: `backend/tests/test_schemas.py`

**Interfaces:**
- Produces: pydantic models — `AgentCreate` (fields: `name`, `language`, `voice_persona`, `persona_name`, `agent_prompt`, `objective`, `introduction`, `result_prompt`, `result_schema: dict`); `RecipientData` (`callee_name`, `mobile_number`, `custom_data: dict[str,str]`); `CallCreate` (adds `agent_id`, `callback_config`, `from_phone_number`, `request_id`); `BulkCallCreate` (`agent_id`, `data: list[RecipientData]`, flags); enums `VoicePersona`, `VoiceLanguage`, `CallStatus`. All field names match `docs/hunar-openapi.json` exactly.

- [ ] **Step 1: Write the failing test**
```python
# backend/tests/test_schemas.py
from app.schemas import AgentCreate, RecipientData, VoicePersona

def test_agent_create_requires_result_schema():
    a = AgentCreate(name="Screen", voice_persona=VoicePersona.NEHA,
                    agent_prompt="ask x", objective="screen", introduction="hi",
                    result_prompt="extract", result_schema={"interested": "boolean"})
    assert a.result_schema == {"interested": "boolean"}

def test_recipient_custom_data_str_values():
    r = RecipientData(callee_name="A", mobile_number="+918837518407",
                      custom_data={"job_role": "Rider"})
    assert r.custom_data["job_role"] == "Rider"
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd backend && python -m pytest tests/test_schemas.py -v` — FAIL (no `app.schemas`).

- [ ] **Step 3: Implement schemas.py**
Define the enums from Global Constraints, then the pydantic models above. `result_schema: dict` with a validator requiring ≥1 key. `custom_data: dict[str, str]`.

- [ ] **Step 4: Run test** — Run: `cd backend && python -m pytest tests/test_schemas.py -v` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/schemas.py backend/tests/test_schemas.py
git commit -m "feat: pydantic schemas mirroring Hunar API contract"
```

---

### Task 3: Phone normalization utility

**Files:**
- Create: `backend/app/utils/phone.py`, `backend/tests/test_phone.py`

**Interfaces:**
- Produces: `to_e164(raw: str, default_cc: str = "91") -> str` (raises `ValueError` on invalid); `is_e164(s: str) -> bool`.

- [ ] **Step 1: Write the failing test**
```python
# backend/tests/test_phone.py
import pytest
from app.utils.phone import to_e164, is_e164

def test_bare_indian_number():
    assert to_e164("8837518407") == "+918837518407"

def test_already_e164():
    assert to_e164("+918837518407") == "+918837518407"

def test_strips_spaces_and_dashes():
    assert to_e164("88375-18407") == "+918837518407"

def test_invalid_raises():
    with pytest.raises(ValueError):
        to_e164("12")

def test_is_e164():
    assert is_e164("+918837518407") and not is_e164("8837518407")
```

- [ ] **Step 2: Run** — `cd backend && python -m pytest tests/test_phone.py -v` — FAIL.

- [ ] **Step 3: Implement** `to_e164`: strip non-digits/plus; if starts `+` validate 8–15 digits; if 10 digits prefix `+{default_cc}`; if starts with country code length 11–12 prefix `+`; else `ValueError`. `is_e164`: regex `^\+[1-9]\d{7,14}$`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/utils backend/tests/test_phone.py
git commit -m "feat: E.164 phone normalization"
```

---

### Task 4: HunarClient (httpx wrapper)

**Files:**
- Create: `backend/app/clients/hunar.py`, `backend/tests/test_hunar_client.py`

**Interfaces:**
- Consumes: `Settings`, `schemas.AgentCreate/CallCreate/BulkCallCreate`.
- Produces: `HunarClient(api_key, base_url)` with async methods `create_agent(AgentCreate) -> dict`, `create_call(CallCreate) -> dict`, `create_bulk_calls(BulkCallCreate) -> dict`, `get_call(call_id) -> dict`, `list_numbers() -> list[dict]`. All send `X-API-Key`. Raises `HunarAPIError(status, body)` on non-2xx.

- [ ] **Step 1: Write the failing test (respx-mocked)**
```python
# backend/tests/test_hunar_client.py
import pytest, respx, httpx
from app.clients.hunar import HunarClient
from app.schemas import AgentCreate, VoicePersona

@pytest.mark.anyio
@respx.mock
async def test_create_agent_sends_api_key():
    route = respx.post("https://api.voice.hunar.ai/external/v1/agents/").mock(
        return_value=httpx.Response(200, json={"id": "agent-123"}))
    c = HunarClient("KEY", "https://api.voice.hunar.ai/external/v1")
    out = await c.create_agent(AgentCreate(
        name="Screen", voice_persona=VoicePersona.NEHA, agent_prompt="ask",
        objective="screen", introduction="hi", result_prompt="x",
        result_schema={"interested": "boolean"}))
    assert out["id"] == "agent-123"
    assert route.calls.last.request.headers["X-API-Key"] == "KEY"

@pytest.fixture
def anyio_backend(): return "asyncio"
```

- [ ] **Step 2: Run** — FAIL (no client).

- [ ] **Step 3: Implement** async httpx client; `_request` helper attaching `X-API-Key`, JSON body via `model_dump(exclude_none=True)`, raising `HunarAPIError` on `resp.is_error`. Endpoints per contract (trailing slashes).

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/clients/hunar.py backend/tests/test_hunar_client.py
git commit -m "feat: HunarClient wrapping agents/calls/numbers endpoints"
```

---

### Task 5: DB models + session

**Files:**
- Create: `backend/app/db.py`, `backend/app/models.py`, `backend/tests/test_models.py`

**Interfaces:**
- Produces: SQLModel tables `Campaign`, `Candidate`, `Call`, `WebhookEvent` (fields per spec §4; JSON columns stored as `sa.Column(JSON)`); `init_db()`; `get_session()` dependency.

- [ ] **Step 1: Failing test**
```python
# backend/tests/test_models.py
from sqlmodel import Session, create_engine, SQLModel
from app.models import Campaign, Call

def test_campaign_and_call_roundtrip():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        c = Campaign(name="Riders", kind="hiring", jd_text="jd",
                     result_schema={"interested": "boolean"})
        s.add(c); s.commit(); s.refresh(c)
        call = Call(id="call-1", campaign_id=c.id, status="SCHEDULED")
        s.add(call); s.commit()
        assert c.id and call.campaign_id == c.id
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** the four models with JSON columns and nullable result fields; `db.py` engine from `Settings.database_url` + `init_db()` + `get_session()`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/db.py backend/app/models.py backend/tests/test_models.py
git commit -m "feat: SQLModel tables for campaigns, candidates, calls, webhook events"
```

---

### Task 6: Webhook HMAC verification

**Files:**
- Create: `backend/app/security/hmac.py`, `backend/tests/test_hmac.py`

**Interfaces:**
- Produces: `verify_signature(raw_body: bytes, signature_header: str, timestamp_header: str, api_keys: list[str], tolerance_s: int = 300) -> bool`. Computes `hmac_sha256(key, f"{timestamp}.{body}")` base64; compares (constant-time) against each comma-separated digest; rejects if `|now - timestamp| > tolerance`.

- [ ] **Step 1: Failing test**
```python
# backend/tests/test_hmac.py
import base64, hashlib, hmac, time
from app.security.hmac import verify_signature

def _sig(key, ts, body):
    d = hmac.new(key.encode(), f"{ts}.{body.decode()}".encode(), hashlib.sha256).digest()
    return base64.b64encode(d).decode()

def test_valid_signature():
    body = b'{"call_id":"c1"}'; ts = str(int(time.time()))
    assert verify_signature(body, _sig("K", ts, body), ts, ["K"])

def test_expired_timestamp():
    body = b'{}'; ts = str(int(time.time()) - 400)
    assert not verify_signature(body, _sig("K", ts, body), ts, ["K"])

def test_wrong_key():
    body = b'{}'; ts = str(int(time.time()))
    assert not verify_signature(body, _sig("OTHER", ts, body), ts, ["K"])
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** per interface using `hmac.compare_digest`; tolerate multiple comma-separated header digests and multiple keys.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/security backend/tests/test_hmac.py
git commit -m "feat: HMAC-SHA256 webhook signature verification"
```

---

### Task 7: Webhook receiver + idempotent result upsert + SSE broadcast

**Files:**
- Create: `backend/app/events.py` (in-memory pub/sub), `backend/app/routers/webhooks.py`, `backend/app/routers/stream.py`, `backend/tests/test_webhooks.py`
- Modify: `backend/app/main.py` (include routers, `init_db()` on startup)

**Interfaces:**
- Consumes: `verify_signature`, models, `events`.
- Produces: `POST /webhooks/hunar` (verifies signature when keys configured, stores `WebhookEvent`, upserts matching `Call` row's status/result/engagement/recording, publishes to `events`); `GET /stream/{campaign_id}` SSE endpoint yielding call updates; `events.publish(campaign_id, payload)` / `events.subscribe(campaign_id)`.

- [ ] **Step 1: Failing test**
```python
# backend/tests/test_webhooks.py
from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db

def test_webhook_updates_call_result(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "")  # no keys -> skip signature
    init_db()
    client = TestClient(app)
    # seed a call
    from app.db import engine
    from sqlmodel import Session
    from app.models import Call, Campaign
    with Session(engine) as s:
        c = Campaign(name="x", kind="hiring"); s.add(c); s.commit(); s.refresh(c)
        s.add(Call(id="call-9", campaign_id=c.id, status="IN_PROGRESS")); s.commit()
        cid = c.id
    r = client.post("/webhooks/hunar", json={
        "event_type": "call_result", "call_id": "call-9",
        "status": "COMPLETED", "result": {"interested": True}})
    assert r.status_code == 200
    with Session(engine) as s:
        call = s.get(Call, "call-9")
        assert call.status == "COMPLETED"
        assert call.result == {"interested": True}
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** router: read raw body; if any API key configured, `verify_signature` else skip (dev); dedupe by `(call_id,event_type)` in `WebhookEvent`; upsert `Call`; `events.publish`. `stream.py`: `sse_starlette.EventSourceResponse` over `events.subscribe`. Wire into `main.py`.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/events.py backend/app/routers backend/tests/test_webhooks.py backend/app/main.py
git commit -m "feat: Hunar webhook receiver with idempotent upsert and SSE stream"
```

---

### Task 8: Agents & calls routers (public base URL wired into callbacks)

**Files:**
- Create: `backend/app/routers/agents.py`, `backend/app/routers/calls.py`, `backend/tests/test_calls_router.py`
- Modify: `backend/app/main.py` (include routers)

**Interfaces:**
- Consumes: `HunarClient`, models, `Settings.public_base_url`.
- Produces: `POST /api/agents` (body `AgentCreate` → creates Hunar agent, stores `Campaign`, returns `{campaign_id, agent_id}`); `POST /api/campaigns/{id}/calls` (body: list of `{name, phone, custom_data}` → normalizes phones, injects `callback_config` = `{public_base_url}/webhooks/hunar`, calls Hunar bulk, stores `Call` rows). `get_hunar_client()` dependency.

- [ ] **Step 1: Failing test (Hunar mocked via dependency override)**
```python
# backend/tests/test_calls_router.py
from fastapi.testclient import TestClient
from app.main import app
from app.db import init_db
from app.routers.calls import get_hunar_client

class FakeHunar:
    async def create_bulk_calls(self, payload):
        return {"data": [{"id": "call-1", "mobile_number": payload.data[0].mobile_number,
                          "status": "SCHEDULED"}]}

def test_create_calls_normalizes_and_injects_callback(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://api.example.com")
    init_db()
    app.dependency_overrides[get_hunar_client] = lambda: FakeHunar()
    client = TestClient(app)
    # seed campaign with agent_id
    from app.db import engine; from sqlmodel import Session; from app.models import Campaign
    with Session(engine) as s:
        c = Campaign(name="x", kind="hiring", agent_id="agent-1"); s.add(c); s.commit(); s.refresh(c); cid=c.id
    r = client.post(f"/api/campaigns/{cid}/calls",
                    json=[{"name": "A", "phone": "8837518407", "custom_data": {"job_role": "Rider"}}])
    assert r.status_code == 200
    assert r.json()[0]["mobile_number"] == "+918837518407"
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** both routers; stringify all `custom_data` values; build `BulkCallCreate` with `callback_config`; persist `Call` rows keyed by returned Hunar ids.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/routers/agents.py backend/app/routers/calls.py backend/tests/test_calls_router.py backend/app/main.py
git commit -m "feat: agents and calls routers wiring callbacks to public base URL"
```

---

### Task 9: Live smoke script (de-risk real Hunar call)

**Files:**
- Create: `backend/scripts/smoke_call.py`, `backend/scripts/README.md`

**Interfaces:**
- Consumes: `HunarClient`, `Settings`.
- Produces: a manual script (NOT a pytest) that, given a real `HUNAR_API_KEY` and `--to +918837518407`, creates a minimal agent and one call, then polls `get_call` until terminal, printing status + result. Guarded so it never runs in CI.

- [ ] **Step 1: Implement the script** — argparse `--to`, `--lang ENGLISH`, `--persona NEHA`; create agent with a 2-question `result_schema` (`{"interested":"boolean","summary":"string"}`); create single call with `callback_config` omitted (poll instead); loop `get_call` every 5s until `status in {COMPLETED,NOT_CONNECTED,FAILED,CANCELLED}`; print JSON. `scripts/README.md` explains it needs a real key and dials a real phone.

- [ ] **Step 2: Verify import + arg parse without network**
Run: `cd backend && python scripts/smoke_call.py --help`
Expected: usage prints, exit 0.

- [ ] **Step 3: MANUAL live run (requires real key + phone; user-run)**
Run: `cd backend && HUNAR_API_KEY=... python scripts/smoke_call.py --to +918837518407`
Expected: phone rings; after the call, script prints `status=COMPLETED` and a `result` JSON. **This is the Day-1 integration checkpoint — do not proceed to Phase B until this prints a real result** (or, if minutes are exhausted, a clean `402` confirming auth/path are correct).

- [ ] **Step 4: Commit**
```bash
git add backend/scripts
git commit -m "feat: live smoke script for end-to-end Hunar call verification"
```

---

### Task 10: JD → agent config + result_schema (deterministic core, LLM optional)

**Files:**
- Create: `backend/app/services/jd.py`, `backend/app/services/llm.py`, `backend/tests/test_jd.py`

**Interfaces:**
- Consumes: `Settings` (llm provider/keys), `schemas.AgentCreate`.
- Produces: `build_agent_from_jd(jd: str, *, language, voice_persona, company: str) -> AgentCreate`; `parse_search_params(jd: str) -> dict` (returns `{"titles":[...], "locations":[...], "skills":[...]}`). `llm.complete(prompt) -> str | None` (returns None when `llm_provider=="none"`). JD service uses LLM when available, else deterministic keyword extraction; both paths produce a valid `AgentCreate` with a non-empty `result_schema`.

- [ ] **Step 1: Failing test (deterministic path, no LLM)**
```python
# backend/tests/test_jd.py
from app.services.jd import build_agent_from_jd, parse_search_params
from app.schemas import VoiceLanguage, VoicePersona

JD = "Hiring Delivery Riders in Bangalore. Must have own bike, 1+ year experience. Immediate joiners."

def test_build_agent_defaults_deterministic(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "none")
    a = build_agent_from_jd(JD, language=VoiceLanguage.ENGLISH,
                            voice_persona=VoicePersona.NEHA, company="Zap")
    assert a.result_schema and len(a.result_schema) >= 1
    assert "{callee_name}" in a.introduction or "Zap" in a.introduction
    assert a.name

def test_parse_search_params_extracts_location():
    p = parse_search_params(JD)
    assert any("angalore" in loc for loc in p["locations"])
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** deterministic extractor (keywords: location after "in", role from first line, standard screening result_schema `{"years_experience":"number","available_immediately":"boolean","expected_salary":"string","willing_to_relocate":"boolean","interested":"boolean","summary":"string"}`); `llm.complete` dispatches to Groq/Gemini when configured and returns None otherwise; JD service prefers LLM JSON when parseable, falls back deterministically.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/services backend/tests/test_jd.py
git commit -m "feat: JD to agent-config and search-params with deterministic + optional LLM"
```

---

### Task 11: People-search adapter (mock provider + PDL drop-in)

**Files:**
- Create: `backend/app/clients/people/__init__.py`, `backend/app/clients/people/base.py`, `backend/app/clients/people/mock.py`, `backend/app/clients/people/pdl.py`, `backend/app/clients/people/data/mock_candidates.json`, `backend/app/routers/search.py`, `backend/tests/test_people.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `PeopleProvider` protocol `search(params: dict, limit: int) -> list[PersonResult]`; `PersonResult` (`name`, `title`, `company`, `location`, `phone`, `linkedin`); `get_provider(settings) -> PeopleProvider` (returns `PDLProvider` if `pdl_api_key` else `MockProvider`). `POST /api/search` (body `{jd: str, limit?: int}` → `parse_search_params` → provider → results).

- [ ] **Step 1: Failing test (mock provider default)**
```python
# backend/tests/test_people.py
from fastapi.testclient import TestClient
from app.main import app

def test_search_returns_mock_candidates(monkeypatch):
    monkeypatch.delenv("PDL_API_KEY", raising=False)
    client = TestClient(app)
    r = client.post("/api/search", json={"jd": "Delivery Riders in Bangalore", "limit": 3})
    assert r.status_code == 200
    body = r.json()
    assert 1 <= len(body) <= 3
    assert body[0]["phone"].startswith("+")
```

- [ ] **Step 2: Run** — FAIL.

- [ ] **Step 3: Implement** mock dataset (~15 realistic frontline candidates with E.164 phones, varied Indian cities/roles), filtering by parsed location/title; PDL provider maps params → PDL Person Search API and normalizes; `get_provider` selects by key presence; router wires it.

- [ ] **Step 4: Run** — PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/app/clients/people backend/app/routers/search.py backend/tests/test_people.py backend/app/main.py
git commit -m "feat: pluggable people-search adapter with mock provider and PDL drop-in"
```

---

## Phase B — Frontend

### Task 12: Frontend scaffold (Next.js + TS + shadcn/ui + API client)

**Files:**
- Create: `frontend/` Next.js app (App Router, TS, Tailwind), `frontend/lib/api.ts`, `frontend/lib/sse.ts`, `frontend/.env.example`, `frontend/app/page.tsx` (landing linking the 3 sections)
- Test: `frontend/__tests__/api.test.ts`

**Interfaces:**
- Produces: `api` object with typed methods `createAgent`, `createCalls`, `search`, matching backend routes, base `process.env.NEXT_PUBLIC_API_BASE_URL`. `subscribe(campaignId, onEvent)` in `sse.ts`. Landing page with three cards → `/hiring-assistant`, `/people-reachout`, `/attendance`.

- [ ] **Step 1: Scaffold** `npx create-next-app@latest frontend --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*"`; init shadcn/ui (`npx shadcn@latest init`) and add `button card table input select badge sonner`.
- [ ] **Step 2: Failing test** for `api.createAgent` builds correct URL/body (mock `fetch`). Run via `vitest`; expect FAIL.
- [ ] **Step 3: Implement** `lib/api.ts`, `lib/sse.ts` (EventSource), landing page, `.env.example` (`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`).
- [ ] **Step 4: Run** test — PASS; `npm run build` succeeds.
- [ ] **Step 5: Commit**
```bash
git add frontend
git commit -m "feat: Next.js + shadcn/ui frontend scaffold with typed API client and landing"
```

---

### Task 13: Reusable results DataTable (columns from result_schema, live SSE)

**Files:**
- Create: `frontend/components/results-table.tsx`, `frontend/components/status-badge.tsx`, `frontend/__tests__/results-table.test.tsx`

**Interfaces:**
- Consumes: `subscribe`.
- Produces: `<ResultsTable campaignId resultSchema calls />` rendering one column per `resultSchema` key plus status/engagement/duration/recording; subscribes to SSE and updates rows in place; CSV export button.

- [ ] **Step 1: Failing test** — render with `resultSchema={{interested:"boolean"}}` and one call row; assert an "interested" column header and a status badge appear.
- [ ] **Step 2: Run** (vitest + testing-library) — FAIL.
- [ ] **Step 3: Implement** table from shadcn `Table`; dynamic columns; `StatusBadge` mapping statuses→colors; SSE subscription merging updates by call id; CSV export.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit**
```bash
git add frontend/components frontend/__tests__/results-table.test.tsx
git commit -m "feat: reusable live results table with schema-driven columns"
```

---

### Task 14: Flow 1 — /hiring-assistant page

**Files:**
- Create: `frontend/app/hiring-assistant/page.tsx`, `frontend/components/agent-builder.tsx`, `frontend/components/candidate-input.tsx`

**Interfaces:**
- Consumes: `api`, `ResultsTable`, `agent-builder`, `candidate-input`.
- Produces: page wiring build-agent (JD form → preview generated script+schema → create) → add candidates (manual + CSV) → launch calls → `ResultsTable`.

- [ ] **Step 1:** Implement `agent-builder` (JD textarea, language + persona selects, company; calls `api.createAgent`, shows returned schema for confirmation).
- [ ] **Step 2:** Implement `candidate-input` (manual rows + CSV parse to `{name,phone,custom_data}`).
- [ ] **Step 3:** Assemble page: after agent created, show candidate input; on launch call `api.createCalls`, render `ResultsTable` with the campaign's `result_schema`.
- [ ] **Step 4:** Run `npm run build`; manual click-through against local backend confirms table populates on webhook/poll.
- [ ] **Step 5: Commit**
```bash
git add frontend/app/hiring-assistant frontend/components/agent-builder.tsx frontend/components/candidate-input.tsx
git commit -m "feat: hiring assistant flow (build agent, add candidates, live dashboard)"
```

---

### Task 15: Flow 2 — /people-reachout page

**Files:**
- Create: `frontend/app/people-reachout/page.tsx`, `frontend/components/candidate-search.tsx`

**Interfaces:**
- Consumes: `api.search`, `agent-builder`, `ResultsTable`.
- Produces: page: paste JD → `api.search` → candidate cards with select checkboxes → reuse/auto-create agent from same JD → launch calls on shortlist → `ResultsTable`.

- [ ] **Step 1:** Implement `candidate-search` (JD textarea → results grid of shadcn cards with checkboxes).
- [ ] **Step 2:** Assemble page: shortlist → create agent from JD (reuse `agent-builder` logic) → `api.createCalls` with selected → `ResultsTable`.
- [ ] **Step 3:** Run `npm run build`; manual click-through (mock provider) shows candidates → calls → answers.
- [ ] **Step 4: Commit**
```bash
git add frontend/app/people-reachout frontend/components/candidate-search.tsx
git commit -m "feat: people search and reachout flow reusing the call/dashboard engine"
```

---

## Phase C — Deliverable #3 + polish + deploy

### Task 16: Attendance strategy doc + page + roll-call PoC

**Files:**
- Create: `docs/attendance-strategy.md`, `frontend/app/attendance/page.tsx`, `backend/app/services/attendance.py`, `backend/tests/test_attendance.py`
- Modify: `backend/app/routers/agents.py` or add `backend/app/routers/attendance.py`

**Interfaces:**
- Produces: strategy markdown (problem, insight: phone network survives; daily outbound voice roll-call to site supervisors / inbound IVR; LLM structures spoken roster; multilingual, retries, escalation; feature-phone/USSD/missed-call fallbacks; cost/scale math; architecture diagram). `build_attendance_agent(location: str, worker_names: list[str]) -> AgentCreate` producing an attendance `result_schema` (`{"present":"string","absent":"string","late":"string","notes":"string"}`). `POST /api/attendance/rollcall` (body `{location, supervisor_phone, worker_names}` → creates attendance agent + one call). Page renders the strategy + a "Run roll-call" form that dials the test number and shows the structured roster in `ResultsTable`.

- [ ] **Step 1: Failing test** for `build_attendance_agent` returns AgentCreate with the attendance result_schema keys.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** service + route + write `attendance-strategy.md` + page (render markdown + PoC form).
- [ ] **Step 4: Run** test — PASS; `npm run build` OK.
- [ ] **Step 5: Commit**
```bash
git add docs/attendance-strategy.md frontend/app/attendance backend/app/services/attendance.py backend/app/routers/attendance.py backend/tests/test_attendance.py
git commit -m "feat: no-smartphone attendance strategy, page, and voice roll-call PoC"
```

---

### Task 17: Polling reconciler (missed-webhook safety net)

**Files:**
- Create: `backend/app/services/reconciler.py`, `backend/tests/test_reconciler.py`
- Modify: `backend/app/main.py` (start background task)

**Interfaces:**
- Produces: `reconcile_pending(session, hunar_client)` — finds `Call` rows in non-terminal status older than N seconds, calls `get_call`, updates+publishes; started as an asyncio background loop on app startup (interval configurable, disabled when no API key).

- [ ] **Step 1: Failing test** — seed a non-terminal call; fake Hunar `get_call` returns COMPLETED+result; assert reconcile updates the row.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** reconciler + wire a guarded startup loop.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit**
```bash
git add backend/app/services/reconciler.py backend/tests/test_reconciler.py backend/app/main.py
git commit -m "feat: background reconciler for missed webhooks"
```

---

### Task 18: Deploy configs + README + secret-leak guard

**Files:**
- Create: `render.yaml` (or `railway.json`), `backend/Dockerfile` (optional), `README.md`, `frontend/vercel.json` (if needed), `.github/workflows/ci.yml`
- Modify: root docs

**Interfaces:**
- Produces: Render/Railway service config (build `pip install .`, start `uvicorn app.main:app`, persistent disk for SQLite, env vars listed); Vercel picks up `frontend/`. README: pitch + Hunar framing, architecture diagram, local setup (backend+frontend), env var table, deploy steps, live links placeholders, security note (key server-only), how the demo works. CI runs backend pytest + frontend build + a grep asserting no `hunar_va_live_sk_` string is committed.

- [ ] **Step 1:** Write `render.yaml`/`railway.json`, `README.md`, CI workflow (pytest + `npm run build` + `grep -r "hunar_va_live_sk_" --exclude-dir=.git .` must find nothing).
- [ ] **Step 2:** Run CI locally: `cd backend && python -m pytest -q` and `cd frontend && npm run build` and the grep guard — all green.
- [ ] **Step 3: Commit**
```bash
git add render.yaml README.md .github/workflows/ci.yml frontend/vercel.json backend/Dockerfile
git commit -m "chore: deploy configs, README, and secret-leak CI guard"
```
- [ ] **Step 4: Deploy** backend (Render/Railway) → get `PUBLIC_BASE_URL`; set env vars incl. real `HUNAR_API_KEY`; deploy frontend (Vercel) with `NEXT_PUBLIC_API_BASE_URL`. Update README with live links. Commit.
- [ ] **Step 5: Live end-to-end** — from deployed frontend, run a hiring-assistant call to `+918837518407`; confirm webhook lands on deployed backend and the answer fills the dashboard.

---

## Self-review notes

- **Spec coverage:** §1 flows → Tasks 14/15/16; §2 architecture → Tasks 1,4,7,12; §3 contract → Tasks 2,4; §4 data model → Task 5; §5 core flow → Tasks 8,10; §6 flows → 14–16; §7 structure → all; §8 testing → each task's tests + CI (18); §9 deploy → 18; §10 timeline → phases map to Days 1–3 (Phase A incl. Task 9 = Day 1 de-risk).
- **Security requirement** (key never committed/exposed): `.env` gitignored (already), `.env.example` placeholders (Task 1), frontend only gets `NEXT_PUBLIC_API_BASE_URL` (Task 12), CI grep guard (Task 18).
- **Type consistency:** `AgentCreate`/`RecipientData`/`result_schema` names consistent across Tasks 2,4,8,10,16; `events.publish/subscribe` consistent Tasks 7,17; `PeopleProvider.search` consistent Task 11.
