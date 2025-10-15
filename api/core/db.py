from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from common.db import get_session_factory

from .config import get_settings


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    settings = get_settings()
    session_factory = get_session_factory(settings.database)
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
