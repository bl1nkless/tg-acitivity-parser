from __future__ import annotations

from functools import lru_cache

from common.config import ApiSettings, load_api_settings
from common.logging import configure_logging


@lru_cache(maxsize=1)
def get_settings() -> ApiSettings:
    settings = load_api_settings()
    configure_logging(settings.telemetry.log_level, settings.telemetry.sentry_dsn)
    return settings
