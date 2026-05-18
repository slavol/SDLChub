from __future__ import annotations

import json
import re
from typing import Iterable

from sqlalchemy.orm import Session

from backend.models.notification import Notification
from backend.models.project import CalendarEvent, ProjectMember, Task, TaskComment
from backend.models.user import User


def create_notification(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    message: str | None = None,
    project_id: int | None = None,
    task_id: int | None = None,
    link_url: str | None = None,
    metadata: dict | None = None,
    actor_id: int | None = None,
) -> Notification | None:
    if actor_id is not None and actor_id == user_id:
        return None

    notification = Notification(
        user_id=user_id,
        project_id=project_id,
        task_id=task_id,
        type=notification_type,
        title=title,
        message=message,
        link_url=link_url,
        metadata_json=json.dumps(metadata or {}),
    )
    db.add(notification)
    return notification


def notify_task_assigned(db: Session, task: Task, actor: User) -> None:
    if not task.assignee_id:
        return

    create_notification(
        db,
        user_id=task.assignee_id,
        notification_type="TASK_ASSIGNED",
        title=f"You were assigned to {task.key}",
        message=task.title,
        project_id=task.project_id,
        task_id=task.id,
        link_url=f"/dashboard/tasks/{task.id}",
        metadata={"task_key": task.key, "actor_id": actor.id},
        actor_id=actor.id,
    )


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _mention_candidates(user: User) -> set[str]:
    candidates: set[str] = set()

    if user.full_name:
        full_name = _normalize(user.full_name)
        candidates.add(full_name)
        candidates.add(full_name.replace(" ", "."))
        candidates.add(full_name.replace(" ", "_"))

        first_name = full_name.split(" ")[0]
        if first_name:
            candidates.add(first_name)

    if user.email:
        email_prefix = user.email.split("@", 1)[0].lower()
        candidates.add(email_prefix)
        candidates.add(email_prefix.replace(".", "_"))
        candidates.add(email_prefix.replace("_", "."))

    return {candidate for candidate in candidates if candidate}


def extract_mentioned_users(db: Session, project_id: int, body: str) -> list[User]:
    if not body or "@" not in body:
        return []

    mention_tokens = {
        _normalize(token)
        for token in re.findall(r"@([\w.\- ]{2,80})", body)
    }

    if not mention_tokens:
        return []

    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    mentioned: list[User] = []
    seen_ids: set[int] = set()

    for member in members:
        if not member.user:
            continue

        candidates = _mention_candidates(member.user)
        matched = any(
            token in candidates or any(token.startswith(candidate) for candidate in candidates)
            for token in mention_tokens
        )

        if matched and member.user.id not in seen_ids:
            mentioned.append(member.user)
            seen_ids.add(member.user.id)

    return mentioned


def notify_comment_mentions(db: Session, task: Task, comment: TaskComment, actor: User) -> None:
    mentioned_users = extract_mentioned_users(db, task.project_id, comment.body)

    for user in mentioned_users:
        create_notification(
            db,
            user_id=user.id,
            notification_type="MENTION",
            title=f"You were mentioned in {task.key}",
            message=comment.body[:240],
            project_id=task.project_id,
            task_id=task.id,
            link_url=f"/dashboard/tasks/{task.id}",
            metadata={"task_key": task.key, "comment_id": comment.id, "actor_id": actor.id},
            actor_id=actor.id,
        )


def notify_calendar_attendees(
    db: Session,
    event: CalendarEvent,
    attendee_ids: Iterable[int],
    actor: User,
) -> None:
    for attendee_id in set(attendee_ids or []):
        create_notification(
            db,
            user_id=int(attendee_id),
            notification_type="CALENDAR_INVITE",
            title=f"Calendar event: {event.title}",
            message=event.description or "You were added as an attendee.",
            project_id=event.project_id,
            task_id=None,
            link_url="/dashboard/calendar",
            metadata={"event_id": event.id, "actor_id": actor.id},
            actor_id=actor.id,
        )
