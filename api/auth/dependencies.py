from __future__ import annotations

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from common.models import AccountUser, UserRole
from common.security import create_access_token, decode_access_token

from ..core.config import get_settings
from ..core.db import get_db
from .service import get_user_by_email


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


async def get_current_user(
    token: str = Security(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> AccountUser:
    settings = get_settings()
    payload = decode_access_token(token, settings.security)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await get_user_by_email(session, email)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
    return user


async def get_current_admin(user: AccountUser = Depends(get_current_user)) -> AccountUser:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return user


def issue_token(user: AccountUser) -> str:
    settings = get_settings()
    return create_access_token(user.email, user.role, settings.security)
