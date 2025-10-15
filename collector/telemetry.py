from __future__ import annotations

import asyncio
from collections import Counter
from contextlib import asynccontextmanager

import structlog


class CollectorMetrics:
    def __init__(self) -> None:
        self._counters = Counter()
        self.logger = structlog.get_logger("collector.metrics")
        self._lock = asyncio.Lock()

    async def incr(self, name: str, value: int = 1, **fields) -> None:
        async with self._lock:
            self._counters[name] += value
        self.logger.info("metric_increment", metric=name, value=value, **fields)

    def snapshot(self) -> dict[str, int]:
        return dict(self._counters)
