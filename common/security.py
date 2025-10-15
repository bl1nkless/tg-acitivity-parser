from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import SecuritySettings
from .models import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(
    subject: str,
    role: UserRole,
    security: SecuritySettings,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=security.access_token_expire_minutes))
    payload: dict[str, Any] = {"sub": subject, "role": role.value, "exp": expire}
    return jwt.encode(payload, security.jwt_secret, algorithm=security.jwt_algorithm)


def decode_access_token(token: str, security: SecuritySettings) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, security.jwt_secret, algorithms=[security.jwt_algorithm])
    except JWTError:
        return None
