from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models.workspace import Invitation, WorkspaceMember, Workspace, InvitationStatus
from models.user import User
from schemas.invitation import JoinByCode, InvitationResponse
from database.session import get_db
from routers.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/invitations", tags=["Invitations"])

# 1. Verifică dacă userul are invitații în așteptare (pentru First Login automat)
@router.get("/pending")
def check_pending_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    invite = db.query(Invitation).filter(
        Invitation.email == current_user.email,
        Invitation.status == InvitationStatus.PENDING
    ).first()
    
    if not invite:
        return {"has_pending": False}
    
    # Returnăm detalii despre workspace-ul unde e invitat
    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()
    return {
        "has_pending": True,
        "workspace_name": workspace.name,
        "code": invite.code_manual 
    }

# 2. Join prin Cod Manual
@router.post("/join", response_model=InvitationResponse)
def join_workspace_by_code(
    payload: JoinByCode,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Căutăm invitația după codul manual
    invite = db.query(Invitation).filter(
        Invitation.code_manual == payload.code,
        Invitation.status == InvitationStatus.PENDING
    ).first()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired code")

    # Verificăm dacă nu cumva e deja expirat (time)
    if invite.expires_at and invite.expires_at < datetime.utcnow():
         invite.status = InvitationStatus.EXPIRED
         db.commit()
         raise HTTPException(status_code=400, detail="Invitation expired")

    # Adăugăm userul în workspace
    new_member = WorkspaceMember(
        user_id=current_user.id,
        workspace_id=invite.workspace_id,
        role_id=invite.role_id
    )
    db.add(new_member)
    
    # Actualizăm invitația
    invite.status = InvitationStatus.ACCEPTED
    db.commit()

    workspace = db.query(Workspace).filter(Workspace.id == invite.workspace_id).first()

    return {
        "message": "Successfully joined workspace",
        "workspace_id": workspace.id,
        "workspace_name": workspace.name
    }