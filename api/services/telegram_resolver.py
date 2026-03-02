from __future__ import annotations

from dataclasses import dataclass

from telethon import TelegramClient
from telethon.errors import RPCError

from common.config import ApiSettings


@dataclass(frozen=True)
class ResolvedTelegramUser:
    tg_user_id: int
    username: str | None
    display_name: str | None


def normalize_username(username: str) -> str:
    return username.strip().lstrip("@")


def _display_name(entity) -> str | None:
    parts = [getattr(entity, "first_name", None), getattr(entity, "last_name", None)]
    name = " ".join(part for part in parts if part)
    return name or getattr(entity, "title", None)


async def resolve_username(settings: ApiSettings, username: str) -> ResolvedTelegramUser:
    normalized = normalize_username(username)
    if not normalized:
        raise ValueError("Username is required.")
    if settings.tg_api_id is None or not settings.tg_api_hash:
        raise RuntimeError("Telegram API credentials are not configured for username lookup.")

    client = TelegramClient(
        session=settings.session_path,
        api_id=settings.tg_api_id,
        api_hash=settings.tg_api_hash,
    )
    try:
        await client.connect()
        if not await client.is_user_authorized():
            raise RuntimeError("Telegram session is not authorized. Run collector login first.")
        entity = await client.get_entity(normalized)
    except (RPCError, ValueError) as exc:
        raise LookupError(f"Telegram user @{normalized} was not found.") from exc
    finally:
        await client.disconnect()

    tg_user_id = getattr(entity, "id", None)
    if not isinstance(tg_user_id, int):
        raise LookupError(f"Telegram user @{normalized} was not found.")

    return ResolvedTelegramUser(
        tg_user_id=tg_user_id,
        username=getattr(entity, "username", None) or normalized,
        display_name=_display_name(entity),
    )
