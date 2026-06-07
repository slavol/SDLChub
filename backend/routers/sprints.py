from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import Project, Sprint, Task, TaskStatus
from backend.models.user import User
from backend.realtime import broadcast_project_event
from backend.routers.auth import get_current_user
from backend.schemas.sprint import SprintOut
from backend.services.ai_service import generate_release_notes, resolve_project_ai_config
from backend.utils.permissions import check_project_permission, require_project_permission
from backend.utils.ai_usage import record_ai_usage


router = APIRouter(prefix="/sprints", tags=["Sprints"])


SPRINT_MANAGEMENT_ROLES = [
    "Project Admin",
    "Scrum Master",
    "Project Manager",
    "Product Owner",
    "Tech Lead",
]


def _ai_usage_status(result: dict) -> str:
    return "ERROR" if str(result.get("source", "")).startswith("fallback_after_error") else "SUCCESS"


def _ai_usage_detail(result: dict) -> str | None:
    return result.get("error") or result.get("error_detail")


class SprintCreate(BaseModel):
    name: str
    project_id: int
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def ensure_project_uses_sprints(project: Project) -> None:
    if project.methodology == "KANBAN":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kanban projects do not use sprints.",
        )


@router.post("/", response_model=SprintOut)
def create_sprint(
    sprint_in: SprintCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project_or_404(db, sprint_in.project_id)
    ensure_project_uses_sprints(project)

    require_project_permission(db, current_user.id, sprint_in.project_id, "SPRINT_CREATE")

    new_sprint = Sprint(
        name=sprint_in.name.strip(),
        project_id=sprint_in.project_id,
        goal=sprint_in.goal,
        start_date=sprint_in.start_date,
        end_date=sprint_in.end_date,
        is_active=False,
    )

    db.add(new_sprint)
    db.commit()
    db.refresh(new_sprint)
    broadcast_project_event(
        new_sprint.project_id,
        "sprint.changed",
        {"action": "created", "sprint_id": new_sprint.id},
    )
    return new_sprint


@router.get("/project/{project_id}", response_model=list[SprintOut])
def get_project_sprints(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_project_or_404(db, project_id)
    check_project_permission(db, current_user.id, project_id)

    return (
        db.query(Sprint)
        .filter(Sprint.project_id == project_id)
        .order_by(Sprint.is_active.desc(), Sprint.id.desc())
        .all()
    )


@router.put("/{sprint_id}", response_model=SprintOut)
def update_sprint(
    sprint_id: int,
    sprint_in: SprintUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = get_project_or_404(db, sprint.project_id)
    ensure_project_uses_sprints(project)
    require_project_permission(db, current_user.id, sprint.project_id, "SPRINT_UPDATE")

    update_data = sprint_in.model_dump(exclude_unset=True)

    if "name" in update_data:
        next_name = (update_data["name"] or "").strip()
        if not next_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Sprint name is required.",
            )
        sprint.name = next_name

    if "goal" in update_data:
        sprint.goal = update_data["goal"]
    if "start_date" in update_data:
        sprint.start_date = update_data["start_date"]
    if "end_date" in update_data:
        sprint.end_date = update_data["end_date"]

    db.commit()
    db.refresh(sprint)
    broadcast_project_event(
        sprint.project_id,
        "sprint.changed",
        {"action": "updated", "sprint_id": sprint.id},
    )
    return sprint


@router.delete("/{sprint_id}")
def delete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = get_project_or_404(db, sprint.project_id)
    ensure_project_uses_sprints(project)
    require_project_permission(db, current_user.id, sprint.project_id, "SPRINT_DELETE")

    if sprint.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active sprints cannot be deleted. Complete the sprint first.",
        )

    affected_tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    moved_count = 0
    for task in affected_tasks:
        task.sprint_id = None
        moved_count += 1

    project_id = sprint.project_id
    db.delete(sprint)
    db.commit()
    broadcast_project_event(
        project_id,
        "sprint.changed",
        {"action": "deleted", "sprint_id": sprint_id, "moved_count": moved_count},
    )

    return {
        "message": f"Sprint deleted. {moved_count} task(s) moved to Backlog.",
        "moved_count": moved_count,
    }


@router.post("/{sprint_id}/start")
def start_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = get_project_or_404(db, sprint.project_id)
    ensure_project_uses_sprints(project)

    require_project_permission(db, current_user.id, sprint.project_id, "SPRINT_START")

    if sprint.is_active:
        return {"message": "Sprint is already active.", "sprint": sprint.name}

    active_sprint = db.query(Sprint).filter(
        Sprint.project_id == sprint.project_id,
        Sprint.is_active == True,  # noqa: E712
    ).first()

    if active_sprint:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sprint '{active_sprint.name}' is already active. Complete it first.",
        )

    sprint.is_active = True
    if sprint.start_date is None:
        sprint.start_date = datetime.utcnow()

    db.commit()
    broadcast_project_event(
        sprint.project_id,
        "sprint.changed",
        {"action": "started", "sprint_id": sprint.id},
    )

    return {"message": "Sprint started successfully", "sprint": sprint.name}


@router.post("/{sprint_id}/complete")
def complete_sprint(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    project = get_project_or_404(db, sprint.project_id)
    ensure_project_uses_sprints(project)

    require_project_permission(db, current_user.id, sprint.project_id, "SPRINT_CLOSE")

    if not sprint.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sprint is not active.",
        )

    unfinished_tasks = db.query(Task).filter(
        Task.sprint_id == sprint_id,
        Task.status != TaskStatus.DONE,
    ).all()

    moved_count = 0
    for task in unfinished_tasks:
        task.sprint_id = None
        moved_count += 1

    sprint.is_active = False
    if sprint.end_date is None:
        sprint.end_date = datetime.utcnow()

    db.commit()
    broadcast_project_event(
        sprint.project_id,
        "sprint.changed",
        {"action": "completed", "sprint_id": sprint.id, "moved_count": moved_count},
    )

    return {
        "message": f"Sprint completed. {moved_count} unfinished tasks moved to backlog.",
        "sprint": sprint.name,
    }


@router.post("/{sprint_id}/release-notes")
def generate_sprint_release_notes(
    sprint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sprint not found")

    check_project_permission(db, current_user.id, sprint.project_id)
    require_project_permission(db, current_user.id, sprint.project_id, "AI_USE")

    tasks = db.query(Task).filter(Task.sprint_id == sprint.id).all()
    completed_tasks = [
        {
            "key": task.key,
            "title": task.title,
            "priority": task.priority.value if hasattr(task.priority, "value") else str(task.priority),
            "story_points": task.story_points,
        }
        for task in tasks
        if task.status == TaskStatus.DONE
    ]
    unfinished_tasks = [
        {
            "key": task.key,
            "title": task.title,
            "status": task.status.value if hasattr(task.status, "value") else str(task.status),
            "priority": task.priority.value if hasattr(task.priority, "value") else str(task.priority),
        }
        for task in tasks
        if task.status != TaskStatus.DONE
    ]

    result = generate_release_notes(
        sprint_name=sprint.name,
        sprint_goal=sprint.goal,
        completed_tasks=completed_tasks,
        unfinished_tasks=unfinished_tasks,
        context="Software sprint release notes for SDLC Hub project management",
        ai_config=resolve_project_ai_config(sprint.project),
    )
    record_ai_usage(
        db,
        user_id=current_user.id,
        project_id=sprint.project_id,
        feature="RELEASE_NOTES",
        source=result.get("source"),
        status=_ai_usage_status(result),
        detail=_ai_usage_detail(result),
    )
    return result
