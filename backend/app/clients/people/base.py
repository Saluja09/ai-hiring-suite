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


class PeopleProvider(Protocol):
    def search(self, params: dict, limit: int) -> list[PersonResult]: ...


def get_provider(settings) -> PeopleProvider:
    """Select a people-search provider based on configuration.

    Returns a PDLProvider when `settings.pdl_api_key` is set, otherwise
    falls back to the MockProvider so search always works out of the box.
    """
    from app.clients.people.mock import MockProvider
    from app.clients.people.pdl import PDLProvider

    if getattr(settings, "pdl_api_key", ""):
        return PDLProvider(settings.pdl_api_key)
    return MockProvider()
