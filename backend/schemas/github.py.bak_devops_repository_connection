from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class GitHubEventOut(BaseModel):
    id: int
    delivery_id: Optional[str] = None
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    mapped_user_id: Optional[int] = None
    event_type: str
    action: Optional[str] = None
    repository: Optional[str] = None
    sender_login: Optional[str] = None
    task_key: Optional[str] = None
    commit_sha: Optional[str] = None
    pull_request_number: Optional[int] = None
    url: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GitHubPullRequestOut(BaseModel):
    id: int
    project_id: Optional[int] = None
    task_id: Optional[int] = None
    task_key: Optional[str] = None
    task_title: Optional[str] = None
    task_status: Optional[str] = None
    action: Optional[str] = None
    repository: Optional[str] = None
    sender_login: Optional[str] = None
    mapped_user_id: Optional[int] = None
    mapped_user_name: Optional[str] = None
    mapped_user_email: Optional[str] = None
    pull_request_number: Optional[int] = None
    url: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime


class PullRequestConfirmRequest(BaseModel):
    target_status: str = "REVIEW"
    note: Optional[str] = None
