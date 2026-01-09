from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database.session import get_db
from models.workspace import Workspace, WorkspaceMember, Role
from models.user import User
from schemas.workspace import WorkspaceCreate, WorkspaceOut
from utils.security import create_access_token # Vom avea nevoie pt auth middleware (tbd)
from routers.auth import get_current_user # Vom crea asta imediat

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

# 1. Creare Workspace (Onboarding Wizard)
@router.post("/", response_model=WorkspaceOut)
def create_workspace(
    workspace_data: WorkspaceCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # A. Creăm Workspace-ul
    new_workspace = Workspace(
        name=workspace_data.name,
        owner_id=current_user.id
    )
    db.add(new_workspace)
    db.commit()
    db.refresh(new_workspace)

    # B. Creăm Rolurile Default pentru acest Workspace
    # (Fiecare firmă are propriile definiții de roluri)
    admin_role = Role(workspace_id=new_workspace.id, name="Admin", permissions={"all": True})
    member_role = Role(workspace_id=new_workspace.id, name="Member", permissions={"can_view": True})
    
    db.add(admin_role)
    db.add(member_role)
    db.commit() # Commit ca să avem ID-urile rolurilor

    # C. Adăugăm Creatorul ca Membru (cu rol de Admin)
    member_entry = WorkspaceMember(
        user_id=current_user.id,
        workspace_id=new_workspace.id,
        role_id=admin_role.id
    )
    db.add(member_entry)
    db.commit()

    return new_workspace

# 2. Listare Workspace-urile mele
@router.get("/", response_model=List[WorkspaceOut])
def get_my_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Căutăm în tabelul de legătură
    memberships = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == current_user.id).all()
    
    # Extragem workspace-urile
    workspaces = []
    for m in memberships:
        workspaces.append(m.workspace)
        
    return workspaces