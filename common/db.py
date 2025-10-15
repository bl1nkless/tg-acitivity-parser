from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import DatabaseSettings

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


def get_engine(settings: DatabaseSettings) -> AsyncEngine:
    """Create or return a cached async engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.url,
            echo=settings.echo,
            pool_size=settings.pool_size,
            max_overflow=settings.max_overflow,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory(settings: DatabaseSettings) -> async_sessionmaker[AsyncSession]:
    """Return async session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(settings), expire_on_commit=False)
    return _session_factory


@asynccontextmanager
async def session_scope(
    settings: DatabaseSettings,
) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional scope for a series of operations."""
    session_factory = get_session_factory(settings)
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:  # pragma: no cover - defensive
        await session.rollback()
        raise
    finally:
        await session.close()
