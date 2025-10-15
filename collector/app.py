from __future__ import annotations

import asyncio
import signal

import structlog
from redis.asyncio import Redis
from telethon import TelegramClient, events

from common.config import CollectorSettings, load_collector_settings
from common.logging import configure_logging

from .scheduler import CollectorScheduler
from .status_tracker import StatusTracker


async def _create_telegram_client(settings: CollectorSettings) -> TelegramClient:
    return TelegramClient(
        session=settings.session_path,
        api_id=settings.tg_api_id,
        api_hash=settings.tg_api_hash,
    )


async def main() -> None:
    settings = load_collector_settings()
    configure_logging(settings.telemetry.log_level, settings.telemetry.sentry_dsn)
    logger = structlog.get_logger("collector.app")

    redis = Redis.from_url(settings.redis.url, decode_responses=True)
    tracker = StatusTracker(settings, redis)
    client = await _create_telegram_client(settings)
    scheduler = CollectorScheduler(tracker, client)

    @client.on(events.Raw)
    async def _(raw_update) -> None:
        try:
            await tracker.handle_update(raw_update)
        except Exception as exc:  # pragma: no cover
            logger.exception("failed_to_handle_update", error=str(exc))

    scheduler.start()

    loop = asyncio.get_running_loop()

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(client.disconnect()))

    await client.connect()
    if not await client.is_user_authorized():
        logger.error("mtproto_session_missing", message="Run `python -m collector.login` to create session.")
        return

    await tracker.sync_tracked_users(client)

    logger.info("collector_started")
    try:
        await client.run_until_disconnected()
    finally:
        scheduler.shutdown()
        await redis.close()
        logger.info("collector_stopped")


if __name__ == "__main__":
    asyncio.run(main())
