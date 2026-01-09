from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ProjectCreate(BaseModel):
    name: str
    key: str
    methodology: str # SCRUM, KANBAN, SCRUMBAN
    description: Optional[str] = None

class AIRequest(BaseModel):
    team_size: str
    work_nature: str
    volatility: str
    experience: str
    metrics: str

# ACEASTA TREBUIE SĂ EXISTE PENTRU DASHBOARD:
class ProjectOut(BaseModel):
    id: int
    name: str
    key: str
    methodology: str
    workspace_id: int
    description: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True