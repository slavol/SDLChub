from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CalendarEventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: Optional[str] = None
    event_type: str = "MEETING"
    starts_at: datetime
    ends_at: datetime
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendee_ids: List[int] = Field(default_factory=list)


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = None
    event_type: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendee_ids: Optional[List[int]] = None


class CalendarEventOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: Optional[str] = None
    event_type: str
    starts_at: datetime
    ends_at: datetime
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendee_ids: List[int] = Field(default_factory=list)
    created_by_id: int
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
