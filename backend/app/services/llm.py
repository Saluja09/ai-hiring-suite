"""Thin, optional LLM wrapper.

Deterministic callers must work even when `llm_provider == "none"` or no
API key is configured. This module never raises: any network or parsing
error results in `None` so callers can fall back to deterministic logic.
"""

from __future__ import annotations

import httpx

from app.config import get_settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def complete(prompt: str) -> str | None:
    """Best-effort LLM completion. Returns None if unavailable or on error."""
    settings = get_settings()
    provider = (settings.llm_provider or "none").lower()

    try:
        if provider == "groq" and settings.groq_api_key:
            return _complete_groq(prompt, settings.groq_api_key)
        if provider == "gemini" and settings.gemini_api_key:
            return _complete_gemini(prompt, settings.gemini_api_key)
    except Exception:
        return None

    return None


def _complete_groq(prompt: str, api_key: str) -> str | None:
    try:
        resp = httpx.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception:
        return None


def _complete_gemini(prompt: str, api_key: str) -> str | None:
    try:
        resp = httpx.post(
            GEMINI_URL,
            params={"key": api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return None
