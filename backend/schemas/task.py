from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

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
    assignee_id: Optional[int] = None
    project_id: int
    sprint_id: Optional[int] = None # <--- Opțional, dacă vrei să creezi direct în sprint

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    story_points: Optional[int] = None  # <--- NECESAR pentru Governance (doar SM/Tech Lead)
    assignee_id: Optional[int] = None
    sprint_id: Optional[int] = None     # <--- NECESAR pentru Drag & Drop în Backlog

class TaskOut(BaseModel):
    id: int
    key: str
    title: str
    description: Optional[str]
    status: TaskStatus
    priority: TaskPriority
    story_points: Optional[int]
    assignee_id: Optional[int]
    project_id: int
    sprint_id: Optional[int]        # <--- NECESAR ca Frontend-ul să știe unde e task-ul
    created_at: datetime

    class Config:
        from_attributes = True