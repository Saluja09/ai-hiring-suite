"""People Data Labs (PDL) person-search provider.

Best-effort drop-in for the mock provider: on any error (network, auth,
malformed response, etc.) this returns an empty list rather than raising,
since the mock provider is the safety net for the demo.
"""

from __future__ import annotations

import httpx

from app.clients.people.base import PersonResult

PDL_SEARCH_URL = "https://api.peopledatalabs.com/v5/person/search"


class PDLProvider:
    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

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
            return [_to_person_result(r) for r in records[:limit]]
        except Exception:
            return []


def _build_query(params: dict) -> dict:
    must: list[dict] = []

    titles = [t for t in (params.get("titles") or []) if t]
    if titles:
        must.append({"terms": {"job_title": titles}})

    locations = [loc for loc in (params.get("locations") or []) if loc]
    if locations:
        must.append({"terms": {"location_name": locations}})

    return {"bool": {"must": must}} if must else {"match_all": {}}


def _to_person_result(record: dict) -> PersonResult:
    phone_numbers = record.get("phone_numbers") or []
    phone = phone_numbers[0] if phone_numbers else ""
    return PersonResult(
        name=record.get("full_name") or "",
        title=record.get("job_title") or "",
        company=record.get("job_company_name") or "",
        location=record.get("location_name") or "",
        phone=phone,
        linkedin=record.get("linkedin_url"),
    )
