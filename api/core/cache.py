from __future__ import annotations

from functools import lru_cache
from typing import AsyncGenerator

from redis.asyncio import Redis

from common.config import RedisSettings

from .config import get_settings


@lru_cache(maxsize=1)
def _get_redis_client() -> Redis:
    redis_settings: RedisSettings = get_settings().redis
    return Redis.from_url(redis_settings.url, decode_responses=True)


async def get_redis() -> AsyncGenerator[Redis, None]:
    client = _get_redis_client()
    try:
        yield client
    finally:
        # connection is managed globally, do not close per request
        pass
