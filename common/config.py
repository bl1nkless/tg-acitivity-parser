from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class BaseAppSettings(BaseSettings):
    """Base settings loader with shared defaults."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


class DatabaseSettings(BaseAppSettings):
    url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/postgres",
        alias="DATABASE_URL",
    )
    pool_size: int = Field(default=10, alias="DB_POOL_SIZE")
    max_overflow: int = Field(default=5, alias="DB_MAX_OVERFLOW")
    echo: bool = Field(default=False, alias="DB_ECHO")


class RedisSettings(BaseAppSettings):
    url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")


class TelemetrySettings(BaseAppSettings):
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    sentry_dsn: Optional[str] = Field(default=None, alias="SENTRY_DSN")


class SecuritySettings(BaseAppSettings):
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(default=60 * 24, alias="JWT_EXPIRE_MINUTES")


class ApiSettings(BaseAppSettings):
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    telemetry: TelemetrySettings = Field(default_factory=TelemetrySettings)
    tz: str = Field(default="Europe/Kyiv", alias="TZ")
    allow_origins: List[str] = Field(default_factory=lambda: ["http://localhost:3000"], alias="ALLOW_ORIGINS")
    admin_email: Optional[str] = Field(default=None, alias="ADMIN_EMAIL")
    admin_password: Optional[str] = Field(default=None, alias="ADMIN_PASSWORD")
    tg_api_id: Optional[int] = Field(default=None, alias="TG_API_ID")
    tg_api_hash: Optional[str] = Field(default=None, alias="TG_API_HASH")
    session_path: str = Field(default="session_store/collector.session", alias="SESSION_PATH")

    @field_validator("allow_origins", mode="before")
    @classmethod
    def parse_allow_origins(cls, value: Optional[Any]) -> List[str]:
        if value is None:
            return ["http://localhost:3000"]
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return ["http://localhost:3000"]
            # allow JSON-style list or comma-separated string
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            except json.JSONDecodeError:
                pass
            return [item.strip() for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        return ["http://localhost:3000"]


class CollectorSettings(BaseAppSettings):
    database: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    telemetry: TelemetrySettings = Field(default_factory=TelemetrySettings)
    tz: str = Field(default="Europe/Kyiv", alias="TZ")
    tg_api_id: int = Field(alias="TG_API_ID")
    tg_api_hash: str = Field(alias="TG_API_HASH")
    session_path: str = Field(default="session_store/collector.session", alias="SESSION_PATH")
    polling_backoff_seconds: int = Field(default=120, alias="POLL_BACKOFF_SECONDS")
    ttl_grace_seconds: int = Field(default=30, alias="TTL_GRACE_SECONDS")
    light_poll_interval_seconds: int = Field(default=30, alias="POLL_INTERVAL_SECONDS")
    burst_poll_window_seconds: int = Field(default=120, alias="BURST_WINDOW_SECONDS")


@lru_cache(maxsize=1)
def load_api_settings() -> ApiSettings:
    return ApiSettings()


@lru_cache(maxsize=1)
def load_collector_settings() -> CollectorSettings:
    return CollectorSettings()
