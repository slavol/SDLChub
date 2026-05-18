from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.notification import Notification
from backend.models.project import ProjectMember, Task
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.notification import NotificationOut
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
        Notification.read_at.is_(None),
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
) -> Notification:
    notification = Notification(
        user_id=user_id,
        project_id=project_id,
        task_id=task_id,
        type=notification_type,
        title=title,
        message=message,
        link_url=link_url,
        metadata_json=metadata_json or "{}",
    )
    db.add(notification)
    return notification


@router.post("/generate-reminders")
def generate_due_task_reminders(
    project_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    due_soon_limit = now + timedelta(days=2)

    query = db.query(Task).filter(Task.assignee_id == current_user.id)

    if project_id is not None:
        check_project_permission(db, current_user.id, project_id)
        query = query.filter(Task.project_id == project_id)

    tasks = query.all()
    created = 0

    for task in tasks:
        if _enum_value(task.status) == "DONE" or not task.due_date:
            continue

        due_date = task.due_date.replace(tzinfo=None) if task.due_date.tzinfo else task.due_date

        if due_date < now:
            notification_type = "TASK_OVERDUE"
            title = f"{task.key} is overdue"
            message = f"{task.title} was due on {due_date.strftime('%Y-%m-%d')}."
        elif due_date <= due_soon_limit:
            notification_type = "TASK_DUE_SOON"
            title = f"{task.key} is due soon"
            message = f"{task.title} is due on {due_date.strftime('%Y-%m-%d')}."
        else:
            continue

        if _notification_exists(
            db,
            user_id=current_user.id,
            notification_type=notification_type,
            task_id=task.id,
        ):
            continue

        _create_notification(
            db,
            user_id=current_user.id,
            notification_type=notification_type,
            title=title,
            message=message,
            project_id=task.project_id,
            task_id=task.id,
            link_url=f"/dashboard/tasks/{task.id}",
        )
        created += 1

    db.commit()
    return {"created": created}


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

        _create_notification(
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

    return notification
