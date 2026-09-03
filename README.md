# AI Hiring Suite

**Voice AI for frontline hiring — screen, search, and track attendance without asking anyone to install an app.**

Hunar's thesis is that frontline hiring (delivery, retail, warehouse, gig roles) is bottlenecked by human phone screens that don't scale and candidates who often don't have a reliable smartphone. This project builds three products on top of Hunar's Voice Agent API to attack that bottleneck directly: an AI recruiter that calls and screens candidates at scale, a people-search tool that turns a role description into a list of real people to reach out to, and a voice-only attendance strategy (with a working roll-call proof of concept) for a workforce that can't use a badge-in app.

A recruiter pastes a job description, the app auto-builds a multilingual voice agent from it, candidates get called automatically, and structured answers stream live into a dashboard — no manual dialing, no manual note-taking, no app install required of the candidate.

---

## What it does

### 1. AI Hiring Assistant — `/hiring-assistant`
Paste a job description. The backend turns it into a Hunar voice agent (script + a `result_schema` describing what to extract from the conversation), you add candidate phone numbers, and the app places outbound screening calls. Each call's structured result (availability, expected salary, relevant experience, etc.) streams live into a dashboard whose **columns are generated from the agent's `result_schema`** — no hardcoded UI per role.

### 2. People Search & Reachout — `/people-reachout`
Describe the kind of candidate you're looking for; the app searches a people-data provider (mock provider by default, so it works with zero external keys; [People Data Labs](https://www.peopledatalabs.com/) if `PDL_API_KEY` is set) and reuses the same call engine to reach out to matches by voice.

### 3. No-Smartphone Attendance Strategy — `/attendance`
Most frontline workers don't reliably carry a smartphone to a badge-in app. `docs/attendance-strategy.md` lays out a voice-first attendance strategy (IVR check-in, voice roll-call, escalation paths), and `/attendance` includes a working voice roll-call proof of concept built on the same call engine.

---

## Architecture

```
┌─────────────────────┐        REST (JSON)         ┌──────────────────────┐        REST (X-API-Key)        ┌───────────────────────┐
│   Next.js frontend   │ ─────────────────────────▶ │   FastAPI backend     │ ──────────────────────────────▶ │   Hunar Voice API      │
│  (landing + 3 flows) │ ◀───────────────────────── │  (SQLite storage)     │ ◀────────────────────────────── │ (agents, calls, TTS/STT)│
└──────────┬───────────┘        SSE (live rows)      └──────────┬───────────┘         Webhook (HMAC-SHA256)   └───────────────────────┘
           │                                                     │        ▲
           │  NEXT_PUBLIC_API_BASE_URL only —                    │        │  background reconciler polls
           │  no API keys ever reach the browser                 ▼        │  Hunar for any call whose
           │                                          ┌──────────────────┐│  webhook never arrived
           └─────────────────────────────────────────▶│  /webhooks/hunar ││
                                                        │  (signature       │
                                                        │   verified)       │
                                                        └────────┬──────────┘
                                                                 │
                                                                 ▼
                                                   dashboard rows persisted + pushed
                                                   over SSE to any connected client
```

**Flow:** JD → backend builds a multilingual voice agent from it → outbound calls placed via Hunar → Hunar calls the candidate, runs the conversation, and extracts structured data per the agent's `result_schema` → result delivered to the backend via a signature-verified webhook (and picked up by a background reconciler if the webhook is ever missed) → pushed to the frontend dashboard over Server-Sent Events in real time.

---

## Tech stack

**Backend:** FastAPI (Python 3.11), SQLModel over SQLite, `httpx` for the Hunar client, `sse-starlette` for live dashboard updates, `pytest` + `respx` for tests.
**Frontend:** Next.js 16 (App Router) + TypeScript + shadcn/ui + Tailwind, `vitest` for tests.
**External API:** [Hunar Voice API](https://api.voice.hunar.ai/external/v1) — agent creation, outbound calls, webhook delivery.

---

## Local setup

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
# edit .env and set HUNAR_API_KEY=<your real key>

uvicorn app.main:app --reload
# backend now running at http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install

cp .env.example .env.local
# NEXT_PUBLIC_API_BASE_URL=http://localhost:8000  (default already set)

npm run dev
# frontend now running at http://localhost:3000
```

---

## Environment variables

### Backend (`backend/.env`, gitignored — never commit this file)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `HUNAR_API_KEY` | **Yes** | — | Auth for the Hunar Voice API (`X-API-Key` header). Server-side only. |
| `HUNAR_BASE_URL` | No | `https://api.voice.hunar.ai/external/v1` | Hunar API base URL. |
| `PUBLIC_BASE_URL` | Yes (for webhooks) | — | This backend's public HTTPS URL, used when registering webhook callback URLs with Hunar. Must be reachable from the internet — set to your Render URL after deploying. |
| `LLM_PROVIDER` | No | `none` | `none` \| `groq` \| `gemini`. Used to help turn a JD into agent script + result schema. `none` disables LLM calls entirely. |
| `GROQ_API_KEY` | No | — | Required only if `LLM_PROVIDER=groq`. |
| `GEMINI_API_KEY` | No | — | Required only if `LLM_PROVIDER=gemini`. |
| `PDL_API_KEY` | No | — | Required only to use People Data Labs for people search; otherwise a built-in mock provider is used. |
| `DATABASE_URL` | No | `sqlite:///./app.db` | SQLite connection string. |
| `CORS_ORIGINS` | No | `*` | Comma-separated allowed origins; tighten to your deployed frontend URL in production. |
| `RECONCILER_INTERVAL_SECONDS` | No | `30` | How often the background job polls Hunar for any call result missed by webhook delivery. |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:8000` | Base URL of the FastAPI backend. The **only** thing the frontend needs — it never sees any API key. |

---

## Deployment

### Backend → Render

This repo includes `render.yaml` (a [Render Blueprint](https://render.com/docs/blueprint-spec)) and `backend/Dockerfile` as an alternative if you prefer Docker-based deploys elsewhere (Railway, Fly.io, etc.).

1. Push this repo to GitHub, then in Render: **New +** → **Blueprint**, point it at the repo.
2. Render provisions the web service (root dir `backend`, `pip install -e .`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`) plus a persistent disk for SQLite.
3. In the Render dashboard, set the secret env vars marked `sync: false` in `render.yaml` — at minimum `HUNAR_API_KEY`.
4. **Required post-deploy step:** once deployed, set `PUBLIC_BASE_URL` in the Render dashboard to the service's actual public HTTPS URL (e.g. `https://ai-hiring-suite-backend.onrender.com`) — this is what gets registered with Hunar as the webhook callback target, so it must be the full `https://` base URL (not just a hostname or `host:port`), and it must resolve. `render.yaml` intentionally leaves this as `sync: false` rather than auto-deriving it, since Render's auto-derived value is not a valid full URL. If you skip this step, webhook callbacks won't be registered — the app still degrades gracefully because the background reconciler polls Hunar directly for call results, but updates arrive on the polling interval instead of instantly.

### Frontend → Vercel

1. Import `frontend/` as the project root in Vercel (or set "Root Directory" to `frontend` in project settings).
2. Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL from the step above.
3. Deploy.

### Live links

- Frontend: `DEPLOYED_FRONTEND_URL`
- Backend: `DEPLOYED_BACKEND_URL`

*(Filled in after deploying — see task checklist. Not deployed as part of this task.)*

---

## Security

- `HUNAR_API_KEY` and every other provider key (`GROQ_API_KEY`, `GEMINI_API_KEY`, `PDL_API_KEY`) live **only** in the backend environment (`backend/.env`, which is gitignored) or in the hosting platform's secret store (Render dashboard). They are never read by, sent to, or bundled into the frontend.
- The frontend receives exactly one configuration value: `NEXT_PUBLIC_API_BASE_URL` — a public URL, not a secret.
- Inbound Hunar webhooks are verified using an HMAC-SHA256 signature before their payload is trusted.
- CI (`.github/workflows/ci.yml`) runs a grep-based guard on every push that fails the build if a real-looking Hunar key (`hunar_va_live_sk_<long body>`) is ever found committed to the tree.
- This has been verified end-to-end with a real outbound call against the live Hunar API using a real key — see `backend/scripts/smoke_call.py`.

---

## How the demo works

1. Paste a job description into `/hiring-assistant`. The backend calls the configured LLM (or a template fallback if `LLM_PROVIDER=none`) to turn it into a Hunar voice agent: a conversation script plus a `result_schema` describing the structured fields to extract (availability, experience, expected pay, etc.).
2. Add one or more candidate phone numbers and kick off calls.
3. Hunar places the outbound call, runs the conversation, and extracts structured results per the schema.
4. Results are delivered back via a signature-verified webhook to `/webhooks/hunar` (and, if a webhook is ever missed, a background reconciler that polls Hunar picks it up within `RECONCILER_INTERVAL_SECONDS`).
5. The dashboard, subscribed over Server-Sent Events, updates live — columns are generated directly from the agent's `result_schema`, so the same dashboard component works for any job description.

To manually verify the Hunar integration end-to-end outside the UI (real call, real key):

```bash
cd backend
python scripts/smoke_call.py --to +918837518407
```

See `backend/scripts/README.md` for details and expected output.
