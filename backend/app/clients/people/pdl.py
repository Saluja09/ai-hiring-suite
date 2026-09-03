"""People Data Labs (PDL) person-search provider.

Returns REAL people (name, title, company, location, LinkedIn) from PDL's
Person Search API. PDL's free tier masks actual phone numbers (they come
back as the boolean `true`, not a dialable value — real numbers require a
paid phone add-on), so we substitute a configured demo phone number and
flag it, keeping the search -> call -> dashboard flow working end-to-end
with real profiles.

Best-effort: on any error (network, auth, bad query) it returns an empty
list rather than raising, so the caller can fall back to the mock dataset.
"""

from __future__ import annotations

import logging

import httpx

from app.clients.people.base import PersonResult

logger = logging.getLogger(__name__)

PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search"

# PDL free tier does not return dialable phone numbers, so real PDL profiles
# get this demo number for the outbound-call flow. Overridable via the
# provider constructor (wired from settings.pdl_demo_phone).
DEFAULT_DEMO_PHONE = "+918837518407"


class PDLProvider:
    def __init__(self, api_key: str, demo_phone: str = DEFAULT_DEMO_PHONE) -> None:
        self.api_key = api_key
        self.demo_phone = demo_phone

    def search(self, params: dict, limit: int) -> list[PersonResult]:
        try:
            query = _build_query(params)
            response = httpx.post(
                PDL_SEARCH_URL,
                headers={"X-Api-Key": self.api_key},
                json={"query": query, "size": limit},
                timeout=10.0,
            )
            response.raise_for_status()
            data = response.json()
            records = data.get("data") or []
            if not records:
                logger.info("PDL search returned 0 records; caller may fall back to mock.")
            return [self._to_person_result(r) for r in records[:limit]]
        except httpx.HTTPStatusError as err:
            # Surface auth/query errors (401 bad key, 402 no credits, 400 bad
            # query) so misconfiguration is diagnosable — still fall back.
            logger.warning(
                "PDL search failed: %s %s",
                err.response.status_code,
                err.response.text[:200],
            )
            return []
        except Exception as err:
            logger.warning("PDL search error: %s", err)
            return []

    def _to_person_result(self, record: dict) -> PersonResult:
        # PDL free tier returns `phone_numbers: true` (a presence flag) rather
        # than real numbers, so we always substitute the demo phone and mark it.
        raw_phones = record.get("phone_numbers")
        real_phone = ""
        if isinstance(raw_phones, list) and raw_phones and isinstance(raw_phones[0], str):
            real_phone = raw_phones[0]

        phone = real_phone or self.demo_phone
        phone_is_demo = not real_phone

        # location_name is also masked to `true` on free tier; prefer the
        # locality/region strings when present, else fall back gracefully.
        location = _first_str(
            record.get("location_name"),
            record.get("location_locality"),
            record.get("location_region"),
        )

        return PersonResult(
            name=_clean(record.get("full_name")),
            title=_clean(record.get("job_title")),
            company=_clean(record.get("job_company_name")),
            location=location,
            phone=phone,
            linkedin=_linkedin(record.get("linkedin_url")),
            source="pdl",
            phone_is_demo=phone_is_demo,
        )


def _build_query(params: dict) -> dict:
    """Build a PDL Elasticsearch query.

    Uses `match` (analyzed) on job_title and `match` on location_locality —
    `terms` (exact) on these fields returns nothing, which was the original
    integration bug.
    """
    must: list[dict] = []

    titles = [t for t in (params.get("titles") or []) if t]
    if titles:
        # OR across the extracted title phrases. PDL rejects
        # `minimum_should_match`, but a `should` nested in a `must` already
        # requires at least one match, which is the behaviour we want.
        should = [{"match": {"job_title": t}} for t in titles]
        must.append({"bool": {"should": should}})

    locations = [loc for loc in (params.get("locations") or []) if loc]
    if locations:
        should = [{"match": {"location_locality": loc}} for loc in locations]
        must.append({"bool": {"should": should}})

    return {"bool": {"must": must}} if must else {"match_all": {}}


def _clean(value) -> str:
    return value if isinstance(value, str) else ""


def _first_str(*values) -> str:
    for v in values:
        if isinstance(v, str) and v:
            return v
    return ""


def _linkedin(value):
    if not isinstance(value, str) or not value:
        return None
    return value if value.startswith("http") else f"https://{value}"
