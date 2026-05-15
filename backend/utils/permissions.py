from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.models.project import Project, ProjectMember


def check_project_permission(
    db: Session,
    user_id: int,
    project_id: int,
    allowed_roles: list[str] | None = None,
) -> ProjectMember:
    """
    Verifică dacă userul este membru în proiect.

    Dacă allowed_roles este None:
    - orice membru are acces.

    Dacă allowed_roles este setat:
    - Project owner are acces
    - Project Admin are acces
    - rolurile din allowed_roles au acces
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project.",
        )

    if allowed_roles is None:
        return membership

    role_name = membership.role.name if membership.role else "Member"

    if project.owner_id == user_id:
        return membership

    if role_name == "Project Admin":
        return membership

    if role_name in allowed_roles:
        return membership

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to perform this action.",
    )
