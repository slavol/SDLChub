from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    type: str
    title: str
    message: Optional[str] = None
    link_url: Optional[str] = None
    metadata_json: Optional[str] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
