# AI Hiring Suite — Design Spec

**Date:** 2026-09-01
**Deadline:** 2026-09-04 14:02 IST
**Author:** Aryaman Saluja (with Claude Code)

## 0. Context & framing

Hunar.AI is India's leading voice-AI platform for the **frontline / blue-collar
workforce** — not white-collar recruiting. Their thesis (founder Krishna
Khandelwal): *"80% of the job of an HR is calling."* They run ~5 lakh calls/day,
21M+ multilingual candidate conversations (Hindi/Marathi/regional), for Swiggy,
Zepto, Croma, Starbucks; claim up to 75% hiring-cycle reduction.

**Differentiator:** we deliberately frame all three deliverables around
frontline hiring at scale, multilingual, India-first — speaking Hunar's exact
language and pain, instead of a generic "AI calls a candidate" toy.

Authoritative API contract: `docs/hunar-openapi.json` (OpenAPI 3, base
`https://api.voice.hunar.ai/external/v1/`, auth `X-API-Key`). We build against
this file, not any paraphrase.

## 1. Scope — one product, three sections, one deploy

Working name: **AI Hiring Suite**. Single Next.js + FastAPI monorepo, one Vercel
link + one GitHub repo.

- **/hiring-assistant** (Deliverable #1): build agent from JD → trigger calls →
  live results dashboard.
- **/people-reachout** (Deliverable #2): paste JD → people search (mock-first,
  PDL optional) → shortlist → call → same dashboard.
- **/attendance** (Deliverable #3): strategy write-up for no-smartphone
  attendance (1000 people/100 locations) + working voice roll-call PoC.

#1 and #2 share ~80% machinery (agent → call → structured answers → dashboard);
#2 = #1 + a search front door. One engine, two entry points.

## 2. Architecture

```
Frontend (Next.js + TS + shadcn/ui) on Vercel
  /, /hiring-assistant, /people-reachout, /attendance
        │ HTTPS REST + SSE
Backend (FastAPI + Python) on Render/Railway (public HTTPS)
  • HunarClient   → /agents /calls /calls/bulk /numbers  (holds X-API-Key)
  • People adapter→ mock provider (default) | PDL provider (env key)
  • JD service    → JD → search params + agent config + result_schema
  • LLM service   → Groq/Gemini free tier | deterministic fallback (no key → still works)
  • Webhook rx    → POST /webhooks/hunar (HMAC-SHA256 verify, 300s tolerance)
  • Store         → SQLite (SQLModel)
  • Realtime      → SSE to dashboard
        ▲ webhooks (result/status/recording)   │ outbound calls
        └──────────── Hunar Voice API ◄─────────┘
```

**Cost: $0 path.** Hosting free tiers; Hunar minutes on their key (402 if
exhausted = no charge to us); people search mock-first; LLM free tier with
deterministic fallback. Optional paid upgrades: real PDL key, Claude.

**Security (assignment requirement):** `HUNAR_API_KEY` only in backend `.env`
(gitignored) + host env vars. Never in frontend, never committed.
`.env.example` holds placeholders only.

## 3. Hunar API contract (from openapi.json — corrected facts)

- `POST /agents/` — **all 7 fields required**: `name` (3–64), `voice_persona`
  (NEHA/ROY/ZOE/SAM/MIRA/EESHA), `language` (12: ENGLISH/HINDI/TAMIL/TELUGU/
  KANNADA/MARATHI/MALAYALAM/GUJARATI/BENGALI/TURKISH/ARABIC/SPANISH),
  `agent_prompt`, `objective`, `introduction`, `result_prompt`, `result_schema`.
- `result_schema` = flat JSON object `{field: "string"|"number"|"boolean"}`
  (min 1 prop), NOT full JSON-Schema.
- `POST /calls/` single: required `callee_name`, `mobile_number` (E.164),
  `agent_id`; optional `custom_data` (**all values must be strings**),
  `from_phone_number`, `callback_config`, `retry_config`, `guardrails`,
  `timezone`, `request_id`.
- `POST /calls/bulk/`: `agent_id` + `data[]` (≤10000) of
  `{callee_name, mobile_number, custom_data}`; `remove_invalid_rows`,
  `remove_duplicate_phone_numbers`.
- `GET /numbers/` → available caller IDs w/ `allowed_countries` — pick a valid
  `from_phone_number` for India at startup.
- Webhooks: `callback_config` = status/recording/result/summary URLs. Payload
  fields: `status` (NOT_STARTED…COMPLETED/NOT_CONNECTED/FAILED),
  `lifecycle_status`, `engagement_status` (ENGAGED/NOT_ENGAGED),
  `answered_by` (HUMAN/MACHINE/UNKNOWN), `duration_seconds`, `recording_url`,
  `result` (matches result_schema).
- Webhook security: HMAC-SHA256 over `"{timestamp}.{raw_body}"`,
  header `X-Hunar-Signature` (base64, comma-sep per key) + `X-Hunar-Timestamp`;
  reject outside 300s; constant-time compare. **Exact payload body verified
  empirically on first real webhook.**

## 4. Data model (SQLite)

```
Campaign     id, name, kind(hiring|reachout|attendance), jd_text,
             agent_id, result_schema(json), lang, voice_persona, created_at
Candidate    id, campaign_id, name, phone(E.164), source(manual|pdl|mock),
             custom_data(json), meta(json: title/company/location)
Call         id(hunar uuid), campaign_id, candidate_id, request_id, status,
             lifecycle_status, engagement_status, answered_by,
             duration_seconds, recording_url, result(json), updated_at
WebhookEvent id, call_id, event_type, raw_payload(json),
             signature_valid, received_at   # audit + idempotency
```

## 5. Core flow — JD → live agent

1. Parse JD (LLM or deterministic) → role, must-have questions, location, language.
2. Auto-build agent config → `POST /agents/`. `introduction`/`agent_prompt` use
   placeholders filled per candidate via `custom_data`; `result_schema` generated
   from must-haves, e.g.
   `{"years_experience":"number","available_immediately":"boolean",
     "expected_salary":"string","willing_to_relocate":"boolean",
     "interested":"boolean","summary":"string"}`.
3. Trigger `/calls/` or `/calls/bulk/` with stringified `custom_data` + our
   deployed `callback_config`.
4. Webhook → HMAC verify → upsert `Call.result` → SSE → dashboard.

**Dashboard columns are generated from `result_schema`** — JD-implied questions
become answer columns automatically. This is the "conversation responses back
into a dashboard with answers" requirement, done generically.

## 6. Flows

**Flow 1 /hiring-assistant:** build agent (JD form → review generated
script+schema → create) → add candidates (manual/CSV, E.164) → launch bulk calls
→ live dashboard (status badges, engagement, duration, recording, answer columns
via SSE, filters, CSV export).

**Flow 2 /people-reachout:** paste JD → search params → people adapter (mock now,
PDL drop-in) → candidate cards → shortlist → reuse/auto-gen agent → bulk call →
same dashboard.

**Flow 3 /attendance:** rich strategy page — the phone network survives without
smartphones; daily outbound voice roll-call to each site supervisor (or inbound
hotline+IVR); LLM structures the spoken roster into present/absent/late records;
multilingual, retries, no-answer escalation; feature-phone/USSD/missed-call
fallbacks; cost/scale math; architecture diagram. **PoC:** "Run roll-call" button
fires a real Hunar call to the test number with an attendance `result_schema` →
spoken roster returns structured into an attendance table. Reuses the engine.

## 7. Repo structure

```
ai-hiring-suite/
  README.md, docs/(attendance-strategy.md, hunar-openapi.json, specs/)
  backend/  app/(main, config, clients/hunar, clients/people/, services/jd,
            services/llm, routers/, webhooks, db, models, schemas), tests/,
            pyproject.toml, .env.example
  frontend/ app/(hiring-assistant|people-reachout|attendance), components/,
            lib/(api,sse), .env.example
  .gitignore (.env, *.db, __pycache__, node_modules)
```

## 8. Testing (TDD)

- Unit: JD parser; HMAC verify (valid/invalid/expired); E.164 normalizer;
  custom_data stringification; webhook idempotency.
- Contract: pydantic schemas validated vs `hunar-openapi.json` examples.
- Integration: HunarClient vs mocked HTTP (respx) asserting exact payloads;
  one opt-in live smoke test (creates agent, dials +918837518407, asserts webhook).
- Frontend: DataTable renders from result_schema; SSE update.

## 9. Deploy

Backend → Render/Railway (public HTTPS = `PUBLIC_BASE_URL` for callbacks,
persistent disk for SQLite). Frontend → Vercel
(`NEXT_PUBLIC_API_BASE_URL`). Every call passes
`call_result_callback_url = {PUBLIC_BASE_URL}/webhooks/hunar`. Submission = 1
Vercel link + 1 GitHub repo (backend URL in README).

Reliability nets: ~30-line polling reconciler for missed webhooks; "simulate
result" path in dashboard for demo if Hunar minutes exhaust.

## 10. Timeline

- **Day 1:** scaffold both apps; HunarClient + schemas; DB; webhook rx + HMAC;
  `/numbers` caller-ID; **live smoke test: real call → webhook → stored result**
  (de-risk integration first).
- **Day 2:** JD parser + agent builder + Flow 1 dashboard (SSE); Flow 2 search
  (mock) + reuse engine.
- **Day 3:** Flow 3 page + PoC; design/polish pass; README + strategy doc;
  deploy; end-to-end demo; buffer.
