from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from models.project import ProjectMember, Project

def check_project_permission(db: Session, user_id: int, project_id: int, required_roles: list[str] = None):
    """
    Verifică dacă utilizatorul este membru al proiectului și are rolul necesar.
    Returnează obiectul ProjectMember sau aruncă 403 Forbidden.
    """
    # 1. Căutăm dacă userul e membru în proiect
    member = db.query(ProjectMember).filter(
        ProjectMember.user_id == user_id,
        ProjectMember.project_id == project_id
    ).first()

    # 2. Verificăm dacă proiectul există și cine e ownerul (pentru bypass)
    project = db.query(Project).filter(Project.id == project_id).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == user_id

    # Dacă nu e membru și nici owner -> Afară
    if not member and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project."
        )

    # Dacă e Owner, are permisiuni depline, nu mai verificăm rolul
    if is_owner:
        return member # Poate fi None dacă ownerul nu s-a adăugat explicit ca membru, dar e ok

    # 3. Verificăm Rolurile (Dacă s-au cerut roluri specifice)
    if required_roles:
        # Presupunem că member.role este relația către tabela roles
        # Dacă userul nu are rol setat sau rolul nu e în listă
        user_role_name = member.role.name if member.role else "Member"
        
        if user_role_name not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of these roles: {required_roles}"
            )
    
    return member