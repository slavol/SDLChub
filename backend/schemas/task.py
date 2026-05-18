from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    DONE = "DONE"


class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    story_points: Optional[int] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None
    project_id: int
    sprint_id: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    story_points: Optional[int] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None


class TaskOut(BaseModel):
    id: int
    key: str
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    story_points: Optional[int]
    due_date: Optional[datetime] = None
    assignee_id: Optional[int]
    assignee_name: Optional[str] = None
    assignee_avatar_url: Optional[str] = None
    project_id: int
    sprint_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class SubtaskCreate(BaseModel):
    title: str


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_done: Optional[bool] = None


class SubtaskOut(BaseModel):
    id: int
    task_id: int
    title: str
    is_done: bool
    created_by_id: Optional[int]
    created_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TaskCommentCreate(BaseModel):
    body: str


class TaskCommentUpdate(BaseModel):
    body: str


class TaskCommentOut(BaseModel):
    id: int
    task_id: int
    author_id: int
    author_name: Optional[str] = None
    author_avatar_url: Optional[str] = None
    body: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskAuditLogOut(BaseModel):
    id: int
    task_id: int
    actor_id: Optional[int]
    actor_name: Optional[str] = None
    actor_avatar_url: Optional[str] = None
    action: str
    field: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskDetailOut(TaskOut):
    subtasks: List[SubtaskOut] = Field(default_factory=list)
    comments: List[TaskCommentOut] = Field(default_factory=list)
    audit_logs: List[TaskAuditLogOut] = Field(default_factory=list)
