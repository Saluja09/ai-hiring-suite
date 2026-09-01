from fastapi.testclient import TestClient

from app.clients.people.base import get_provider
from app.clients.people.mock import MockProvider
from app.clients.people.pdl import PDLProvider
from app.config import get_settings
from app.main import app


def test_search_returns_mock_candidates(monkeypatch):
    monkeypatch.delenv("PDL_API_KEY", raising=False)
    get_settings.cache_clear()
    client = TestClient(app)
    r = client.post("/api/search", json={"jd": "Delivery Riders in Bangalore", "limit": 3})
    assert r.status_code == 200
    body = r.json()
    assert 1 <= len(body) <= 3
    assert body[0]["phone"].startswith("+")


def test_get_provider_returns_mock_when_no_pdl_key(monkeypatch):
    monkeypatch.delenv("PDL_API_KEY", raising=False)
    get_settings.cache_clear()
    provider = get_provider(get_settings())
    assert isinstance(provider, MockProvider)
    get_settings.cache_clear()


def test_get_provider_returns_pdl_when_key_set(monkeypatch):
    monkeypatch.setenv("PDL_API_KEY", "test-key-123")
    get_settings.cache_clear()
    provider = get_provider(get_settings())
    assert isinstance(provider, PDLProvider)
    get_settings.cache_clear()
    monkeypatch.delenv("PDL_API_KEY", raising=False)
    get_settings.cache_clear()


def test_mock_provider_falls_back_when_nothing_matches():
    provider = MockProvider()
    params = {"titles": ["Nonexistent Role XYZ"], "locations": ["Atlantis"], "skills": []}
    results = provider.search(params, limit=5)
    assert 1 <= len(results) <= 5
