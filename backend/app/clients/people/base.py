"""Pluggable people-search provider abstraction.

Default is the mock provider (always available, no external dependency).
If a People Data Labs API key is configured, PDLProvider is used instead;
it is best-effort and never raises (falls back to an empty list on error).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class PersonResult:
    name: str
    title: str
    company: str
    location: str
    phone: str
    linkedin: Optional[str] = None
    source: str = "mock"
    # True when `phone` is a demo substitute (e.g. real PDL profile whose
    # actual number is masked on the free tier) rather than a real number.
    phone_is_demo: bool = False


class PeopleProvider(Protocol):
    def search(self, params: dict, limit: int) -> list[PersonResult]: ...


class PDLWithMockFallback:
    """Uses PDL for real data, but falls back to the mock dataset whenever
    PDL returns no results (common for Indian frontline queries, which PDL's
    US/white-collar-oriented data covers sparsely) or errors.

    This keeps the demo useful with real data when available, while never
    showing an empty result set.
    """

    def __init__(self, pdl, mock) -> None:
        self._pdl = pdl
        self._mock = mock

    def search(self, params: dict, limit: int) -> "list[PersonResult]":
        results = self._pdl.search(params, limit)
        if results:
            return results
        return self._mock.search(params, limit)


def get_provider(settings) -> PeopleProvider:
    """Select a people-search provider based on configuration.

    When `settings.pdl_api_key` is set, returns a PDL-backed provider that
    falls back to the mock dataset on empty/error results. Otherwise returns
    the MockProvider so search always works out of the box.
    """
    from app.clients.people.mock import MockProvider
    from app.clients.people.pdl import PDLProvider

    mock = MockProvider()
    if getattr(settings, "pdl_api_key", ""):
        demo_phone = getattr(settings, "pdl_demo_phone", "") or None
        pdl = (
            PDLProvider(settings.pdl_api_key, demo_phone)
            if demo_phone
            else PDLProvider(settings.pdl_api_key)
        )
        return PDLWithMockFallback(pdl, mock)
    return mock
