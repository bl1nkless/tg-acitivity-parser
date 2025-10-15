from __future__ import annotations

import asyncio
import os

from telethon import TelegramClient

from common.config import CollectorSettings, load_collector_settings


async def main() -> None:
    settings: CollectorSettings = load_collector_settings()
    session_path = settings.session_path
    os.makedirs(os.path.dirname(session_path), exist_ok=True)

    client = TelegramClient(
        session=session_path,
        api_id=settings.tg_api_id,
        api_hash=settings.tg_api_hash,
    )

    await client.start()  # interactive login
    filename = getattr(client.session, "filename", session_path)
    print(f"Session stored at {filename}")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
