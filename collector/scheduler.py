from __future__ import annotations

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .status_tracker import StatusTracker


class CollectorScheduler:
    def __init__(self, tracker: StatusTracker, client):
        self.tracker = tracker
        self.client = client
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self.logger = structlog.get_logger("collector.scheduler")

    def start(self) -> None:
        self.scheduler.add_job(self._close_stale_wrapper, "interval", seconds=60, id="close_stale_sessions")
        self.scheduler.add_job(
            self._poll_statuses_wrapper,
            "interval",
            seconds=self.tracker.settings.light_poll_interval_seconds,
            id="poll_tracked_statuses",
        )
        self.scheduler.add_job(
            self._sync_tracked_wrapper,
            "interval",
            minutes=5,
            id="sync_tracked_users",
        )
        self.scheduler.start()

    async def _close_stale_wrapper(self) -> None:
        closed = await self.tracker.close_stale_sessions()
        if closed:
            self.logger.info("stale_sessions_closed", count=closed)

    async def _sync_tracked_wrapper(self) -> None:
        synced = await self.tracker.sync_tracked_users(self.client)
        if synced:
            self.logger.info("tracked_users_synced", count=synced)

    async def _poll_statuses_wrapper(self) -> None:
        changed = await self.tracker.poll_tracked_statuses(self.client)
        if changed:
            self.logger.info("tracked_statuses_polled", changed=changed)

    def shutdown(self) -> None:
        self.scheduler.shutdown(wait=False)
