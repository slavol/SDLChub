from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database.session import get_db
from backend.models.admin import HttpErrorLog, SupportTicket, SupportTicketComment
from backend.models.project import Project, ProjectMember, Task
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.admin import (
    AdminOverview,
    AdminProjectOut,
    AdminUserOut,
    AdminUserUpdate,
    HttpErrorLogOut,
    SupportTicketCreate,
    SupportTicketCommentCreate,
    SupportTicketCommentOut,
    SupportTicketOut,
    SupportTicketUpdate,
)

router = APIRouter(prefix="/admin", tags=["Global Admin"])


def require_global_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_global_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Global admin access is required.",
        )
    return current_user


def require_ticket_access(ticket: SupportTicket, current_user: User) -> None:
    if current_user.is_global_admin:
        return
    if ticket.reporter_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this support ticket.",
    )


@router.get("/overview", response_model=AdminOverview)
def read_admin_overview(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    settings = get_settings()

    return {
        "users": db.query(User).count(),
        "projects": db.query(Project).count(),
        "tasks": db.query(Task).count(),
        "open_tickets": db.query(SupportTicket)
        .filter(SupportTicket.status.in_(["OPEN", "IN_PROGRESS"]))
        .count(),
        "errors_last_24h": db.query(HttpErrorLog)
        .filter(HttpErrorLog.created_at >= since)
        .count(),
        "ai_configured": bool(settings.gemini_api_key),
        "ai_requests": 0,
    }


@router.get("/projects", response_model=list[AdminProjectOut])
def list_admin_projects(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    member_counts = (
        db.query(ProjectMember.project_id, func.count(ProjectMember.id).label("members_count"))
        .group_by(ProjectMember.project_id)
        .subquery()
    )
    task_counts = (
        db.query(Task.project_id, func.count(Task.id).label("tasks_count"))
        .group_by(Task.project_id)
        .subquery()
    )

    rows = (
        db.query(
            Project,
            User.full_name,
            User.email,
            func.coalesce(member_counts.c.members_count, 0),
            func.coalesce(task_counts.c.tasks_count, 0),
        )
        .outerjoin(User, Project.owner_id == User.id)
        .outerjoin(member_counts, member_counts.c.project_id == Project.id)
        .outerjoin(task_counts, task_counts.c.project_id == Project.id)
        .order_by(Project.created_at.desc())
        .all()
    )

    return [
        {
            "id": project.id,
            "name": project.name,
            "key": project.key,
            "methodology": project.methodology,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "members_count": members_count,
            "tasks_count": tasks_count,
            "created_at": project.created_at,
        }
        for project, owner_name, owner_email, members_count, tasks_count in rows
    ]


@router.get("/users", response_model=list[AdminUserOut])
def list_admin_users(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    membership_counts = (
        db.query(ProjectMember.user_id, func.count(ProjectMember.id).label("projects_count"))
        .group_by(ProjectMember.user_id)
        .subquery()
    )
    owned_counts = (
        db.query(Project.owner_id, func.count(Project.id).label("owned_projects_count"))
        .group_by(Project.owner_id)
        .subquery()
    )
    task_counts = (
        db.query(Task.assignee_id, func.count(Task.id).label("assigned_tasks_count"))
        .filter(Task.assignee_id.isnot(None))
        .group_by(Task.assignee_id)
        .subquery()
    )

    rows = (
        db.query(
            User,
            func.coalesce(membership_counts.c.projects_count, 0),
            func.coalesce(owned_counts.c.owned_projects_count, 0),
            func.coalesce(task_counts.c.assigned_tasks_count, 0),
        )
        .outerjoin(membership_counts, membership_counts.c.user_id == User.id)
        .outerjoin(owned_counts, owned_counts.c.owner_id == User.id)
        .outerjoin(task_counts, task_counts.c.assignee_id == User.id)
        .order_by(User.id.asc())
        .all()
    )

    return [
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "is_active": user.is_active,
            "is_global_admin": user.is_global_admin,
            "projects_count": projects_count,
            "owned_projects_count": owned_projects_count,
            "assigned_tasks_count": assigned_tasks_count,
        }
        for user, projects_count, owned_projects_count, assigned_tasks_count in rows
    ]


@router.put("/users/{user_id}", response_model=AdminUserOut)
def update_admin_user(
    user_id: int,
    data: AdminUserUpdate,
    current_user: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    if data.is_global_admin is False and target_user.is_global_admin:
        global_admins = db.query(User).filter(User.is_global_admin.is_(True)).count()
        if global_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one global admin must remain active.",
            )
        if target_user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot remove your own global admin access.",
            )

    if data.is_active is False and target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )

    if data.is_active is not None:
        target_user.is_active = data.is_active
    if data.is_global_admin is not None:
        target_user.is_global_admin = data.is_global_admin

    db.commit()
    db.refresh(target_user)

    projects_count = (
        db.query(ProjectMember)
        .filter(ProjectMember.user_id == target_user.id)
        .count()
    )
    owned_projects_count = (
        db.query(Project)
        .filter(Project.owner_id == target_user.id)
        .count()
    )
    assigned_tasks_count = (
        db.query(Task)
        .filter(Task.assignee_id == target_user.id)
        .count()
    )

    return {
        "id": target_user.id,
        "email": target_user.email,
        "full_name": target_user.full_name,
        "avatar_url": target_user.avatar_url,
        "is_active": target_user.is_active,
        "is_global_admin": target_user.is_global_admin,
        "projects_count": projects_count,
        "owned_projects_count": owned_projects_count,
        "assigned_tasks_count": assigned_tasks_count,
    }


@router.get("/errors", response_model=list[HttpErrorLogOut])
def list_admin_errors(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(HttpErrorLog)
        .order_by(HttpErrorLog.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/tickets", response_model=list[SupportTicketOut])
def list_support_tickets(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    return (
        db.query(SupportTicket)
        .order_by(SupportTicket.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/tickets/mine", response_model=list[SupportTicketOut])
def list_my_support_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(SupportTicket)
        .filter(SupportTicket.reporter_id == current_user.id)
        .order_by(SupportTicket.created_at.desc())
        .limit(100)
        .all()
    )


@router.get("/tickets/{ticket_id}", response_model=SupportTicketOut)
def read_support_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    require_ticket_access(ticket, current_user)
    return ticket


@router.post("/tickets", response_model=SupportTicketOut)
def create_support_ticket(
    data: SupportTicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = SupportTicket(
        reporter_id=current_user.id,
        reporter_email=current_user.email,
        title=data.title.strip(),
        description=data.description.strip() if data.description else None,
        priority=data.priority.upper(),
        status="OPEN",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.put("/tickets/{ticket_id}", response_model=SupportTicketOut)
def update_support_ticket(
    ticket_id: int,
    data: SupportTicketUpdate,
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    if data.status is not None:
        ticket.status = data.status.upper()
    if data.priority is not None:
        ticket.priority = data.priority.upper()

    db.commit()
    db.refresh(ticket)
    return ticket


@router.post(
    "/tickets/{ticket_id}/comments",
    response_model=SupportTicketCommentOut,
)
def create_support_ticket_comment(
    ticket_id: int,
    data: SupportTicketCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    require_ticket_access(ticket, current_user)

    comment = SupportTicketComment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=data.body.strip(),
        is_admin_note=current_user.is_global_admin,
    )
    db.add(comment)
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return comment
