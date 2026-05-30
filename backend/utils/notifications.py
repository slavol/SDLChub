from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from backend.models.notification import Notification
from backend.models.project import CalendarEvent, ProjectMember, Task, TaskComment
from backend.models.user import User
from backend.realtime import broadcast_user_event
from backend.utils.email import send_notification_email_sync

NOTIFICATION_TYPE_PREFERENCE = {
    "TASK_ASSIGNED": "notify_task_assignments",
    "MENTION": "notify_mentions",
    "CALENDAR_INVITE": "notify_calendar",
    "CALENDAR_REMINDER": "notify_calendar",
    "TASK_DUE_SOON": "notify_due_dates",
    "TASK_OVERDUE": "notify_due_dates",
    "AI_RISK": "notify_ai_risk",
}

EMAIL_NOTIFICATION_TYPES = {
    "TASK_ASSIGNED",
    "MENTION",
    "CALENDAR_INVITE",
    "CALENDAR_REMINDER",
    "TASK_DUE_SOON",
    "TASK_OVERDUE",
    "AI_RISK",
}


def enum_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _notification_type_enabled(user: User, notification_type: str) -> bool:
    preference_attr = NOTIFICATION_TYPE_PREFERENCE.get(notification_type)
    if not preference_attr:
        return True
    return bool(getattr(user, preference_attr, True))


def _email_channel_enabled(user: User, notification_type: str) -> bool:
    return (
        notification_type in EMAIL_NOTIFICATION_TYPES
        and bool(getattr(user, "notification_email_enabled", True))
        and _notification_type_enabled(user, notification_type)
        and bool(user.email)
    )


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

    recipient = db.query(User).filter(User.id == user_id).first()
    if not recipient or not _notification_type_enabled(recipient, notification_type):
        return None

    in_app_enabled = bool(getattr(recipient, "notification_in_app_enabled", True))
    notification = Notification(
        user_id=user_id,
        project_id=project_id,
        task_id=task_id,
        type=notification_type,
        title=title,
        message=message,
        link_url=link_url,
        metadata_json=json.dumps(metadata or {}),
        read_at=None if in_app_enabled else datetime.utcnow(),
    )
    db.add(notification)
    db.flush()

    if in_app_enabled:
        broadcast_user_event(
            user_id,
            "notification.created",
            {
                "id": notification.id,
                "project_id": project_id,
                "task_id": task_id,
                "notification_type": notification_type,
                "title": title,
                "link_url": link_url,
            },
        )

    if _email_channel_enabled(recipient, notification_type):
        try:
            send_notification_email_sync(
                recipient=recipient.email,
                subject=f"SDLC Hub: {title}",
                title=title,
                body=message,
                link_url=link_url,
            )
        except Exception as exc:
            print(f"⚠️ Notification email failed for user {user_id}: {exc}")

    return notification


def notification_exists_recently(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    task_id: int | None = None,
    project_id: int | None = None,
    since: datetime | None = None,
    metadata_contains: str | None = None,
) -> bool:
    query = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.type == notification_type,
    )

    if task_id is not None:
        query = query.filter(Notification.task_id == task_id)

    if project_id is not None:
        query = query.filter(Notification.project_id == project_id)

    if since is not None:
        query = query.filter(Notification.created_at >= since)

    if metadata_contains is not None:
        query = query.filter(Notification.metadata_json.contains(metadata_contains))

    return query.first() is not None


def _calendar_attendee_ids(event: CalendarEvent) -> list[int]:
    try:
        values = json.loads(event.attendee_ids or "[]")
    except Exception:
        values = []

    attendee_ids: list[int] = []
    for value in values:
        try:
            attendee_ids.append(int(value))
        except (TypeError, ValueError):
            continue

    if not attendee_ids and event.created_by_id:
        attendee_ids.append(event.created_by_id)

    return attendee_ids


def generate_due_task_reminders(
    db: Session,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
    now: datetime | None = None,
    due_soon_days: int = 2,
    dedupe_hours: int = 20,
) -> int:
    current_time = now or datetime.utcnow()
    due_soon_limit = current_time + timedelta(days=due_soon_days)
    dedupe_since = current_time - timedelta(hours=dedupe_hours)

    query = db.query(Task).filter(Task.assignee_id.isnot(None))

    if user_id is not None:
        query = query.filter(Task.assignee_id == user_id)

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    tasks = query.all()
    created = 0

    for task in tasks:
        if enum_value(task.status) == "DONE" or not task.due_date or not task.assignee_id:
            continue

        due_date = task.due_date.replace(tzinfo=None) if task.due_date.tzinfo else task.due_date

        if due_date < current_time:
            notification_type = "TASK_OVERDUE"
            title = f"{task.key} is overdue"
            message = f"{task.title} was due on {due_date.strftime('%Y-%m-%d')}."
        elif due_date <= due_soon_limit:
            notification_type = "TASK_DUE_SOON"
            title = f"{task.key} is due soon"
            message = f"{task.title} is due on {due_date.strftime('%Y-%m-%d')}."
        else:
            continue

        if notification_exists_recently(
            db,
            user_id=task.assignee_id,
            notification_type=notification_type,
            task_id=task.id,
            since=dedupe_since,
        ):
            continue

        notification = create_notification(
            db,
            user_id=task.assignee_id,
            notification_type=notification_type,
            title=title,
            message=message,
            project_id=task.project_id,
            task_id=task.id,
            link_url=f"/dashboard/tasks/{task.id}",
            metadata={
                "task_key": task.key,
                "due_date": due_date.isoformat(),
                "generated_by": "scheduler" if user_id is None else "manual",
            },
        )

        if notification:
            created += 1

    return created


def generate_calendar_event_reminders(
    db: Session,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
    now: datetime | None = None,
    lookahead_minutes: int = 30,
    dedupe_hours: int = 20,
) -> int:
    current_time = now or datetime.utcnow()
    starts_before = current_time + timedelta(minutes=lookahead_minutes)
    dedupe_since = current_time - timedelta(hours=dedupe_hours)

    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.starts_at >= current_time)
        .filter(CalendarEvent.starts_at <= starts_before)
    )

    if project_id is not None:
        events = events.filter(CalendarEvent.project_id == project_id)

    events = events.all()
    created = 0

    for event in events:
        starts_at = event.starts_at.replace(tzinfo=None) if event.starts_at.tzinfo else event.starts_at
        minutes_until = max(0, round((starts_at - current_time).total_seconds() / 60))

        for attendee_id in set(_calendar_attendee_ids(event)):
            if user_id is not None and attendee_id != user_id:
                continue

            if notification_exists_recently(
                db,
                user_id=attendee_id,
                notification_type="CALENDAR_REMINDER",
                project_id=event.project_id,
                since=dedupe_since,
                metadata_contains=f'"event_id": {event.id}',
            ):
                continue

            notification = create_notification(
                db,
                user_id=attendee_id,
                notification_type="CALENDAR_REMINDER",
                title=f"{event.title} starts soon",
                message=(
                    f"{event.title} starts in {minutes_until} minutes."
                    if minutes_until
                    else f"{event.title} starts now."
                ),
                project_id=event.project_id,
                task_id=None,
                link_url="/dashboard/calendar",
                metadata={
                    "event_id": event.id,
                    "starts_at": starts_at.isoformat(),
                    "generated_by": "scheduler" if user_id is None else "manual",
                    "lookahead_minutes": lookahead_minutes,
                },
            )

            if notification:
                created += 1

    return created


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
