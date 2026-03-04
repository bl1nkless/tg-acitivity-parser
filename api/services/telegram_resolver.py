from __future__ import annotations

import os
import shutil
import tempfile
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import RPCError
from telethon.tl.types import Channel, Chat, User
from telethon.utils import get_peer_id

from common.config import ApiSettings


@dataclass(frozen=True)
class ResolvedTelegramUser:
    tg_user_id: int
    username: str | None
    display_name: str | None


@dataclass(frozen=True)
class ResolvedTelegramChat:
    telegram_chat_id: int
    access_hash: int | None
    username: str | None
    title: str | None
    chat_type: str


def normalize_username(username: str) -> str:
    return username.strip().lstrip("@")


def _display_name(entity) -> str | None:
    parts = [getattr(entity, "first_name", None), getattr(entity, "last_name", None)]
    name = " ".join(part for part in parts if part)
    return name or getattr(entity, "title", None)


def _copy_session_for_lookup(session_path: str) -> str:
    source = Path(session_path)
    if not source.exists():
        return session_path

    fd, copied_path = tempfile.mkstemp(prefix="tg_lookup_", suffix=".session")
    os.close(fd)
    shutil.copy2(source, copied_path)
    return copied_path


async def resolve_username(settings: ApiSettings, username: str) -> ResolvedTelegramUser:
    normalized = normalize_username(username)
    if not normalized:
        raise ValueError("Username is required.")
    if settings.tg_api_id is None or not settings.tg_api_hash:
        raise RuntimeError("Telegram API credentials are not configured for username lookup.")

    lookup_session = _copy_session_for_lookup(settings.session_path)
    client = TelegramClient(
        session=lookup_session,
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
        with suppress(Exception):
            await client.disconnect()
        if lookup_session != settings.session_path:
            with suppress(OSError):
                os.remove(lookup_session)

    tg_user_id = getattr(entity, "id", None)
    if not isinstance(tg_user_id, int):
        raise LookupError(f"Telegram user @{normalized} was not found.")

    return ResolvedTelegramUser(
        tg_user_id=tg_user_id,
        username=getattr(entity, "username", None) or normalized,
        display_name=_display_name(entity),
    )


def _chat_type(entity) -> str:
    if isinstance(entity, Channel):
        if getattr(entity, "megagroup", False):
            return "supergroup"
        if getattr(entity, "broadcast", False):
            return "channel"
        return "channel"
    if isinstance(entity, Chat):
        return "group"
    if isinstance(entity, User):
        return "user"
    return "unknown"


async def resolve_chat(settings: ApiSettings, chat_ref: str) -> ResolvedTelegramChat:
    normalized = chat_ref.strip().lstrip("@")
    if not normalized:
        raise ValueError("Chat reference is required.")
    if settings.tg_api_id is None or not settings.tg_api_hash:
        raise RuntimeError("Telegram API credentials are not configured for chat lookup.")

    lookup_session = _copy_session_for_lookup(settings.session_path)
    client = TelegramClient(
        session=lookup_session,
        api_id=settings.tg_api_id,
        api_hash=settings.tg_api_hash,
    )
    try:
        await client.connect()
        if not await client.is_user_authorized():
            raise RuntimeError("Telegram session is not authorized. Run collector login first.")
        entity = await client.get_entity(int(normalized) if normalized.lstrip("-").isdigit() else normalized)
    except (RPCError, ValueError) as exc:
        raise LookupError(f"Telegram chat {chat_ref!r} was not found or is not accessible.") from exc
    finally:
        with suppress(Exception):
            await client.disconnect()
        if lookup_session != settings.session_path:
            with suppress(OSError):
                os.remove(lookup_session)

    telegram_chat_id = get_peer_id(entity)
    if not isinstance(telegram_chat_id, int):
        raise LookupError(f"Telegram chat {chat_ref!r} was not found or is not accessible.")

    return ResolvedTelegramChat(
        telegram_chat_id=telegram_chat_id,
        access_hash=getattr(entity, "access_hash", None),
        username=getattr(entity, "username", None),
        title=getattr(entity, "title", None) or _display_name(entity),
        chat_type=_chat_type(entity),
    )
