"""Deterministic (with optional LLM) conversion from a job description
into an AgentCreate config and candidate search params.

The deterministic path (no LLM configured) must always work: this module
never depends on the LLM to produce a valid result.
"""

from __future__ import annotations

import json
import re

from app.config import get_settings
from app.schemas import AgentCreate, VoiceLanguage, VoicePersona
from app.services.llm import complete

STANDARD_RESULT_SCHEMA = {
    "years_experience": "number",
    "available_immediately": "boolean",
    "expected_salary": "string",
    "willing_to_relocate": "boolean",
    "interested": "boolean",
    "summary": "string",
}

_KNOWN_CITIES = [
    "Bangalore",
    "Bengaluru",
    "Mumbai",
    "Delhi",
    "Hyderabad",
    "Chennai",
    "Pune",
    "Kolkata",
    "Ahmedabad",
    "Gurgaon",
    "Noida",
]

_SKILL_KEYWORDS = [
    "bike",
    "license",
    "experience",
    "driving",
    "communication",
    "typing",
    "excel",
    "sales",
    "customer service",
    "delivery",
]

_VALID_SCHEMA_TYPES = {"number", "boolean", "string"}


def _extract_role(jd: str) -> str:
    """Derive a role string: text before ' in <Location>' on the first
    line, else the whole first line, trimmed."""
    first_line = jd.strip().splitlines()[0].strip() if jd.strip() else ""
    if not first_line:
        return "the role"

    # Strip common lead-ins like "Hiring "
    cleaned = re.sub(r"^(hiring|looking for|we need|need|seeking)\s+", "", first_line, flags=re.IGNORECASE)

    # Cut at a location/qualifier clause introduced by " in / at / for / with "
    # (case-insensitive, so lowercase "in san francisco" is stripped too).
    match = re.search(r"\b(in|at|for|with)\b", cleaned, flags=re.IGNORECASE)
    if match:
        cleaned = cleaned[: match.start()].strip()

    # Drop trailing filler words that hurt an exact title match.
    cleaned = re.sub(r"\b(needed|required|wanted|staff|role|position)\b\s*$", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.rstrip(",.").strip()
    return cleaned or "the role"


def _extract_locations(jd: str) -> list[str]:
    locations: list[str] = []

    # Known cities anywhere in text.
    for city in _KNOWN_CITIES:
        if re.search(rf"\b{re.escape(city)}\b", jd, flags=re.IGNORECASE):
            if city not in locations:
                locations.append(city)

    # "in <place>" pattern (case-insensitive), for locations not in the known
    # list — e.g. "in san francisco". Take up to 3 words after "in", stopping
    # at punctuation, and skip if it's obviously not a place.
    for match in re.finditer(
        r"\bin\s+([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})", jd, flags=re.IGNORECASE
    ):
        candidate = match.group(1).strip().rstrip(".,")
        # Avoid capturing trailing skill/qualifier phrases as a "location".
        if candidate and candidate.lower() not in {loc.lower() for loc in locations}:
            locations.append(candidate)

    return locations


def _extract_titles(jd: str) -> list[str]:
    role = _extract_role(jd)
    return [role] if role and role != "the role" else []


def _extract_skills(jd: str) -> list[str]:
    skills: list[str] = []
    lowered = jd.lower()
    for kw in _SKILL_KEYWORDS:
        if kw in lowered and kw not in skills:
            skills.append(kw)
    return skills


def _deterministic_search_params(jd: str) -> dict:
    return {
        "titles": _extract_titles(jd),
        "locations": _extract_locations(jd),
        "skills": _extract_skills(jd),
    }


def parse_search_params(jd: str) -> dict:
    """Extract {"titles": [...], "locations": [...], "skills": [...]} from
    a JD. Prefers LLM JSON output when configured and parseable, otherwise
    falls back to deterministic keyword extraction (always available)."""
    deterministic = _deterministic_search_params(jd)

    settings = get_settings()
    if (settings.llm_provider or "none").lower() == "none":
        return deterministic

    prompt = (
        "Extract job search parameters from this job description as strict "
        'JSON with exactly these keys: "titles" (list of strings), '
        '"locations" (list of strings), "skills" (list of strings). '
        f"Job description:\n{jd}\n\nRespond with JSON only."
    )
    raw = complete(prompt)
    if not raw:
        return deterministic

    try:
        parsed = _extract_json_object(raw)
        if (
            isinstance(parsed, dict)
            and isinstance(parsed.get("titles"), list)
            and isinstance(parsed.get("locations"), list)
            and isinstance(parsed.get("skills"), list)
        ):
            return {
                "titles": [str(x) for x in parsed["titles"]],
                "locations": [str(x) for x in parsed["locations"]],
                "skills": [str(x) for x in parsed["skills"]],
            }
    except Exception:
        pass

    return deterministic


def _extract_json_object(text: str):
    """Best-effort extraction of a JSON object from possibly noisy LLM
    output (e.g. wrapped in markdown code fences)."""
    text = text.strip()
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("no JSON object found")
    return json.loads(match.group(0))


def _build_agent_prompt(jd: str, role: str) -> str:
    return (
        f"You are screening a candidate for the {role} role. Using the "
        f"following job description as context, ask about: their years of "
        f"relevant experience, availability/notice period, expected salary, "
        f"willingness to relocate (if applicable), and overall interest in "
        f"the role. Be concise and friendly.\n\nJob description:\n{jd}"
    )


def _merge_llm_schema(jd: str, role: str) -> dict:
    """Optionally ask the LLM for extra must-have fields to merge into the
    standard result schema. Always returns a valid, non-empty schema."""
    schema = dict(STANDARD_RESULT_SCHEMA)

    settings = get_settings()
    if (settings.llm_provider or "none").lower() == "none":
        return schema

    prompt = (
        f"Given this job description for the {role} role, list any extra "
        "must-have fields to extract from a candidate screening call, as "
        'strict JSON mapping field name to type, where type is one of '
        '"number", "boolean", "string". Respond with JSON only.\n\n'
        f"Job description:\n{jd}"
    )
    raw = complete(prompt)
    if not raw:
        return schema

    try:
        extra = _extract_json_object(raw)
        if isinstance(extra, dict):
            for key, value in extra.items():
                if isinstance(key, str) and value in _VALID_SCHEMA_TYPES:
                    schema[key] = value
    except Exception:
        pass

    if not schema:
        return dict(STANDARD_RESULT_SCHEMA)
    return schema


def build_agent_from_jd(
    jd: str,
    *,
    language: VoiceLanguage,
    voice_persona: VoicePersona,
    company: str,
) -> AgentCreate:
    """Build a valid AgentCreate from a job description, deterministically
    with an optional LLM assist for extra result_schema fields."""
    role = _extract_role(jd)

    name = f"Screening — {role}"[:64]
    if len(name) < 3:
        name = "Screening Agent"

    persona_name = "Neha"

    introduction = (
        f"Hi {{callee_name}}, this is Neha from {company} about the "
        f"{role} role. Do you have 2 minutes?"
    )

    agent_prompt = _build_agent_prompt(jd, role)
    objective = f"Screen candidates for the {role} role."
    result_prompt = (
        "From the conversation, extract the candidate's answers as JSON "
        "matching the schema."
    )
    result_schema = _merge_llm_schema(jd, role)

    return AgentCreate(
        name=name,
        language=language,
        voice_persona=voice_persona,
        persona_name=persona_name,
        agent_prompt=agent_prompt,
        objective=objective,
        introduction=introduction,
        result_prompt=result_prompt,
        result_schema=result_schema,
    )
