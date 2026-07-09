from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectTeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    manager_membership_id: Optional[int] = None


class ProjectTeamUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None
    manager_membership_id: Optional[int] = None


class ProjectTeamOut(BaseModel):
    id: int
    project_id: int
    parent_id: Optional[int] = None
    manager_membership_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    member_count: int = 0
    task_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class ProjectMemberTeamUpdate(BaseModel):
    team_id: Optional[int] = None
