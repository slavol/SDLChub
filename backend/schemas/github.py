from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field





class GitHubIntegrationUpsert(BaseModel):
    repository_full_name: str = Field(min_length=3, max_length=240)
    repository_url: Optional[str] = None
    default_branch: Optional[str] = "main"
    webhook_url: Optional[str] = None
    auto_link_commits: bool = True
    auto_transition_prs: bool = True


class GitHubIntegrationOut(BaseModel):
    id: Optional[int] = None
    project_id: int
    configured: bool = False
    repository_full_name: Optional[str] = None
    repository_url: Optional[str] = None
    default_branch: Optional[str] = "main"
    webhook_url: Optional[str] = None
    webhook_endpoint_path: str = "/github/webhook"
    setup_status: str = "NOT_CONFIGURED"
    auto_link_commits: bool = True
    auto_transition_prs: bool = True
    secret_configured: bool = False
    webhook_secret_hint: Optional[str] = None
    last_ping_at: Optional[datetime] = None
    last_delivery_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GitHubIntegrationTestOut(BaseModel):
    configured: bool
    secret_configured: bool
    status: str
    message: str
    repository_full_name: Optional[str] = None
    webhook_url: Optional[str] = None
    last_ping_at: Optional[datetime] = None
    last_delivery_at: Optional[datetime] = None


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
