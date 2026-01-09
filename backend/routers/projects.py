from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import secrets

from database.session import get_db
from models.user import User
from models.project import Project, Role, ProjectMember, Invitation
from schemas.project import AIRequest, AIResponse, AIRoleRequest, ProjectCreateFull, ProjectOut
from routers.auth import get_current_user
from services.ai_advisor import get_methodology_recommendation, get_role_suggestions
from pydantic import BaseModel
from utils.email import send_project_invitation_email

router = APIRouter(prefix="/projects", tags=["Projects"])

class JoinRequest(BaseModel):
    code: str

@router.post("/join")
def join_project(
    data: JoinRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Căutăm invitația
    invite = db.query(Invitation).filter(
        Invitation.code == data.code,
        Invitation.status == "PENDING"
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invitation code.")
    
    # Optional: Verificăm dacă email-ul curent corespunde cu cel din invitație
    # (Putem comenta asta dacă vrem să permitem oricui are codul să intre, 
    # dar pentru securitate e bine să fie userul corect)
    if invite.email != current_user.email:
        raise HTTPException(status_code=403, detail="This invitation was sent to another email address.")

    # 2. Verificăm dacă e deja membru
    existing_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == invite.project_id,
        ProjectMember.user_id == current_user.id
    ).first()
    
    if existing_member:
         return {"message": "You are already a member of this project."}

    # 3. Adăugăm userul în proiect
    new_member = ProjectMember(
        user_id=current_user.id,
        project_id=invite.project_id,
        role_id=invite.role_id
    )
    db.add(new_member)
    
    # 4. Marcăm invitația ca acceptată
    invite.status = "ACCEPTED"
    
    db.commit()
    
    return {"message": f"Successfully joined project!"}

# --- 1. AI ENDPOINTS ---

@router.post("/ai-recommend", response_model=AIResponse)
def ask_ai_methodology(request: AIRequest, current_user: User = Depends(get_current_user)):
    return get_methodology_recommendation(request.model_dump())

@router.post("/ai-roles")
def ask_ai_roles(request: AIRoleRequest, current_user: User = Depends(get_current_user)):
    return get_role_suggestions(request.methodology, request.description)

# --- 2. CREATE PROJECT (THE WIZARD FINAL SUBMIT) ---

@router.post("/create_full", response_model=ProjectOut)
def create_project_full(
    data: ProjectCreateFull,
    background_tasks: BackgroundTasks, # <--- Injectăm asta
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # A. Creăm Proiectul
    new_project = Project(
        name=data.name,
        key=data.key.upper(),
        description=data.description,
        methodology=data.methodology,
        owner_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    # B. Procesăm Rolurile și Invitațiile
    created_roles = []
    
    for role_in in data.roles:
        # 1. Creăm Rolul în DB
        db_role = Role(
            project_id=new_project.id,
            name=role_in.name,
            description=role_in.description,
            permissions="{}" 
        )
        db.add(db_role)
        db.commit()
        db.refresh(db_role)
        created_roles.append(db_role)
        
        # 2. Creăm Invitațiile REALE
        for email in role_in.emails:
            # Generăm un cod unic sigur (8 bytes hex = 16 caractere)
            # Ex: a1b2c3d4e5f67890
            secure_code = secrets.token_hex(4).upper() 
            final_code = f"{new_project.key}-{secure_code}" # Ex: APP-A1B2C3D4
            
            invite = Invitation(
                email=email,
                project_id=new_project.id,
                role_id=db_role.id,
                code=final_code,
                status="PENDING"
            )
            db.add(invite)
            
            # TRIMITEM EMAIL-UL ÎN BACKGROUND (să nu blocheze răspunsul)
            background_tasks.add_task(
                send_project_invitation_email,
                email=email,
                project_name=new_project.name,
                role_name=db_role.name,
                code=final_code
            )
    
    # C. Adăugăm Owner-ul ca membru (la primul rol sau unul default)
    owner_role_id = created_roles[0].id if created_roles else None
    
    member = ProjectMember(
        user_id=current_user.id,
        project_id=new_project.id,
        role_id=owner_role_id
    )
    db.add(member)
    db.commit()
    
    return new_project

# --- 3. GET MY PROJECTS (DASHBOARD) ---

@router.get("/mine", response_model=List[ProjectOut])
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Căutăm proiectele unde userul este membru
    # SQLAlchemy face join automat prin relația definită în modelul User (memberships)
    # Dar trebuie să navigăm: User -> memberships -> project
    
    projects = []
    for membership in current_user.memberships:
        projects.append(membership.project)
        
    return projects