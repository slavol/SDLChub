from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import (
    Project,
    ProjectMember,
    Sprint,
    Subtask,
    Task,
    TaskAuditLog,
    TaskComment,
)
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.task import (
    SubtaskCreate,
    SubtaskOut,
    SubtaskUpdate,
    TaskAuditLogOut,
    TaskCommentCreate,
    TaskCommentOut,
    TaskCommentUpdate,
    TaskCreate,
    TaskDetailOut,
    TaskOut,
    TaskUpdate,
)
from backend.services.ai_service import generate_task_metadata
from backend.utils.permissions import check_project_permission


router = APIRouter(prefix="/tasks", tags=["Tasks"])


class AIRequest(BaseModel):
    title: str
    priority: str
    context: str = "Software Development"


class ProjectActivityOut(BaseModel):
    id: int
    task_id: int
    task_key: str
    task_title: str
    actor_id: int | None = None
    actor_name: str | None = None
    action: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_at: str


def serialize_value(value):
    if value is None:
        return None
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def add_audit_log(
    db: Session,
    task_id: int,
    actor_id: int | None,
    action: str,
    field: str | None = None,
    old_value=None,
    new_value=None,
):
    db.add(
        TaskAuditLog(
            task_id=task_id,
            actor_id=actor_id,
            action=action,
            field=field,
            old_value=serialize_value(old_value),
            new_value=serialize_value(new_value),
        )
    )


def get_task_for_user(task_id: int, db: Session, current_user: User):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    check_project_permission(db, current_user.id, task.project_id)
    return task


def ensure_assignee_is_project_member(
    db: Session,
    project_id: int,
    assignee_id: int | None,
):
    if not assignee_id:
        return

    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == assignee_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assignee must be a member of this project.",
        )


def ensure_sprint_belongs_to_project(
    db: Session,
    project_id: int,
    sprint_id: int | None,
):
    if not sprint_id:
        return

    sprint = db.query(Sprint).filter(
        Sprint.id == sprint_id,
        Sprint.project_id == project_id,
    ).first()

    if not sprint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint does not belong to this project.",
        )


# Static routes first, before dynamic /{task_id}.
@router.post("/ai-generate")
def generate_task_ai(req: AIRequest, current_user: User = Depends(get_current_user)):
    try:
        description = generate_task_metadata(req.title, req.priority, req.context)
        return {"description": description}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/project/{project_id}", response_model=List[TaskOut])
def get_project_tasks(
    project_id: int,
    view: Optional[str] = Query("board", description="board or backlog"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Task).filter(Task.project_id == project_id)

    if project.methodology == "SCRUM" and view == "board":
        active_sprint = db.query(Sprint).filter(
            Sprint.project_id == project_id,
            Sprint.is_active == True,  # noqa: E712
        ).first()

        if active_sprint:
            query = query.filter(Task.sprint_id == active_sprint.id)
        else:
            return []

    return query.order_by(Task.created_at.desc()).all()




@router.get("/project/{project_id}/activity", response_model=List[ProjectActivityOut])
def get_project_activity(
    project_id: int,
    limit: int = Query(50, ge=1, le=200),
    hours: Optional[int] = Query(None, description="Filter activity from the last N hours"),
    actor_id: Optional[int] = Query(None, description="Filter by actor/user id"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    from datetime import datetime, timedelta

    query = (
        db.query(TaskAuditLog, Task)
        .join(Task, TaskAuditLog.task_id == Task.id)
        .filter(Task.project_id == project_id)
    )

    if hours:
        since = datetime.utcnow() - timedelta(hours=hours)
        query = query.filter(TaskAuditLog.created_at >= since)

    if actor_id:
        query = query.filter(TaskAuditLog.actor_id == actor_id)

    if action:
        query = query.filter(TaskAuditLog.action == action)

    rows = (
        query
        .order_by(TaskAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    activities = [
        {
            "id": log.id,
            "task_id": task.id,
            "task_key": task.key,
            "task_title": task.title,
            "actor_id": log.actor_id,
            "actor_name": log.actor_name,
            "action": log.action,
            "field": log.field,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log, task in rows
    ]

    # Fallback pentru proiecte vechi fără audit log.
    if not activities:
        tasks = (
            db.query(Task)
            .filter(Task.project_id == project_id)
            .order_by(Task.created_at.desc())
            .limit(limit)
            .all()
        )

        activities = [
            {
                "id": task.id,
                "task_id": task.id,
                "task_key": task.key,
                "task_title": task.title,
                "actor_id": None,
                "actor_name": "System",
                "action": "TASK_CREATED",
                "field": "title",
                "old_value": None,
                "new_value": task.title,
                "created_at": task.created_at.isoformat() if task.created_at else "",
            }
            for task in tasks
        ]

    return activities


@router.post("/", response_model=TaskOut)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, task_in.project_id)

    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ensure_assignee_is_project_member(db, task_in.project_id, task_in.assignee_id)
    ensure_sprint_belongs_to_project(db, task_in.project_id, task_in.sprint_id)

    count = db.query(Task).filter(Task.project_id == task_in.project_id).count()
    task_key = f"{project.key}-{count + 1}"

    new_task = Task(
        key=task_key,
        title=task_in.title,
        description=task_in.description,
        priority=task_in.priority,
        story_points=task_in.story_points,
        due_date=task_in.due_date,
        project_id=task_in.project_id,
        assignee_id=task_in.assignee_id,
        sprint_id=task_in.sprint_id,
    )

    db.add(new_task)
    db.flush()

    add_audit_log(
        db,
        task_id=new_task.id,
        actor_id=current_user.id,
        action="TASK_CREATED",
        field="title",
        old_value=None,
        new_value=new_task.title,
    )

    db.commit()
    db.refresh(new_task)
    return new_task


@router.get("/{task_id}", response_model=TaskDetailOut)
def get_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_task_for_user(task_id, db, current_user)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    member = check_project_permission(db, current_user.id, task.project_id)

    user_role = member.role.name if (member and member.role) else "Member"
    is_project_owner = task.project.owner_id == current_user.id
    is_tech_admin = is_project_owner or user_role in [
        "Scrum Master",
        "Tech Lead",
        "Project Manager",
        "Project Admin",
    ]

    update_data = task_in.model_dump(exclude_unset=True)

    if "story_points" in update_data and update_data["story_points"] != task.story_points:
        if not is_tech_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Governance: Only Project Admin, Scrum Master, Project Manager or Tech Lead can change Story Points.",
            )

        add_audit_log(
            db,
            task.id,
            current_user.id,
            "TASK_UPDATED",
            "story_points",
            task.story_points,
            update_data["story_points"],
        )
        task.story_points = update_data["story_points"]

    if "sprint_id" in update_data:
        raw_sprint_id = update_data["sprint_id"]
        new_sprint_id = raw_sprint_id if raw_sprint_id and raw_sprint_id > 0 else None
        ensure_sprint_belongs_to_project(db, task.project_id, new_sprint_id)

        if new_sprint_id != task.sprint_id:
            add_audit_log(
                db,
                task.id,
                current_user.id,
                "TASK_UPDATED",
                "sprint_id",
                task.sprint_id,
                new_sprint_id,
            )
            task.sprint_id = new_sprint_id

    if "assignee_id" in update_data:
        raw_assignee_id = update_data["assignee_id"]
        new_assignee_id = raw_assignee_id if raw_assignee_id and raw_assignee_id > 0 else None
        ensure_assignee_is_project_member(db, task.project_id, new_assignee_id)

        if new_assignee_id != task.assignee_id:
            add_audit_log(
                db,
                task.id,
                current_user.id,
                "TASK_UPDATED",
                "assignee_id",
                task.assignee_id,
                new_assignee_id,
            )
            task.assignee_id = new_assignee_id

    if "due_date" in update_data and update_data["due_date"] != task.due_date:
        add_audit_log(
            db,
            task.id,
            current_user.id,
            "TASK_UPDATED",
            "due_date",
            task.due_date,
            update_data["due_date"],
        )
        task.due_date = update_data["due_date"]

    if "status" in update_data and update_data["status"] != task.status:
        add_audit_log(db, task.id, current_user.id, "TASK_UPDATED", "status", task.status, update_data["status"])
        task.status = update_data["status"]

    if "priority" in update_data and update_data["priority"] != task.priority:
        add_audit_log(db, task.id, current_user.id, "TASK_UPDATED", "priority", task.priority, update_data["priority"])
        task.priority = update_data["priority"]

    if "title" in update_data and update_data["title"] is not None and update_data["title"] != task.title:
        add_audit_log(db, task.id, current_user.id, "TASK_UPDATED", "title", task.title, update_data["title"])
        task.title = update_data["title"]

    if "description" in update_data and update_data["description"] != task.description:
        add_audit_log(
            db,
            task.id,
            current_user.id,
            "TASK_UPDATED",
            "description",
            task.description,
            update_data["description"],
        )
        task.description = update_data["description"]

    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/subtasks", response_model=SubtaskOut)
def create_subtask(
    task_id: int,
    subtask_in: SubtaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    subtask = Subtask(
        task_id=task.id,
        title=subtask_in.title,
        created_by_id=current_user.id,
        is_done=False,
    )

    db.add(subtask)
    db.flush()

    add_audit_log(db, task.id, current_user.id, "SUBTASK_CREATED", "subtask", None, subtask.title)

    db.commit()
    db.refresh(subtask)
    return subtask


@router.put("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskOut)
def update_subtask(
    task_id: int,
    subtask_id: int,
    subtask_in: SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    subtask = db.query(Subtask).filter(
        Subtask.id == subtask_id,
        Subtask.task_id == task.id,
    ).first()

    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")

    if subtask_in.title is not None and subtask_in.title != subtask.title:
        add_audit_log(db, task.id, current_user.id, "SUBTASK_UPDATED", "subtask.title", subtask.title, subtask_in.title)
        subtask.title = subtask_in.title

    if subtask_in.is_done is not None and subtask_in.is_done != subtask.is_done:
        add_audit_log(db, task.id, current_user.id, "SUBTASK_UPDATED", "subtask.is_done", subtask.is_done, subtask_in.is_done)
        subtask.is_done = subtask_in.is_done

    db.commit()
    db.refresh(subtask)
    return subtask


@router.post("/{task_id}/comments", response_model=TaskCommentOut)
def create_comment(
    task_id: int,
    comment_in: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    comment = TaskComment(
        task_id=task.id,
        author_id=current_user.id,
        body=comment_in.body,
    )

    db.add(comment)
    db.flush()

    add_audit_log(db, task.id, current_user.id, "COMMENT_ADDED", "comment", None, comment.body)

    db.commit()
    db.refresh(comment)
    return comment


@router.put("/{task_id}/comments/{comment_id}", response_model=TaskCommentOut)
def update_comment(
    task_id: int,
    comment_id: int,
    comment_in: TaskCommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task.id,
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can edit this comment.",
        )

    old_body = comment.body
    comment.body = comment_in.body

    add_audit_log(db, task.id, current_user.id, "COMMENT_UPDATED", "comment", old_body, comment.body)

    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{task_id}/comments/{comment_id}")
def delete_comment(
    task_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    comment = db.query(TaskComment).filter(
        TaskComment.id == comment_id,
        TaskComment.task_id == task.id,
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author can delete this comment.",
        )

    old_body = comment.body
    db.delete(comment)

    add_audit_log(db, task.id, current_user.id, "COMMENT_DELETED", "comment", old_body, None)

    db.commit()
    return {"message": "Comment deleted"}


@router.get("/{task_id}/audit", response_model=List[TaskAuditLogOut])
def get_task_audit_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = get_task_for_user(task_id, db, current_user)

    return db.query(TaskAuditLog).filter(
        TaskAuditLog.task_id == task.id
    ).order_by(TaskAuditLog.created_at.desc()).all()
