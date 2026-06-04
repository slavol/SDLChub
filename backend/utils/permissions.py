import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.models.project import Project, ProjectMember


ARCHIVED_PROJECT_READ_PERMISSIONS = {"REPORT_VIEW"}


def parse_role_permissions(raw_permissions: str | None) -> dict[str, bool]:
    if not raw_permissions:
        return {}

    try:
        parsed = json.loads(raw_permissions)
    except json.JSONDecodeError:
        return {}

    if not isinstance(parsed, dict):
        return {}

    return {str(key): bool(value) for key, value in parsed.items()}


def member_has_permission(
    project: Project,
    membership: ProjectMember,
    user_id: int,
    permission_key: str,
) -> bool:
    role_name = membership.role.name if membership and membership.role else "Member"

    if project.owner_id == user_id:
        return True

    if role_name == "Project Admin":
        return True

    permissions = parse_role_permissions(membership.role.permissions if membership.role else None)
    return bool(permissions.get(permission_key))


def ensure_project_not_archived(project: Project) -> None:
    if project.is_archived:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Project is archived. Restore it before making changes.",
        )


def check_project_permission(
    db: Session,
    user_id: int,
    project_id: int,
    allowed_roles: list[str] | None = None,
    required_permission: str | None = None,
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

    if required_permission is not None and not member_has_permission(
        project,
        membership,
        user_id,
        required_permission,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing project permission: {required_permission}.",
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


def require_project_permission(
    db: Session,
    user_id: int,
    project_id: int,
    permission_key: str,
) -> ProjectMember:
    membership = check_project_permission(
        db,
        user_id,
        project_id,
        required_permission=permission_key,
    )

    if permission_key not in ARCHIVED_PROJECT_READ_PERMISSIONS:
        ensure_project_not_archived(membership.project)

    return membership
