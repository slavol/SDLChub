from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from pydantic import BaseModel

from database.session import get_db
from models.project import Project, Methodology
from models.workspace import Workspace, WorkspaceMember
from models.user import User
from schemas.project import ProjectCreate, AIRequest, ProjectOut
from routers.auth import get_current_user
from services.ai_advisor import get_methodology_recommendation, client

router = APIRouter(prefix="/projects", tags=["Projects"])

class RolesRequest(BaseModel):
    methodology: str
    project_description: str

# 1. AI Advisor (Metodologie)
@router.post("/ai-recommend")
def ask_ai_methodology(request: AIRequest, current_user: User = Depends(get_current_user)):
    return get_methodology_recommendation(request.dict())

# 2. AI Roles (Sugestii Roluri)
@router.post("/ai-roles")
def ask_ai_roles(request: RolesRequest, current_user: User = Depends(get_current_user)):
    if not client:
        return {"roles": [{"name": "Member", "description": "Standard user"}]}

    prompt = f"""
    Based on the methodology '{request.methodology}' and project description '{request.project_description}', 
    suggest 3-4 key roles for the team.
    
    Return ONLY a JSON object with this exact structure:
    {{
        "roles": [
            {{ "name": "Role Name", "description": "Short description (max 10 words)" }}
        ]
    }}
    """
    
    try:
        # FOLOSIM UN MODEL GENERIC MAI SIGUR
        response = client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=prompt
        )
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        print(f"AI Error: {e}")
        # Fallback silentios
        return {"roles": [
            {"name": "Manager", "description": "Leads the project"},
            {"name": "Developer", "description": "Builds the software"}
        ]}

# 3. Get My Projects
@router.get("/mine", response_model=List[ProjectOut])
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == current_user.id).all()
    workspace_ids = [m.workspace_id for m in memberships]
    
    if not workspace_ids:
        return []
    
    projects = db.query(Project).filter(Project.workspace_id.in_(workspace_ids)).all()
    return projects

# 4. Create Project
@router.post("/{workspace_id}")
def create_project(
    workspace_id: int,
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    is_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="Permission denied")
        
    new_project = Project(
        workspace_id=workspace.id,
        name=project_data.name,
        key=project_data.key.upper(),
        description=project_data.description,
        methodology=project_data.methodology
    )
    
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    return new_project