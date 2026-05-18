from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import Project, Sprint, Task, TaskStatus
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.sprint import SprintOut
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/sprints", tags=["Sprints"])


SPRINT_MANAGEMENT_ROLES = [
    "Project Admin",
    "Scrum Master",
    "Project Manager",
    "Product Owner",
    "Tech Lead",
]


class SprintCreate(BaseModel):
    name: str
    project_id: int
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

    return {
        "message": f"Sprint completed. {moved_count} unfinished tasks moved to backlog.",
        "sprint": sprint.name,
    }
