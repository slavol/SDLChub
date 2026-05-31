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
    recurrence_mode: str = "none"
    recurrence_until: Optional[datetime] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=160)
    description: Optional[str] = None
    event_type: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    location: Optional[str] = None
    meeting_url: Optional[str] = None
    attendee_ids: Optional[List[int]] = None
    recurrence_mode: Optional[str] = None
    recurrence_until: Optional[datetime] = None


class CalendarAvailabilityCreate(BaseModel):
    user_id: Optional[int] = None
    status: str = "VACATION"
    title: Optional[str] = Field(default=None, max_length=160)
    starts_at: datetime
    ends_at: datetime
    all_day: bool = True
    note: Optional[str] = None


class CalendarAvailabilityUpdate(BaseModel):
    user_id: Optional[int] = None
    status: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=160)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    all_day: Optional[bool] = None
    note: Optional[str] = None


class CalendarAvailabilityOut(BaseModel):
    id: int
    project_id: int
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_avatar_url: Optional[str] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    status: str
    title: Optional[str] = None
    starts_at: datetime
    ends_at: datetime
    all_day: bool = True
    note: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


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
    recurrence_series_id: Optional[str] = None
    recurrence_mode: str = "none"
    recurrence_until: Optional[datetime] = None
    created_by_id: int
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
