from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# --- WORKSPACE ---
class WorkspaceCreate(BaseModel):
    name: str

class WorkspaceOut(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- INVITATIONS ---
class InvitationCreate(BaseModel):
    email: EmailStr
    role_id: int # Vom folosi ID-uri pentru roluri (ex: 1=Admin, 2=Member)

class InvitationOut(BaseModel):
    id: int
    email: str
    workspace_id: int
    role_id: int
    status: str
    token: str

    class Config:
        from_attributes = True