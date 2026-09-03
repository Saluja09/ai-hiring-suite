import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.routers import agents, attendance, calls, campaigns, search, stream, webhooks
from app.services.reconciler import reconciler_loop

app = FastAPI(title="AI Hiring Suite")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(stream.router)
app.include_router(agents.router)
app.include_router(campaigns.router)
app.include_router(calls.router)
app.include_router(search.router)
app.include_router(attendance.router)


@app.on_event("startup")
def on_startup():
    init_db()
    if get_settings().hunar_api_key:
        app.state.reconciler_task = asyncio.create_task(reconciler_loop())
    else:
        app.state.reconciler_task = None


@app.on_event("shutdown")
async def on_shutdown():
    task = getattr(app.state, "reconciler_task", None)
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@app.get("/health")
def health():
    """Health + non-secret config diagnostics.

    Reports the resolved Hunar base URL and whether a key is configured
    (masked — never the value) so misconfiguration is diagnosable without
    exposing secrets.
    """
    s = get_settings()
    key = s.hunar_api_key or ""
    pdl = s.pdl_api_key or ""
    return {
        "status": "ok",
        "hunar_base_url": s.hunar_base_url,
        "hunar_key_configured": bool(key),
        "hunar_key_len": len(key),
        "public_base_url_set": bool(s.public_base_url),
        "llm_provider": s.llm_provider,
        "pdl_key_configured": bool(pdl),
        "pdl_key_len": len(pdl),
        "people_provider": "pdl" if pdl else "mock",
    }
