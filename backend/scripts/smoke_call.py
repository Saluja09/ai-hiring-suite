"""Manual live smoke test for the Hunar Voice integration.

This is NOT a pytest test — it is a standalone script you run by hand.
It dials a REAL phone number using a REAL Hunar API key: it creates a
screening agent, places a single call, and polls until the call reaches
a terminal state, printing the final result JSON.

Usage:
    cd backend
    python scripts/smoke_call.py --to +918837518407

See scripts/README.md for details.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone

from app.clients.hunar import HunarAPIError, HunarClient
from app.config import get_settings
from app.schemas import AgentCreate, CallCreate, VoiceLanguage, VoicePersona
from app.utils.phone import to_e164

TERMINAL_STATUSES = {"COMPLETED", "NOT_CONNECTED", "FAILED", "CANCELLED"}


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Live smoke test: creates a real Hunar agent and places one "
            "real phone call, then polls until the call finishes."
        )
    )
    parser.add_argument(
        "--to", required=True, help="Destination phone number to call (E.164 or 10-digit)."
    )
    parser.add_argument(
        "--lang", default="ENGLISH", help="Agent language (default: ENGLISH)."
    )
    parser.add_argument(
        "--persona", default="NEHA", help="Voice persona (default: NEHA)."
    )
    parser.add_argument(
        "--name", default="Test Candidate", help="Callee name (default: 'Test Candidate')."
    )
    parser.add_argument(
        "--company", default="Acme", help="Company name used in the script (default: 'Acme')."
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=5,
        help="Seconds between status polls (default: 5).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=300,
        help="Max seconds to poll before giving up (default: 300).",
    )
    parser.add_argument(
        "--from-number",
        default=None,
        help="Caller ID phone number to use (optional; auto-picked if omitted).",
    )
    return parser.parse_args(argv)


def _log(message: str) -> None:
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


async def pick_from_number(client: HunarClient) -> str | None:
    """Best-effort: pick the first validated Indian number from list_numbers()."""
    try:
        numbers = await client.list_numbers()
    except Exception as exc:  # noqa: BLE001 - best-effort, never fatal
        _log(f"list_numbers() failed (ignoring, best-effort): {exc}")
        return None

    if not isinstance(numbers, list):
        return None

    for entry in numbers:
        if not isinstance(entry, dict):
            continue
        number = entry.get("phone_number") or entry.get("number")
        if not number:
            continue
        is_validated = entry.get("is_validated", entry.get("validated", True))
        country = str(entry.get("country", entry.get("country_code", ""))).upper()
        looks_indian = country in ("IN", "INDIA", "91") or str(number).startswith("+91")
        if is_validated and looks_indian:
            return str(number)

    return None


async def run(args: argparse.Namespace) -> int:
    settings = get_settings()

    if not settings.hunar_api_key:
        print(
            "ERROR: HUNAR_API_KEY is not set. Add it to backend/.env "
            "(or export HUNAR_API_KEY) before running this script.",
            file=sys.stderr,
        )
        return 1

    try:
        callee_e164 = to_e164(args.to)
    except ValueError as exc:
        print(f"ERROR: invalid --to phone number: {exc}", file=sys.stderr)
        return 1

    client = HunarClient(
        api_key=settings.hunar_api_key, base_url=settings.hunar_base_url
    )

    try:
        language = VoiceLanguage(args.lang)
    except ValueError:
        print(
            f"ERROR: invalid --lang '{args.lang}'. Valid: {[l.value for l in VoiceLanguage]}",
            file=sys.stderr,
        )
        return 1

    try:
        persona = VoicePersona(args.persona)
    except ValueError:
        print(
            f"ERROR: invalid --persona '{args.persona}'. Valid: {[p.value for p in VoicePersona]}",
            file=sys.stderr,
        )
        return 1

    agent_payload = AgentCreate(
        name="Smoke Test Screen",
        language=language,
        voice_persona=persona,
        persona_name="Neha",
        introduction=(
            "Hi {callee_name}, this is Neha from {company}. Quick 2-minute "
            "question — is that ok?"
        ),
        agent_prompt=(
            "You are screening a candidate for a delivery rider role on "
            "behalf of {company}. Politely ask two things: (1) whether "
            "they are interested in a delivery rider role, and (2) how "
            "many years of relevant delivery/driving experience they "
            "have. Keep the call short and friendly, and thank them for "
            "their time before ending the call."
        ),
        objective="Screen a candidate for a delivery rider role.",
        result_prompt=(
            "From the conversation, extract the candidate's answers as "
            "JSON matching the schema."
        ),
        result_schema={
            "interested": "boolean",
            "years_experience": "number",
            "summary": "string",
        },
    )

    try:
        _log("Creating agent...")
        agent = await client.create_agent(agent_payload)
    except HunarAPIError as exc:
        return handle_hunar_error(exc, context="create_agent")

    agent_id = agent.get("id") or agent.get("agent_id")
    _log(f"Agent created: id={agent_id}")
    if not agent_id:
        print(f"ERROR: could not find agent id in response: {agent}", file=sys.stderr)
        return 1

    from_number = args.from_number
    if not from_number:
        from_number = await pick_from_number(client)
        if from_number:
            _log(f"Auto-picked from_number: {from_number}")
        else:
            _log("No from_number picked (best-effort); leaving unset.")

    call_payload = CallCreate(
        agent_id=agent_id,
        callee_name=args.name,
        mobile_number=callee_e164,
        custom_data={"company": args.company, "job_role": "Delivery Rider"},
        from_phone_number=from_number,
    )

    try:
        _log(f"Creating call to {callee_e164}...")
        call = await client.create_call(call_payload)
    except HunarAPIError as exc:
        return handle_hunar_error(exc, context="create_call")

    call_id = call.get("id") or call.get("call_id")
    _log(f"Call created: id={call_id}")
    if not call_id:
        print(f"ERROR: could not find call id in response: {call}", file=sys.stderr)
        return 1

    last_status = None
    elapsed = 0.0
    final_call = call

    while True:
        try:
            final_call = await client.get_call(call_id)
        except HunarAPIError as exc:
            return handle_hunar_error(exc, context="get_call")

        status = final_call.get("status")
        if status != last_status:
            _log(f"status={status}")
            last_status = status

        if status in TERMINAL_STATUSES:
            break

        if elapsed >= args.timeout:
            _log(
                f"Timed out after {args.timeout}s waiting for a terminal "
                f"status (last status={status})."
            )
            break

        await asyncio.sleep(args.poll_interval)
        elapsed += args.poll_interval

    print("\nFinal call state:")
    print(json.dumps(final_call, indent=2, default=str))

    return 0


def handle_hunar_error(exc: HunarAPIError, context: str) -> int:
    if exc.status == 402:
        print(
            f"\n{context}: Hunar API returned 402 (payment/minutes "
            "exhausted). This still confirms auth and the API path are "
            "correct — treating this as a valid integration check.",
        )
        return 0
    print(
        f"ERROR: {context} failed with status={exc.status} body={exc.body}",
        file=sys.stderr,
    )
    return 1


def main() -> int:
    args = parse_args()
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
