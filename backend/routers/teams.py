from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import ProjectMember, ProjectTeam, Task
from backend.models.user import User
from backend.realtime import broadcast_project_event
from backend.routers.auth import get_current_user
from backend.schemas.team import ProjectMemberTeamUpdate, ProjectTeamCreate, ProjectTeamOut, ProjectTeamUpdate
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/teams", tags=["Teams"])


def _team_payload(db: Session, team: ProjectTeam) -> dict:
    return {
        "id": team.id,
        "project_id": team.project_id,
        "parent_id": team.parent_id,
        "name": team.name,
        "description": team.description,
        "member_count": db.query(ProjectMember).filter(ProjectMember.team_id == team.id).count(),
        "task_count": db.query(Task).filter(Task.team_id == team.id).count(),
        "created_at": team.created_at,
        "updated_at": team.updated_at,
    }


def _get_team(db: Session, team_id: int) -> ProjectTeam:
    team = db.query(ProjectTeam).filter(ProjectTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found.")
    return team


def _ensure_parent_belongs_to_project(
    db: Session,
    project_id: int,
    parent_id: int | None,
    current_team_id: int | None = None,
) -> ProjectTeam | None:
    if not parent_id:
        return None

    if current_team_id and parent_id == current_team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A team cannot be its own parent.",
        )

    parent = db.query(ProjectTeam).filter(
        ProjectTeam.id == parent_id,
        ProjectTeam.project_id == project_id,
    ).first()

    if not parent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent team must belong to this project.",
        )

    ancestor = parent
    seen_ids: set[int] = set()
    while ancestor:
        if ancestor.id in seen_ids:
            break
        seen_ids.add(ancestor.id)

        if current_team_id and ancestor.parent_id == current_team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This parent would create a circular team hierarchy.",
            )

        ancestor = ancestor.parent

    return parent


@router.get("/project/{project_id}", response_model=list[ProjectTeamOut])
def list_project_teams(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    teams = (
        db.query(ProjectTeam)
        .filter(ProjectTeam.project_id == project_id)
        .order_by(ProjectTeam.parent_id.asc().nullsfirst(), ProjectTeam.name.asc(), ProjectTeam.id.asc())
        .all()
    )

    return [_team_payload(db, team) for team in teams]


@router.post("/project/{project_id}", response_model=ProjectTeamOut)
def create_project_team(
    project_id: int,
    team_in: ProjectTeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "TEAM_MANAGE")
    _ensure_parent_belongs_to_project(db, project_id, team_in.parent_id)

    team = ProjectTeam(
        project_id=project_id,
        parent_id=team_in.parent_id,
        name=team_in.name.strip(),
        description=team_in.description,
    )
    db.add(team)
    db.commit()
    db.refresh(team)

    broadcast_project_event(
        project_id,
        "project.changed",
        {"action": "team_created", "team_id": team.id},
    )

    return _team_payload(db, team)


@router.put("/{team_id}", response_model=ProjectTeamOut)
def update_project_team(
    team_id: int,
    team_in: ProjectTeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team(db, team_id)
    require_project_permission(db, current_user.id, team.project_id, "TEAM_MANAGE")

    update_data = team_in.model_dump(exclude_unset=True)

    if "parent_id" in update_data:
        _ensure_parent_belongs_to_project(db, team.project_id, update_data["parent_id"], team.id)
        team.parent_id = update_data["parent_id"]

    if "name" in update_data and update_data["name"] is not None:
        team.name = update_data["name"].strip()

    if "description" in update_data:
        team.description = update_data["description"]

    db.commit()
    db.refresh(team)

    broadcast_project_event(
        team.project_id,
        "project.changed",
        {"action": "team_updated", "team_id": team.id},
    )

    return _team_payload(db, team)


@router.delete("/{team_id}")
def delete_project_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _get_team(db, team_id)
    project_id = team.project_id
    require_project_permission(db, current_user.id, project_id, "TEAM_MANAGE")

    db.query(ProjectMember).filter(ProjectMember.team_id == team.id).update(
        {"team_id": None},
        synchronize_session=False,
    )
    db.query(Task).filter(Task.team_id == team.id).update(
        {"team_id": None},
        synchronize_session=False,
    )
    db.query(ProjectTeam).filter(ProjectTeam.parent_id == team.id).update(
        {"parent_id": None},
        synchronize_session=False,
    )
    db.delete(team)
    db.commit()

    broadcast_project_event(
        project_id,
        "project.changed",
        {"action": "team_deleted", "team_id": team_id},
    )

    return {"message": "Team deleted."}


@router.put("/project/{project_id}/members/{membership_id}", response_model=dict)
def update_member_team(
    project_id: int,
    membership_id: int,
    data: ProjectMemberTeamUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "TEAM_MANAGE")

    membership = db.query(ProjectMember).filter(
        ProjectMember.id == membership_id,
        ProjectMember.project_id == project_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    if data.team_id:
        team = db.query(ProjectTeam).filter(
            ProjectTeam.id == data.team_id,
            ProjectTeam.project_id == project_id,
        ).first()
        if not team:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team must belong to this project.",
            )

    membership.team_id = data.team_id
    db.commit()
    db.refresh(membership)

    broadcast_project_event(
        project_id,
        "project.changed",
        {
            "action": "member_team_updated",
            "membership_id": membership.id,
            "team_id": membership.team_id,
        },
    )

    return {"membership_id": membership.id, "team_id": membership.team_id}
