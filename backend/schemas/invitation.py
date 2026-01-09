from pydantic import BaseModel
from typing import Optional

class JoinByCode(BaseModel):
    code: str

class InvitationResponse(BaseModel):
    message: str
    workspace_id: int
    workspace_name: str