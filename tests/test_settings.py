from common.config import load_api_settings, load_collector_settings


def test_api_settings_defaults():
    load_api_settings.cache_clear()
    settings = load_api_settings()
    assert settings.database.url.startswith("postgresql")
    assert "http://localhost:3000" in settings.allow_origins
    assert settings.chat_authors_enabled is True
    assert settings.chat_authors_max_lookback_days == 30


def test_collector_settings_defaults(monkeypatch):
    load_collector_settings.cache_clear()
    monkeypatch.setenv("TG_API_ID", "123")
    monkeypatch.setenv("TG_API_HASH", "hash")
    settings = load_collector_settings()
    assert settings.tg_api_id == 123
    assert settings.session_path.endswith(".session")
    assert settings.chat_authors_history_wait_seconds == 1.5
    assert settings.chat_authors_max_messages_per_job == 100_000
