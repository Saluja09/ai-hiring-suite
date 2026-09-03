"""Mock people-search provider.

Loads a small, static dataset of realistic frontline candidates and filters
it against parsed JD search params. This is the default provider so that
search always works with zero external configuration. Title matching uses
a synonym/keyword map so related phrasing (e.g. "warehouse packer" vs
"Warehouse Associate") still matches. If a JD's params don't match any
candidate, the fallback returns a deterministic-but-varied sample seeded by
the query itself, so different JDs surface different people instead of
always the same first N rows.
"""

from __future__ import annotations

import hashlib
import json
import random
from pathlib import Path

from app.clients.people.base import PersonResult

_DATA_PATH = Path(__file__).parent / "data" / "mock_candidates.json"

_candidates_cache: list[dict] | None = None

# Groups of interchangeable role keywords. If a query token and a candidate
# token fall in the same group, the titles are considered a match.
_SYNONYM_GROUPS: list[set[str]] = [
    {"rider", "delivery", "courier", "deliveryboy"},
    {"guard", "security"},
    {"sales", "salesexecutive", "fieldsales"},
    {"cook", "chef", "kitchen"},
    {"warehouse", "packer", "loader", "fulfillment"},
    {"cleaner", "housekeeping", "housekeeper", "janitor"},
    {"driver", "chauffeur", "cab", "truck"},
    {"electrician", "electrical"},
    {"telecaller", "customersupport", "callcenter", "bpo", "support"},
    {"dataentry", "dataoperator", "data"},
    {"nurse", "wardassistant", "wardboy", "ward"},
    {"technician", "repair", "actechnician", "ac"},
    {"plumber", "plumbing"},
    {"carpenter", "carpentry"},
    {"beautician", "beauty", "salon"},
    {"painter", "painting"},
    {"office", "peon", "officeboy"},
    {"retail", "store", "cashier", "storeassociate"},
]

_STOPWORDS = {
    "the",
    "for",
    "and",
    "needed",
    "required",
    "staff",
    "executive",
    "associate",
    "in",
    "at",
    "a",
    "an",
    "of",
    "to",
    "we",
    "are",
    "hiring",
    "our",
    "team",
}


def _normalize_token(token: str) -> str:
    """Lowercase and strip non-alphanumeric characters from a token so
    'housekeeping,' and 'housekeeping' match, etc."""
    return "".join(ch for ch in token.lower() if ch.isalnum())


def _synonym_group_for(token: str) -> set[str] | None:
    for group in _SYNONYM_GROUPS:
        if token in group:
            return group
    return None


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

        location_matches = []
        both_matches = []
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

            if location_ok and locations:
                location_matches.append(c)
            if location_ok and title_ok:
                both_matches.append(c)

        if both_matches:
            return [PersonResult(**c) for c in both_matches[:limit]]

        # Nothing matched both title and location. Prefer location-only
        # matches (if any locations were requested), then fill the rest
        # with a deterministic-but-varied seeded sample so different JDs
        # still surface different candidates instead of a static fallback.
        seed_source = "|".join(
            sorted(titles) + sorted(locations) + sorted(params.get("skills") or [])
        )
        if not seed_source:
            seed_source = json.dumps(params, sort_keys=True)
        seed = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest(), 16)
        rng = random.Random(seed)

        remaining_pool = [c for c in candidates if c not in location_matches]
        rng.shuffle(remaining_pool)

        result = list(location_matches) + remaining_pool
        return [PersonResult(**c) for c in result[:limit]]


def _title_matches(query: str, candidate_title: str) -> bool:
    """Keyword/synonym-aware match between a query title and a candidate
    title. Matches when:
    - one title is a substring of the other, or
    - a query token and a candidate token belong to the same synonym
      group, or
    - a meaningful (len > 2, non-stopword) token of one title appears in
      the other.
    """
    query = query.lower()
    candidate_title = candidate_title.lower()

    if query in candidate_title or candidate_title in query:
        return True

    query_tokens = [_normalize_token(t) for t in query.split()]
    query_tokens = [t for t in query_tokens if t and t not in _STOPWORDS]

    candidate_tokens = [_normalize_token(t) for t in candidate_title.split()]
    candidate_tokens = [t for t in candidate_tokens if t and t not in _STOPWORDS]

    for q_tok in query_tokens:
        q_group = _synonym_group_for(q_tok)
        for c_tok in candidate_tokens:
            if q_group and c_tok in q_group:
                return True
            if len(q_tok) > 2 and (q_tok in c_tok or c_tok in q_tok):
                return True

    return False
