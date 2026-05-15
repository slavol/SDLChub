from datetime import datetime
from typing import List, Optional, Literal

from pydantic import BaseModel, EmailStr, Field

from backend.schemas.user import UserOut


MethodologyLiteral = Literal["SCRUM", "KANBAN", "SCRUMBAN"]


# --- AI ADVISOR ---
class AIRequest(BaseModel):
    team_size: str
    work_nature: str
    volatility: str
    experience: str
    metrics: str


class AIResponse(BaseModel):
    recommended: MethodologyLiteral
    confidence_score: int
    reasoning: str
    pros: List[str]
    cons: List[str]


class AIRoleRequest(BaseModel):
    methodology: MethodologyLiteral
    description: str


# --- PROJECT WIZARD PAYLOAD ---
class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: Optional[str] = None
    emails: List[EmailStr] = Field(default_factory=list)


class ProjectCreateFull(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    key: str = Field(min_length=2, max_length=10)
    description: Optional[str] = None
    methodology: MethodologyLiteral
    roles: List[RoleCreate]


# --- RESPONSES ---
class ProjectOut(BaseModel):
    id: int
    name: str
    key: str
    description: Optional[str] = None
    methodology: str
    logo_url: Optional[str] = None
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectMemberOut(BaseModel):
    membership_id: int
    user: UserOut
    role: Optional[RoleOut] = None
    joined_at: datetime


class InvitationOut(BaseModel):
    id: int
    email: EmailStr
    project_id: int
    project_name: str
    role_id: int
    role_name: str
    code: str
    status: str
    created_at: datetime


class OnboardingStatusOut(BaseModel):
    has_projects: bool
    has_pending_invites: bool
    projects: List[ProjectOut]
