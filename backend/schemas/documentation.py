from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DocumentationPageCreate(BaseModel):
    title: str = Field(min_length=2, max_length=180)
    content: str = Field(min_length=1)
    task_id: Optional[int] = None


class DocumentationPageUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=180)
    content: Optional[str] = Field(default=None, min_length=1)
    task_id: Optional[int] = None


class DocumentationPageOut(BaseModel):
    id: int
    project_id: int
    task_id: Optional[int] = None
    title: str
    content: str
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
