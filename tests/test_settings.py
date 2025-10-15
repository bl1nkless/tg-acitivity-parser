from common.config import load_api_settings, load_collector_settings


def test_api_settings_defaults():
    load_api_settings.cache_clear()
    settings = load_api_settings()
    assert settings.database.url.startswith("postgresql")
    assert "http://localhost:3000" in settings.allow_origins


def test_collector_settings_defaults(monkeypatch):
    load_collector_settings.cache_clear()
    monkeypatch.setenv("TG_API_ID", "123")
    monkeypatch.setenv("TG_API_HASH", "hash")
    settings = load_collector_settings()
    assert settings.tg_api_id == 123
    assert settings.session_path.endswith(".session")
