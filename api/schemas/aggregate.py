from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel


class HourlyAggregate(BaseModel):
    bucket_start: datetime
    online_seconds: int

    class Config:
        from_attributes = True


class HeatmapCell(BaseModel):
    weekday: int  # 0=Monday
    hour: int
    online_seconds: int


class HeatmapResponse(BaseModel):
    tg_user_id: int
    cells: List[HeatmapCell]
