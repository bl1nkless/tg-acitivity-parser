from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser, UserRole
from common.security import hash_password, verify_password


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[AccountUser]:
    result = await session.execute(select(AccountUser).where(AccountUser.email == email))
    return result.scalar_one_or_none()


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    role: UserRole = UserRole.VIEWER,
) -> AccountUser:
    now = _utcnow()
    user = AccountUser(
        email=email.lower(),
        password_hash=hash_password(password),
        role=role,
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    session.add(user)
    await session.flush()
    return user


async def update_password(session: AsyncSession, user: AccountUser, password: str) -> AccountUser:
    user.password_hash = hash_password(password)
    user.updated_at = _utcnow()
    await session.flush()
    return user


async def authenticate_user(session: AsyncSession, email: str, password: str) -> Optional[AccountUser]:
    user = await get_user_by_email(session, email)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def ensure_bootstrap_admin(
    session: AsyncSession,
    *,
    email: Optional[str],
    password: Optional[str],
) -> Optional[AccountUser]:
    if not email or not password:
        return None

    user = await get_user_by_email(session, email)
    if user:
        return user

    return await create_user(session, email=email, password=password, role=UserRole.ADMIN)
