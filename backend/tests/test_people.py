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


def test_get_provider_returns_pdl_fallback_when_key_set(monkeypatch):
    from app.clients.people.base import PDLWithMockFallback

    monkeypatch.setenv("PDL_API_KEY", "test-key-123")
    get_settings.cache_clear()
    provider = get_provider(get_settings())
    # PDL-backed, but wrapped so it falls back to mock on empty/error.
    assert isinstance(provider, PDLWithMockFallback)
    assert isinstance(provider._pdl, PDLProvider)
    assert isinstance(provider._mock, MockProvider)
    get_settings.cache_clear()
    monkeypatch.delenv("PDL_API_KEY", raising=False)
    get_settings.cache_clear()


def test_pdl_fallback_uses_mock_when_pdl_returns_empty():
    from app.clients.people.base import PDLWithMockFallback

    class EmptyPDL:
        def search(self, params, limit):
            return []

    provider = PDLWithMockFallback(EmptyPDL(), MockProvider())
    results = provider.search({"titles": ["Delivery Rider"], "locations": ["Bangalore"]}, 5)
    # PDL returned nothing → mock supplies demo-safe results.
    assert len(results) >= 1


def test_pdl_fallback_prefers_pdl_when_it_has_results():
    from app.clients.people.base import PDLWithMockFallback, PersonResult

    class RealPDL:
        def search(self, params, limit):
            return [PersonResult(name="Real Person", title="X", company="Y",
                                 location="Z", phone="+911234567890")]

    provider = PDLWithMockFallback(RealPDL(), MockProvider())
    results = provider.search({"titles": ["Delivery Rider"]}, 5)
    assert len(results) == 1 and results[0].name == "Real Person"


def test_mock_provider_falls_back_when_nothing_matches():
    provider = MockProvider()
    params = {"titles": ["Nonexistent Role XYZ"], "locations": ["Atlantis"], "skills": []}
    results = provider.search(params, limit=5)
    assert 1 <= len(results) <= 5


def test_different_jds_return_different_top_results():
    client = TestClient(app)
    r1 = client.post("/api/search", json={"jd": "Security guard in Delhi", "limit": 5})
    r2 = client.post("/api/search", json={"jd": "Cook in Chennai", "limit": 5})
    assert r1.status_code == 200
    assert r2.status_code == 200
    names1 = [c["name"] for c in r1.json()]
    names2 = [c["name"] for c in r2.json()]
    assert names1 != names2


def test_warehouse_packer_jd_returns_relevant_candidates():
    client = TestClient(app)
    r = client.post("/api/search", json={"jd": "Warehouse packer in Mumbai", "limit": 10})
    assert r.status_code == 200
    body = r.json()
    assert len(body) >= 1
    assert any("warehouse" in c["title"].lower() for c in body)


def test_vague_jd_still_returns_limit_results_with_seeded_variety():
    client = TestClient(app)
    r1 = client.post("/api/search", json={"jd": "We are hiring for our team.", "limit": 5})
    r2 = client.post("/api/search", json={"jd": "Great opportunity, apply now!", "limit": 5})
    assert r1.status_code == 200
    assert r2.status_code == 200
    body1 = r1.json()
    body2 = r2.json()
    assert 1 <= len(body1) <= 5
    assert 1 <= len(body2) <= 5
    names1 = [c["name"] for c in body1]
    names2 = [c["name"] for c in body2]
    assert names1 != names2
