"""Builds the daily voice roll-call agent for a single location.

This is the PoC for Deliverable #3 (docs/attendance-strategy.md): a
no-smartphone attendance flow where a Hunar voice agent calls the site
supervisor each morning, asks them to read out who is present, and lets
the LLM structure the spoken roster into a present/absent/late roll-up.
"""

from __future__ import annotations

from app.schemas import AgentCreate, VoiceLanguage, VoicePersona

ATTENDANCE_RESULT_SCHEMA = {
    "present": "string",
    "absent": "string",
    "late": "string",
    "notes": "string",
}


def _build_agent_prompt(location: str, worker_names: list[str]) -> str:
    roster = ", ".join(worker_names) if worker_names else "the site roster"
    return (
        f"You are taking the daily attendance roll-call for {location}. "
        "Greet the supervisor warmly, then ask them to go through the "
        f"worker list — {roster} — one by one and say, for each person, "
        "whether they are present, absent, or late (and briefly why, if "
        "absent or late). Accept the supervisor speaking in whichever "
        "language they're comfortable with. Once you have a status for "
        "everyone, read back a short summary — counts of present, absent, "
        "and late, naming anyone absent or late — and ask the supervisor "
        "to confirm it's correct before ending the call."
    )


def build_attendance_agent(
    location: str,
    worker_names: list[str],
    language: VoiceLanguage,
    voice_persona: VoicePersona,
) -> AgentCreate:
    """Build a valid AgentCreate for the daily attendance roll-call at
    ``location``, covering ``worker_names``."""
    name = f"Roll-call — {location}"
    if len(name) > 64:
        name = name[:64]
    if len(name) < 3:
        name = name.ljust(3, ".")

    persona_name = "Neha"

    introduction = (
        f"Hi {{callee_name}}, this is Neha calling for the daily attendance "
        f"roll-call at {location}. Can you tell me who is present today?"
    )

    return AgentCreate(
        name=name,
        language=language,
        voice_persona=voice_persona,
        persona_name=persona_name,
        agent_prompt=_build_agent_prompt(location, worker_names),
        objective=f"Take the daily attendance roll-call for {location}.",
        introduction=introduction,
        result_prompt=(
            "From the conversation, produce the attendance roster as JSON "
            "matching the schema."
        ),
        result_schema=dict(ATTENDANCE_RESULT_SCHEMA),
    )
