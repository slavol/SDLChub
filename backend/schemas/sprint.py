from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SprintOut(BaseModel):
    id: int
    project_id: int
    name: str
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: bool

    class Config:
        from_attributes = True
