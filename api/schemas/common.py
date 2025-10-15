from __future__ import annotations

from typing import Generic, Optional, Sequence, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: Sequence[T]
    total: int
    limit: int
    offset: int


class DeleteResponse(BaseModel):
    deleted: bool
    detail: Optional[str] = None
