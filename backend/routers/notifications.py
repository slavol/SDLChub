from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.notification import Notification
from backend.models.project import ProjectMember, Task
from backend.models.user import User
from backend.realtime import broadcast_user_event
from backend.routers.auth import get_current_user
from backend.schemas.notification import NotificationOut
from backend.utils.notifications import (
    create_notification,
    generate_calendar_event_reminders as generate_calendar_event_reminders_for_scope,
    generate_due_task_reminders as generate_due_task_reminders_for_scope,
)
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.read_at.is_(None))

    return (
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .all()
    )


@router.get("/unread-count")
def unread_notification_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .count()
    )

    return {"count": count}


@router.put("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()

    updated = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .update({"read_at": now}, synchronize_session=False)
    )

    db.commit()
    broadcast_user_event(current_user.id, "notification.read_all", {"updated": updated})
    return {"updated": updated}



def _enum_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _notification_exists(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    task_id: int | None = None,
    project_id: int | None = None,
) -> bool:
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.type == notification_type,
        Notification.created_at >= datetime.utcnow() - timedelta(hours=20),
    )

    if task_id is not None:
        query = query.filter(Notification.task_id == task_id)

    if project_id is not None:
        query = query.filter(Notification.project_id == project_id)

    return query.first() is not None


def _create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str | None,
    project_id: int | None,
    task_id: int | None,
    link_url: str | None,
    metadata_json: str | None = None,
) -> Notification | None:
    metadata: dict = {}
    if metadata_json:
        try:
            import json

            metadata = json.loads(metadata_json)
        except Exception:
            metadata = {}

    return create_notification(
        db,
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        project_id=project_id,
        task_id=task_id,
        link_url=link_url,
        metadata=metadata,
    )


@router.post("/generate-reminders")
def generate_due_task_reminders_endpoint(
    project_id: int | None = Query(None),
    include_calendar: bool = Query(True),
    calendar_lookahead_minutes: int = Query(60, ge=5, le=1440),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        check_project_permission(db, current_user.id, project_id)

    due_task_created = generate_due_task_reminders_for_scope(
        db,
        user_id=current_user.id,
        project_id=project_id,
    )
    calendar_created = 0
    if include_calendar:
        calendar_created = generate_calendar_event_reminders_for_scope(
            db,
            user_id=current_user.id,
            project_id=project_id,
            lookahead_minutes=calendar_lookahead_minutes,
        )
    db.commit()
    return {
        "created": due_task_created + calendar_created,
        "due_task_created": due_task_created,
        "calendar_created": calendar_created,
        "calendar_lookahead_minutes": calendar_lookahead_minutes if include_calendar else 0,
    }


@router.post("/generate-risk/{project_id}")
def generate_ai_risk_notifications(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "REPORT_VIEW")

    now = datetime.utcnow()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()
    active_tasks = [
        task
        for task in db.query(Task).filter(Task.project_id == project_id).all()
        if _enum_value(task.status) != "DONE"
    ]

    created = 0

    for member in members:
        member_tasks = [task for task in active_tasks if task.assignee_id == member.user_id]
        if not member_tasks:
            continue

        story_points = sum(task.story_points or 0 for task in member_tasks)
        overdue = 0
        critical = 0

        for task in member_tasks:
            if _enum_value(task.priority) == "CRITICAL":
                critical += 1

            if task.due_date:
                due_date = task.due_date.replace(tzinfo=None) if task.due_date.tzinfo else task.due_date
                if due_date < now:
                    overdue += 1

        risk_score = min(100, len(member_tasks) * 8 + story_points * 3 + overdue * 20 + critical * 12)

        if risk_score < 70:
            continue

        if _notification_exists(
            db,
            user_id=member.user_id,
            notification_type="AI_RISK",
            project_id=project_id,
        ):
            continue

        name = member.user.full_name if member.user else "Team member"

        notification = _create_notification(
            db,
            user_id=member.user_id,
            notification_type="AI_RISK",
            title="High workload risk detected",
            message=(
                f"{name}, your current workload risk score is {risk_score}/100 "
                f"based on active tasks, story points, overdue work and critical tasks."
            ),
            project_id=project_id,
            task_id=None,
            link_url="/dashboard/workload",
            metadata_json=f'{{"risk_score": {risk_score}}}',
        )
        if notification:
            created += 1

    db.commit()
    return {"created": created}


@router.put("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == current_user.id)
        .first()
    )

    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")

    if not notification.read_at:
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)
        broadcast_user_event(current_user.id, "notification.read", {"id": notification.id})

    return notification
