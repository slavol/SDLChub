from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AdminOverview(BaseModel):
    users: int
    projects: int
    tasks: int
    open_tickets: int
    errors_last_24h: int
    ai_configured: bool
    ai_requests: int = 0
    ai_requests_24h: int = 0


class AdminProjectOut(BaseModel):
    id: int
    name: str
    key: str
    methodology: str
    is_archived: bool = False
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    members_count: int
    tasks_count: int
    created_at: Optional[datetime] = None


class SupportTicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: Optional[str] = None
    priority: str = "MEDIUM"


class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class SupportTicketCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class SupportTicketCommentOut(BaseModel):
    id: int
    ticket_id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    body: str
    is_admin_note: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SupportTicketOut(BaseModel):
    id: int
    reporter_id: Optional[int] = None
    reporter_email: Optional[str] = None
    reporter_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: str
    status: str
    comments_count: int = 0
    comments: list[SupportTicketCommentOut] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class HttpErrorLogOut(BaseModel):
    id: int
    method: str
    path: str
    status_code: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    detail: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AiUsageLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    feature: str
    provider: str
    source: Optional[str] = None
    status: str
    detail: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminUserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_global_admin: bool
    projects_count: int
    owned_projects_count: int
    assigned_tasks_count: int


class AdminUserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_global_admin: Optional[bool] = None


class AdminProjectArchiveUpdate(BaseModel):
    is_archived: bool


class AdminProjectDeleteRequest(BaseModel):
    confirmation_key: str = Field(min_length=1, max_length=20)
