"""Mock people-search provider.

Loads a small, static dataset of realistic frontline candidates and filters
it against parsed JD search params. This is the default provider so that
search always works with zero external configuration. If a JD's params
don't match any candidate, it falls back to returning the first `limit`
candidates so the demo never comes up empty.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.clients.people.base import PersonResult

_DATA_PATH = Path(__file__).parent / "data" / "mock_candidates.json"

_candidates_cache: list[dict] | None = None


def _load_candidates() -> list[dict]:
    global _candidates_cache
    if _candidates_cache is None:
        with open(_DATA_PATH, "r", encoding="utf-8") as f:
            _candidates_cache = json.load(f)
    return _candidates_cache


class MockProvider:
    def search(self, params: dict, limit: int) -> list[PersonResult]:
        candidates = _load_candidates()

        locations = [loc.lower() for loc in (params.get("locations") or []) if loc]
        titles = [t.lower() for t in (params.get("titles") or []) if t]

        matched = []
        for c in candidates:
            c_location = (c.get("location") or "").lower()
            c_title = (c.get("title") or "").lower()

            location_ok = True
            if locations:
                location_ok = any(loc in c_location for loc in locations)

            title_ok = True
            if titles:
                title_ok = any(
                    _title_matches(title_query, c_title) for title_query in titles
                )

            if location_ok and title_ok:
                matched.append(c)

        if not matched:
            matched = candidates

        return [PersonResult(**c) for c in matched[:limit]]


def _title_matches(query: str, candidate_title: str) -> bool:
    """Loose contains match: any token of the query title contains-matches
    the candidate title, or vice versa."""
    if query in candidate_title or candidate_title in query:
        return True
    for token in query.split():
        if len(token) > 2 and token in candidate_title:
            return True
    return False
