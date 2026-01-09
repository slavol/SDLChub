from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- AI ADVISOR ---
class AIRequest(BaseModel):
    team_size: str
    work_nature: str
    volatility: str
    experience: str
    metrics: str

class AIResponse(BaseModel):
    recommended: str # SCRUM, KANBAN, SCRUMBAN
    confidence_score: int
    reasoning: str
    pros: List[str]
    cons: List[str]

class AIRoleRequest(BaseModel):
    methodology: str
    description: str

# --- CREARE PROIECT (WIZARD PAYLOAD) ---
class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    emails: List[str] = [] # Lista de oameni de invitat pe acest rol

class ProjectCreateFull(BaseModel):
    name: str
    key: str
    description: Optional[str] = None
    methodology: str
    # Aici primim lista completă de roluri și invitații din pasul 4 al Wizard-ului
    roles: List[RoleCreate]

# --- RĂSPUNSURI (Ce trimitem la Dashboard) ---
class ProjectOut(BaseModel):
    id: int
    name: str
    key: str
    methodology: str
    logo_url: Optional[str] = None
    owner_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True