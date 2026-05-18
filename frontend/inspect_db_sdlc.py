from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit

from sqlalchemy import inspect, text

from backend.config import get_settings
from backend.database.session import SessionLocal, engine

# Import models so relationships/table mappings are loaded.
from backend.models.project import (  # noqa: F401
    CalendarEvent,
    Invitation,
    Project,
    ProjectAuditLog,
    ProjectMember,
    Role,
    Sprint,
    Subtask,
    Task,
    TaskAuditLog,
    TaskComment,
)
from backend.models.user import User  # noqa: F401


def mask_db_url(url: str) -> str:
    try:
        parts = urlsplit(url)
        if "@" not in parts.netloc:
            return url

        userinfo, hostinfo = parts.netloc.rsplit("@", 1)
        if ":" in userinfo:
            username, _password = userinfo.split(":", 1)
            userinfo = f"{username}:***"

        return urlunsplit((parts.scheme, f"{userinfo}@{hostinfo}", parts.path, parts.query, parts.fragment))
    except Exception:
        return "<could-not-mask-db-url>"


def print_section(title: str) -> None:
    print()
    print("=" * 100)
    print(title)
    print("=" * 100)


def safe_json(value: str | None):
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


settings = get_settings()
inspector = inspect(engine)

print_section("DATABASE CONNECTION")
print(f"generated_at: {datetime.now().isoformat(timespec='seconds')}")
print(f"dialect: {engine.dialect.name}")
print(f"database_url_masked: {mask_db_url(settings.database_url)}")

print_section("TABLES / COLUMNS / FOREIGN KEYS")
tables = inspector.get_table_names()
print(f"tables_count: {len(tables)}")
print("tables:", ", ".join(tables))

for table in tables:
    print()
    print(f"--- TABLE: {table} ---")
    columns = inspector.get_columns(table)
    for col in columns:
        pk = "PK" if col.get("primary_key") else "  "
        nullable = "NULL" if col.get("nullable") else "NOT NULL"
        default = col.get("default")
        print(f"{pk} {col['name']}: {col['type']} | {nullable} | default={default}")

    fks = inspector.get_foreign_keys(table)
    if fks:
        print("foreign_keys:")
        for fk in fks:
            print(f"  {fk.get('constrained_columns')} -> {fk.get('referred_table')}.{fk.get('referred_columns')}")

print_section("ROW COUNTS")
with engine.connect() as conn:
    for table in tables:
        try:
            count = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar_one()
            print(f"{table}: {count}")
        except Exception as exc:
            print(f"{table}: ERROR {exc}")

db = SessionLocal()

try:
    print_section("USERS")
    users = db.query(User).order_by(User.id.asc()).all()
    for user in users:
        print(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "has_avatar": bool(user.avatar_url),
            }
        )

    print_section("PROJECTS")
    projects = db.query(Project).order_by(Project.id.asc()).all()
    for project in projects:
        members_count = db.query(ProjectMember).filter(ProjectMember.project_id == project.id).count()
        tasks_count = db.query(Task).filter(Task.project_id == project.id).count()
        sprints_count = db.query(Sprint).filter(Sprint.project_id == project.id).count()
        calendar_count = db.query(CalendarEvent).filter(CalendarEvent.project_id == project.id).count()

        print(
            {
                "id": project.id,
                "name": project.name,
                "key": project.key,
                "methodology": project.methodology,
                "owner_id": project.owner_id,
                "members": members_count,
                "tasks": tasks_count,
                "sprints": sprints_count,
                "calendar_events": calendar_count,
                "created_at": project.created_at.isoformat() if project.created_at else None,
            }
        )

    print_section("PROJECT DETAILS")
    for project in projects:
        print()
        print(f"--- PROJECT {project.id}: {project.key} / {project.name} / {project.methodology} ---")

        print("members:")
        members = (
            db.query(ProjectMember)
            .filter(ProjectMember.project_id == project.id)
            .order_by(ProjectMember.id.asc())
            .all()
        )
        for member in members:
            print(
                {
                    "membership_id": member.id,
                    "user_id": member.user_id,
                    "user_email": member.user.email if member.user else None,
                    "user_name": member.user.full_name if member.user else None,
                    "role_id": member.role_id,
                    "role_name": member.role.name if member.role else None,
                    "joined_at": member.joined_at.isoformat() if member.joined_at else None,
                }
            )

        print("roles:")
        roles = (
            db.query(Role)
            .filter(Role.project_id == project.id)
            .order_by(Role.id.asc())
            .all()
        )
        for role in roles:
            perms = safe_json(role.permissions)
            enabled = sorted([key for key, value in perms.items() if value])
            disabled = sorted([key for key, value in perms.items() if not value])
            print(
                {
                    "role_id": role.id,
                    "name": role.name,
                    "description": role.description,
                    "enabled_permissions": enabled,
                    "disabled_permissions": disabled,
                }
            )

        print("sprints:")
        sprints = (
            db.query(Sprint)
            .filter(Sprint.project_id == project.id)
            .order_by(Sprint.id.asc())
            .all()
        )
        for sprint in sprints:
            sprint_tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
            done_tasks = [task for task in sprint_tasks if str(task.status.value if hasattr(task.status, "value") else task.status) == "DONE"]
            print(
                {
                    "sprint_id": sprint.id,
                    "name": sprint.name,
                    "goal": sprint.goal,
                    "is_active": sprint.is_active,
                    "start_date": sprint.start_date.isoformat() if sprint.start_date else None,
                    "end_date": sprint.end_date.isoformat() if sprint.end_date else None,
                    "tasks": len(sprint_tasks),
                    "done_tasks": len(done_tasks),
                    "story_points_total": sum(task.story_points or 0 for task in sprint_tasks),
                    "story_points_done": sum(task.story_points or 0 for task in done_tasks),
                }
            )

        tasks = db.query(Task).filter(Task.project_id == project.id).order_by(Task.id.asc()).all()
        status_counter = Counter(str(task.status.value if hasattr(task.status, "value") else task.status) for task in tasks)
        priority_counter = Counter(str(task.priority.value if hasattr(task.priority, "value") else task.priority) for task in tasks)
        assignee_counter = Counter(task.assignee_id for task in tasks)

        print("task_distribution:")
        print({"by_status": dict(status_counter)})
        print({"by_priority": dict(priority_counter)})
        print({"by_assignee_id": dict(assignee_counter)})

        print("task_key_range:")
        print(
            {
                "first": tasks[0].key if tasks else None,
                "last": tasks[-1].key if tasks else None,
                "count": len(tasks),
            }
        )

        print("recent_tasks_sample:")
        for task in list(reversed(tasks))[:12]:
            print(
                {
                    "id": task.id,
                    "key": task.key,
                    "title": task.title,
                    "status": str(task.status.value if hasattr(task.status, "value") else task.status),
                    "priority": str(task.priority.value if hasattr(task.priority, "value") else task.priority),
                    "story_points": task.story_points,
                    "due_date": task.due_date.isoformat() if task.due_date else None,
                    "assignee_id": task.assignee_id,
                    "assignee_name": task.assignee_name,
                    "sprint_id": task.sprint_id,
                }
            )

        print("audit_counts:")
        task_ids = [task.id for task in tasks]
        if task_ids:
            audit_count = db.query(TaskAuditLog).filter(TaskAuditLog.task_id.in_(task_ids)).count()
            comment_count = db.query(TaskComment).filter(TaskComment.task_id.in_(task_ids)).count()
            subtask_count = db.query(Subtask).filter(Subtask.task_id.in_(task_ids)).count()
        else:
            audit_count = comment_count = subtask_count = 0

        print(
            {
                "task_audit_logs": audit_count,
                "comments": comment_count,
                "subtasks": subtask_count,
            }
        )

    print_section("SEED RECOMMENDATION INPUT")
    print("Trimite acest fisier inapoi. Pe baza lui alegem:")
    print("- daca populam proiectul existent sau cream un proiect demo separat;")
    print("- cati useri/membri trebuie creati;")
    print("- ce metodologie folosim pentru demo: SCRUM, KANBAN sau SCRUMBAN;")
    print("- cate sprinturi istorice si cate task-uri active generam;")
    print("- daca facem seed reversibil cu tag/prefix pentru cleanup.")

finally:
    db.close()
