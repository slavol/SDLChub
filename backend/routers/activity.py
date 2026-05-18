from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import Project, Task, TaskAuditLog
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.utils.permissions import check_project_permission


router = APIRouter(prefix="/activity", tags=["Activity"])


ACTION_LABELS = {
    "TASK_CREATED": "Created task",
    "TASK_UPDATED": "Updated task",
    "SUBTASK_CREATED": "Added subtask",
    "SUBTASK_UPDATED": "Updated subtask",
    "COMMENT_ADDED": "Added comment",
    "COMMENT_UPDATED": "Edited comment",
    "COMMENT_DELETED": "Deleted comment",
}


def _window_start(window: str) -> datetime | None:
    now = datetime.utcnow()

    if window == "1h":
        return now - timedelta(hours=1)
    if window == "6h":
        return now - timedelta(hours=6)
    if window == "24h":
        return now - timedelta(hours=24)
    if window == "7d":
        return now - timedelta(days=7)
    if window == "30d":
        return now - timedelta(days=30)

    return None


def _action_label(action: str) -> str:
    return ACTION_LABELS.get(action, action.replace("_", " ").title())


def _activity_category(action: str, field: str | None, methodology: str) -> str:
    if action.startswith("COMMENT"):
        return "collaboration"

    if action.startswith("SUBTASK"):
        return "checklist"

    if action == "TASK_CREATED":
        return "creation"

    if action == "TASK_UPDATED" and field == "status":
        return "flow" if methodology == "KANBAN" else "delivery"

    if action == "TASK_UPDATED" and field in {"sprint_id", "story_points"}:
        return "planning"

    if action == "TASK_UPDATED" and field == "assignee_id":
        return "team"

    return "updates"


def _mode_label(methodology: str, category: str) -> str:
    if methodology == "KANBAN":
        if category == "flow":
            return "Flow change"
        if category == "planning":
            return "Work item planning"
        return "Kanban activity"

    if methodology == "SCRUMBAN":
        if category == "flow":
            return "Hybrid flow"
        if category == "planning":
            return "Sprint planning"
        return "Scrumban activity"

    if category == "planning":
        return "Sprint planning"

    if category == "delivery":
        return "Sprint delivery"

    return "Scrum activity"


def _serialize_log_item(log: TaskAuditLog, task: Task, methodology: str) -> dict:
    category = _activity_category(log.action, log.field, methodology)

    return {
        "id": log.id,
        "action": log.action,
        "action_label": _action_label(log.action),
        "category": category,
        "mode_label": _mode_label(methodology, category),
        "task_id": task.id,
        "task_key": task.key,
        "task_title": task.title,
        "actor_id": log.actor_id,
        "actor_name": log.actor_name,
        "actor_avatar_url": log.actor_avatar_url,
        "field": log.field,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "created_at": log.created_at,
        "source": "audit_log",
    }


def _serialize_task_created_fallback(task: Task, methodology: str) -> dict:
    category = "creation"

    return {
        "id": -task.id,
        "action": "TASK_CREATED",
        "action_label": "Created task",
        "category": category,
        "mode_label": _mode_label(methodology, category),
        "task_id": task.id,
        "task_key": task.key,
        "task_title": task.title,
        "actor_id": None,
        "actor_name": task.assignee_name or "System",
        "actor_avatar_url": task.assignee_avatar_url,
        "field": "title",
        "old_value": None,
        "new_value": task.title,
        "created_at": task.created_at,
        "source": "task_fallback",
    }


@router.get("/project/{project_id}")
def get_project_activity(
    project_id: int,
    window: str = Query("24h", alias="range"),
    actor_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    project = db.query(Project).filter(Project.id == project_id).first()
    methodology = project.methodology if project else "SCRUM"

    start_date = _window_start(window)

    log_query = (
        db.query(TaskAuditLog, Task)
        .join(Task, TaskAuditLog.task_id == Task.id)
        .filter(Task.project_id == project_id)
    )

    if start_date:
        log_query = log_query.filter(TaskAuditLog.created_at >= start_date)

    if actor_id:
        log_query = log_query.filter(TaskAuditLog.actor_id == actor_id)

    if action and action != "all":
        log_query = log_query.filter(TaskAuditLog.action == action)

    if q:
        like_value = f"%{q.strip()}%"
        log_query = log_query.filter(
            or_(
                Task.key.ilike(like_value),
                Task.title.ilike(like_value),
                TaskAuditLog.action.ilike(like_value),
                TaskAuditLog.field.ilike(like_value),
                TaskAuditLog.old_value.ilike(like_value),
                TaskAuditLog.new_value.ilike(like_value),
            )
        )

    rows = (
        log_query.order_by(TaskAuditLog.created_at.desc())
        .limit(limit * 3)
        .all()
    )

    items = []
    logged_created_task_ids = set()

    for log, task in rows:
        if log.action == "TASK_CREATED":
            logged_created_task_ids.add(task.id)

        item = _serialize_log_item(log, task, methodology)

        if category and category != "all" and item["category"] != category:
            continue

        items.append(item)

    # Fallback: pentru task-urile vechi create înainte de audit logs.
    should_include_task_fallback = (
        not actor_id
        and (not action or action in {"all", "TASK_CREATED"})
        and (not category or category in {"all", "creation"})
    )

    if should_include_task_fallback:
        task_query = db.query(Task).filter(Task.project_id == project_id)

        if start_date:
            task_query = task_query.filter(Task.created_at >= start_date)

        if q:
            like_value = f"%{q.strip()}%"
            task_query = task_query.filter(
                or_(
                    Task.key.ilike(like_value),
                    Task.title.ilike(like_value),
                    Task.description.ilike(like_value),
                )
            )

        fallback_tasks = (
            task_query.order_by(Task.created_at.desc())
            .limit(limit * 3)
            .all()
        )

        for task in fallback_tasks:
            if task.id in logged_created_task_ids:
                continue

            items.append(_serialize_task_created_fallback(task, methodology))

    items.sort(key=lambda item: item["created_at"] or datetime.min, reverse=True)
    items = items[:limit]

    unique_people = {
        item["actor_id"]
        for item in items
        if item.get("actor_id") is not None
    }

    summary = {
        "total": len(items),
        "people": len(unique_people),
        "task_updates": len([item for item in items if item["action"] == "TASK_UPDATED"]),
        "comments": len([item for item in items if item["action"].startswith("COMMENT")]),
        "status_changes": len([
            item for item in items
            if item["action"] == "TASK_UPDATED" and item.get("field") == "status"
        ]),
    }

    return {
        "project": {
            "id": project.id if project else project_id,
            "name": project.name if project else "",
            "key": project.key if project else "",
            "methodology": methodology,
        },
        "summary": summary,
        "items": items,
    }
