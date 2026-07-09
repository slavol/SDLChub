from datetime import datetime, timedelta, timezone
from io import BytesIO, StringIO
import csv

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database.session import get_db
from backend.models.admin import AiUsageLog, HttpErrorLog, SupportTicket, SupportTicketComment
from backend.models.documentation import DocumentationPage
from backend.models.github import GitHubEvent
from backend.models.notification import Notification
from backend.models.project import (
    CalendarEvent,
    Invitation,
    Project,
    ProjectAuditLog,
    ProjectMember,
    ProjectTeam,
    Role,
    Sprint,
    Subtask,
    Task,
    TaskAuditLog,
    TaskComment,
)
from backend.models.user import User
from backend.realtime import broadcast_project_event
from backend.routers.auth import get_current_user
from backend.schemas.admin import (
    AdminOverview,
    AdminProjectArchiveUpdate,
    AdminProjectDeleteRequest,
    AdminProjectOut,
    AdminUserOut,
    AdminUserUpdate,
    AiUsageLogOut,
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


def csv_response(filename: str, rows: list[dict]) -> StreamingResponse:
    buffer = StringIO()
    if rows:
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    else:
        buffer.write("")

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _pdf_safe(value) -> str:
    if value is None:
        return "-"

    text = str(value)
    replacements = {
        "ă": "a",
        "â": "a",
        "î": "i",
        "ș": "s",
        "ş": "s",
        "ț": "t",
        "ţ": "t",
        "Ă": "A",
        "Â": "A",
        "Î": "I",
        "Ș": "S",
        "Ş": "S",
        "Ț": "T",
        "Ţ": "T",
        "–": "-",
        "—": "-",
        "“": '"',
        "”": '"',
        "„": '"',
        "’": "'",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text.encode("latin-1", "replace").decode("latin-1")


def _pdf_datetime(value) -> str:
    if not value:
        return "-"
    try:
        return value.strftime("%Y-%m-%d %H:%M")
    except AttributeError:
        return str(value)


def delete_project_tree(db: Session, project_id: int) -> None:
    task_ids = [
        task_id
        for (task_id,) in db.query(Task.id).filter(Task.project_id == project_id).all()
    ]

    if task_ids:
        db.query(Notification).filter(Notification.task_id.in_(task_ids)).update(
            {"task_id": None},
            synchronize_session=False,
        )
        db.query(GitHubEvent).filter(GitHubEvent.task_id.in_(task_ids)).update(
            {"task_id": None},
            synchronize_session=False,
        )
        db.query(DocumentationPage).filter(DocumentationPage.task_id.in_(task_ids)).update(
            {"task_id": None},
            synchronize_session=False,
        )
        db.query(TaskAuditLog).filter(TaskAuditLog.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(TaskComment).filter(TaskComment.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(Subtask).filter(Subtask.task_id.in_(task_ids)).delete(synchronize_session=False)

    db.query(Notification).filter(Notification.project_id == project_id).update(
        {"project_id": None},
        synchronize_session=False,
    )
    db.query(AiUsageLog).filter(AiUsageLog.project_id == project_id).update(
        {"project_id": None},
        synchronize_session=False,
    )
    db.query(GitHubEvent).filter(GitHubEvent.project_id == project_id).delete(synchronize_session=False)
    db.query(DocumentationPage).filter(DocumentationPage.project_id == project_id).delete(synchronize_session=False)
    db.query(CalendarEvent).filter(CalendarEvent.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectAuditLog).filter(ProjectAuditLog.project_id == project_id).delete(synchronize_session=False)
    db.query(Task).filter(Task.project_id == project_id).delete(synchronize_session=False)
    db.query(Sprint).filter(Sprint.project_id == project_id).delete(synchronize_session=False)
    db.query(Invitation).filter(Invitation.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectMember).filter(ProjectMember.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectTeam).filter(ProjectTeam.project_id == project_id).delete(synchronize_session=False)
    db.query(Role).filter(Role.project_id == project_id).delete(synchronize_session=False)


def require_ticket_access(ticket: SupportTicket, current_user: User) -> None:
    if current_user.is_global_admin:
        return
    if ticket.reporter_id == current_user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this support ticket.",
    )


SUPPORT_TICKET_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
SUPPORT_TICKET_STATUSES = {"OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"}


def normalize_support_priority(value: str | None) -> str:
    priority = (value or "MEDIUM").strip().upper()
    if priority not in SUPPORT_TICKET_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid support ticket priority.",
        )
    return priority


def normalize_support_status(value: str | None) -> str:
    ticket_status = (value or "OPEN").strip().upper()
    if ticket_status not in SUPPORT_TICKET_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid support ticket status.",
        )
    return ticket_status


def normalize_support_body(value: str | None) -> str:
    body = (value or "").strip()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Support comment cannot be empty.",
        )
    return body


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
        "ai_configured": bool(settings.local_ai_base_url and settings.local_ai_model),
        "ai_requests": db.query(AiUsageLog).count(),
        "ai_requests_24h": db.query(AiUsageLog)
        .filter(AiUsageLog.created_at >= since)
        .count(),
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
            "is_archived": project.is_archived,
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


@router.put("/projects/{project_id}/archive", response_model=AdminProjectOut)
def update_admin_project_archive(
    project_id: int,
    data: AdminProjectArchiveUpdate,
    current_user: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    old_archived_state = project.is_archived
    project.is_archived = data.is_archived
    db.add(
        ProjectAuditLog(
            project_id=project.id,
            actor_id=current_user.id,
            action="ARCHIVE_UPDATED",
            field="is_archived",
            old_value=str(old_archived_state),
            new_value=str(data.is_archived),
        )
    )
    db.commit()
    db.refresh(project)

    projects = list_admin_projects(current_user, db)
    updated_project = next(
        (item for item in projects if item["id"] == project.id),
        None,
    )

    broadcast_project_event(
        project.id,
        "project.changed",
        {
            "action": "archive_updated",
            "project_id": project.id,
            "is_archived": project.is_archived,
            "project": updated_project,
        },
    )

    if updated_project:
        return updated_project

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")


@router.delete("/projects/{project_id}")
def delete_admin_project(
    project_id: int,
    data: AdminProjectDeleteRequest,
    current_user: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if data.confirmation_key.strip().upper() != project.key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation key does not match project key.",
        )

    project_key = project.key
    delete_project_tree(db, project.id)
    db.delete(project)
    db.commit()

    broadcast_project_event(
        project_id,
        "project.deleted",
        {"action": "deleted_by_global_admin", "project_id": project_id, "key": project_key},
    )
    return {"message": "Project deleted successfully."}


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


@router.get("/ai-usage", response_model=list[AiUsageLogOut])
def list_ai_usage(
    feature: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    project_id: int | None = Query(default=None),
    days: int | None = Query(default=None, ge=1, le=365),
    limit: int = Query(default=200, ge=1, le=1000),
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AiUsageLog)

    if feature:
        query = query.filter(AiUsageLog.feature == feature)
    if status_filter:
        query = query.filter(AiUsageLog.status == status_filter.upper())
    if project_id is not None:
        query = query.filter(AiUsageLog.project_id == project_id)
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.filter(AiUsageLog.created_at >= since)

    return query.order_by(AiUsageLog.created_at.desc()).limit(limit).all()


@router.get("/export/projects.csv")
def export_admin_projects_csv(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    projects = list_admin_projects(_, db)
    rows = [
        {
            "id": project["id"],
            "name": project["name"],
            "key": project["key"],
            "methodology": project["methodology"],
            "is_archived": project["is_archived"],
            "owner_name": project.get("owner_name") or "",
            "owner_email": project.get("owner_email") or "",
            "members_count": project["members_count"],
            "tasks_count": project["tasks_count"],
            "created_at": project["created_at"].isoformat() if project.get("created_at") else "",
        }
        for project in projects
    ]
    return csv_response("sdlc-hub-projects.csv", rows)


@router.get("/export/users.csv")
def export_admin_users_csv(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    users = list_admin_users(_, db)
    rows = [
        {
            "id": user["id"],
            "email": user["email"],
            "full_name": user.get("full_name") or "",
            "is_active": user["is_active"],
            "is_global_admin": user["is_global_admin"],
            "projects_count": user["projects_count"],
            "owned_projects_count": user["owned_projects_count"],
            "assigned_tasks_count": user["assigned_tasks_count"],
        }
        for user in users
    ]
    return csv_response("sdlc-hub-users.csv", rows)


@router.get("/export/ai-usage.csv")
def export_ai_usage_csv(
    _: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AiUsageLog)
        .order_by(AiUsageLog.created_at.desc())
        .limit(1000)
        .all()
    )
    rows = [
        {
            "id": log.id,
            "feature": log.feature,
            "provider": log.provider,
            "source": log.source or "",
            "status": log.status,
            "user_id": log.user_id or "",
            "user_name": log.user_name or "",
            "project_id": log.project_id or "",
            "project_name": log.project_name or "",
            "created_at": log.created_at.isoformat() if log.created_at else "",
            "detail": log.detail or "",
        }
        for log in logs
    ]
    return csv_response("sdlc-hub-ai-usage.csv", rows)


@router.get("/export/platform.pdf")
def export_platform_pdf(
    current_user: User = Depends(require_global_admin),
    db: Session = Depends(get_db),
):
    from fpdf import FPDF

    settings = get_settings()

    overview = read_admin_overview(current_user, db)
    projects = list_admin_projects(current_user, db)
    users = list_admin_users(current_user, db)
    tickets = list_support_tickets(current_user, db)
    errors = list_admin_errors(current_user, db)
    ai_logs = list_ai_usage(
        feature=None,
        status_filter=None,
        project_id=None,
        days=None,
        limit=100,
        _=current_user,
        db=db,
    )

    active_projects = sum(1 for project in projects if not project["is_archived"])
    archived_projects = sum(1 for project in projects if project["is_archived"])
    active_users = sum(1 for user in users if user["is_active"])
    global_admins = sum(1 for user in users if user["is_global_admin"])
    critical_tickets = sum(
        1
        for ticket in tickets
        if ticket.priority in {"HIGH", "CRITICAL"}
        and ticket.status in {"OPEN", "IN_PROGRESS"}
    )

    ticket_status_counts = {
        status_name: db.query(SupportTicket)
        .filter(SupportTicket.status == status_name)
        .count()
        for status_name in ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
    }

    ai_status_counts = {
        status_name: db.query(AiUsageLog)
        .filter(AiUsageLog.status == status_name)
        .count()
        for status_name in ["SUCCESS", "ERROR"]
    }

    top_projects = sorted(
        projects,
        key=lambda project: (project["tasks_count"], project["members_count"]),
        reverse=True,
    )[:8]

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    pdf.set_fill_color(15, 23, 42)
    pdf.rect(0, 0, 210, 30, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_xy(12, 8)
    pdf.cell(0, 8, _pdf_safe("SDLC Hub - Platform Operations Report"), ln=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(203, 213, 225)
    pdf.set_x(12)
    pdf.cell(
        0,
        6,
        _pdf_safe(
            f"Generated by {current_user.full_name or current_user.email} on "
            f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"
        ),
        ln=True,
    )

    pdf.ln(12)

    def section(title: str) -> None:
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_text_color(15, 23, 42)
        pdf.cell(0, 8, _pdf_safe(title), ln=True)

    def metric_row(label: str, value) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(70, 7, _pdf_safe(label), border=1)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(0, 7, _pdf_safe(value), border=1, ln=True)

    section("1. Platform snapshot")
    metric_row("Users", f"{overview['users']} total / {active_users} active / {global_admins} admins")
    metric_row("Projects", f"{overview['projects']} total / {active_projects} active / {archived_projects} archived")
    metric_row("Tasks", overview["tasks"])
    metric_row("Support queue", f"{overview['open_tickets']} open / {critical_tickets} critical")
    metric_row("Server errors 24h", overview["errors_last_24h"])
    metric_row("AI requests", f"{overview['ai_requests']} total / {overview['ai_requests_24h']} in 24h")
    metric_row("AI configured", "Yes" if settings.local_ai_base_url and settings.local_ai_model else "No")

    pdf.ln(7)
    section("2. Project registry")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(42, 7, _pdf_safe("Project"), border=1, fill=True)
    pdf.cell(24, 7, _pdf_safe("Method"), border=1, fill=True)
    pdf.cell(22, 7, _pdf_safe("State"), border=1, fill=True)
    pdf.cell(22, 7, _pdf_safe("Members"), border=1, fill=True)
    pdf.cell(20, 7, _pdf_safe("Tasks"), border=1, fill=True)
    pdf.cell(60, 7, _pdf_safe("Owner"), border=1, ln=True, fill=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    if top_projects:
        for project in top_projects:
            pdf.cell(42, 7, _pdf_safe(f"{project['key']} - {project['name']}")[:27], border=1)
            pdf.cell(24, 7, _pdf_safe(project["methodology"]), border=1)
            pdf.cell(22, 7, _pdf_safe("Archived" if project["is_archived"] else "Active"), border=1)
            pdf.cell(22, 7, _pdf_safe(project["members_count"]), border=1)
            pdf.cell(20, 7, _pdf_safe(project["tasks_count"]), border=1)
            pdf.cell(60, 7, _pdf_safe(project.get("owner_email") or "-")[:42], border=1, ln=True)
    else:
        pdf.cell(190, 7, _pdf_safe("No projects found."), border=1, ln=True)

    pdf.ln(7)
    section("3. Support and incidents")
    metric_row("Tickets by status", " / ".join(f"{key}: {value}" for key, value in ticket_status_counts.items()))
    metric_row("AI by status", " / ".join(f"{key}: {value}" for key, value in ai_status_counts.items()))

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(65, 7, _pdf_safe("Recent ticket"), border=1, fill=True)
    pdf.cell(25, 7, _pdf_safe("Priority"), border=1, fill=True)
    pdf.cell(32, 7, _pdf_safe("Status"), border=1, fill=True)
    pdf.cell(68, 7, _pdf_safe("Reporter"), border=1, ln=True, fill=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    for ticket in tickets[:6]:
        pdf.cell(65, 7, _pdf_safe(ticket.title)[:45], border=1)
        pdf.cell(25, 7, _pdf_safe(ticket.priority), border=1)
        pdf.cell(32, 7, _pdf_safe(ticket.status), border=1)
        pdf.cell(68, 7, _pdf_safe(ticket.reporter_email or "-")[:47], border=1, ln=True)
    if not tickets:
        pdf.cell(190, 7, _pdf_safe("No support tickets found."), border=1, ln=True)

    pdf.ln(7)
    section("4. AI and error trail")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(44, 7, _pdf_safe("AI feature"), border=1, fill=True)
    pdf.cell(30, 7, _pdf_safe("Status"), border=1, fill=True)
    pdf.cell(62, 7, _pdf_safe("Project"), border=1, fill=True)
    pdf.cell(54, 7, _pdf_safe("Created"), border=1, ln=True, fill=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    for log in ai_logs[:8]:
        pdf.cell(44, 7, _pdf_safe(log.feature)[:28], border=1)
        pdf.cell(30, 7, _pdf_safe(log.status), border=1)
        pdf.cell(62, 7, _pdf_safe(log.project_name or "-")[:43], border=1)
        pdf.cell(54, 7, _pdf_safe(_pdf_datetime(log.created_at)), border=1, ln=True)
    if not ai_logs:
        pdf.cell(190, 7, _pdf_safe("No AI usage logged yet."), border=1, ln=True)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(25, 7, _pdf_safe("Status"), border=1, fill=True)
    pdf.cell(68, 7, _pdf_safe("Path"), border=1, fill=True)
    pdf.cell(43, 7, _pdf_safe("User"), border=1, fill=True)
    pdf.cell(54, 7, _pdf_safe("Created"), border=1, ln=True, fill=True)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(51, 65, 85)
    for error in errors[:8]:
        pdf.cell(25, 7, _pdf_safe(error.status_code), border=1)
        pdf.cell(68, 7, _pdf_safe(f"{error.method} {error.path}")[:48], border=1)
        pdf.cell(43, 7, _pdf_safe(error.user_name or "-")[:30], border=1)
        pdf.cell(54, 7, _pdf_safe(_pdf_datetime(error.created_at)), border=1, ln=True)
    if not errors:
        pdf.cell(190, 7, _pdf_safe("No HTTP errors logged."), border=1, ln=True)

    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(
        0,
        5,
        _pdf_safe(
            "This report is generated from the Global Admin console and is intended "
            "for platform supervision, support triage and license/demo documentation."
        ),
    )

    output = pdf.output(dest="S")
    if isinstance(output, str):
        pdf_bytes = output.encode("latin-1")
    else:
        pdf_bytes = bytes(output)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="sdlc-hub-platform-report.pdf"',
        },
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
    title = data.title.strip()
    if len(title) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Support ticket title must be at least 3 characters.",
        )

    ticket = SupportTicket(
        reporter_id=current_user.id,
        reporter_email=current_user.email,
        title=title,
        description=data.description.strip() if data.description else None,
        priority=normalize_support_priority(data.priority),
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
        ticket.status = normalize_support_status(data.status)
    if data.priority is not None:
        ticket.priority = normalize_support_priority(data.priority)

    db.commit()
    db.refresh(ticket)
    return ticket


@router.delete("/tickets/{ticket_id}")
def delete_support_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    require_ticket_access(ticket, current_user)
    db.delete(ticket)
    db.commit()
    return {"message": "Support ticket deleted successfully."}


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

    body = normalize_support_body(data.body)
    comment = SupportTicketComment(
        ticket_id=ticket.id,
        author_id=current_user.id,
        body=body,
        is_admin_note=current_user.is_global_admin,
    )
    db.add(comment)
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/tickets/{ticket_id}/comments/{comment_id}")
def delete_support_ticket_comment(
    ticket_id: int,
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    require_ticket_access(ticket, current_user)

    comment = (
        db.query(SupportTicketComment)
        .filter(
            SupportTicketComment.id == comment_id,
            SupportTicketComment.ticket_id == ticket.id,
        )
        .first()
    )
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found.")

    if not current_user.is_global_admin and comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can delete only your own comments.",
        )

    db.delete(comment)
    ticket.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Comment deleted successfully."}
