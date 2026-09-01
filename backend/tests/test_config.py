from app.config import get_settings


def test_settings_defaults(monkeypatch):
    monkeypatch.setenv("HUNAR_API_KEY", "test_key")
    get_settings.cache_clear()
    s = get_settings()
    assert s.hunar_api_key == "test_key"
    assert s.hunar_base_url.endswith("/external/v1")
    assert s.database_url.startswith("sqlite")


def test_settings_use_isolated_test_database():
    # Guards against regressing to the production ./app.db during tests
    # (see backend/tests/conftest.py for the isolation mechanism).
    assert get_settings().database_url != "sqlite:///./app.db"
