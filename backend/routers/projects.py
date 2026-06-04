import json
import secrets
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import Invitation, Project, ProjectMember, ProjectTeam, Role, Task, TaskAuditLog
from backend.models.user import User
from backend.realtime import broadcast_project_event
from backend.routers.auth import get_current_user
from backend.schemas.project import (
    AIRequest,
    AIResponse,
    AIRoleRequest,
    InvitationOut,
    OnboardingStatusOut,
    ProjectCreateFull,
    ProjectMemberOut,
    ProjectOut,
)
from backend.services.ai_advisor import get_methodology_recommendation, get_role_suggestions
from backend.services.ai_service import enhance_workload_suggestions, resolve_project_ai_config, test_ai_provider
from backend.config import get_settings
from backend.utils.email import send_project_invitation_email
from backend.utils.permissions import check_project_permission, parse_role_permissions, require_project_permission
from backend.utils.ai_usage import record_ai_usage
from backend.utils.secret_crypto import decrypt_secret, encrypt_secret


router = APIRouter(prefix="/projects", tags=["Projects"])


PROJECT_ADMIN_PERMISSIONS = {
    "PROJECT_UPDATE": True,
    "PROJECT_DELETE": True,
    "MEMBER_INVITE": True,
    "MEMBER_REMOVE": True,
    "ROLE_MANAGE": True,
    "TEAM_MANAGE": True,
    "TASK_CREATE": True,
    "TASK_UPDATE": True,
    "TASK_DELETE": True,
    "TASK_ASSIGN": True,
    "TASK_MOVE": True,
    "SPRINT_CREATE": True,
    "SPRINT_START": True,
    "SPRINT_CLOSE": True,
    "AI_USE": True,
    "REPORT_VIEW": True,
    "SETTINGS_MANAGE": True,
    "CALENDAR_CREATE": True,
    "CALENDAR_UPDATE": True,
    "CALENDAR_DELETE": True,
}


DEFAULT_ROLE_PERMISSIONS = {
    "TASK_CREATE": True,
    "TASK_UPDATE": True,
    "TASK_ASSIGN": True,
    "TASK_COMMENT": True,
    "TASK_MOVE": True,
    "TEAM_MANAGE": False,
    "SPRINT_CREATE": False,
    "SPRINT_START": False,
    "SPRINT_CLOSE": False,
    "AI_USE": True,
    "REPORT_VIEW": True,
    "CALENDAR_CREATE": True,
    "CALENDAR_UPDATE": False,
    "CALENDAR_DELETE": False,
}

SPRINT_PERMISSION_KEYS = {"SPRINT_CREATE", "SPRINT_START", "SPRINT_CLOSE"}


class JoinRequest(BaseModel):
    code: str


def normalize_project_key(key: str) -> str:
    return key.strip().upper().replace(" ", "-")


def ensure_project_member(project_id: int, user_id: int, db: Session) -> ProjectMember:
    membership = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id,
    ).first()

    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this project.",
        )

    return membership


def serialize_member(member: ProjectMember) -> dict:
    return {
        "membership_id": member.id,
        "user": member.user,
        "role": _serialize_role(member.role, member.project) if member.role else None,
        "team": {
            "id": member.team.id,
            "project_id": member.team.project_id,
            "parent_id": member.team.parent_id,
            "name": member.team.name,
            "description": member.team.description,
            "member_count": len(member.team.members or []),
            "task_count": len(member.team.tasks or []),
            "created_at": member.team.created_at,
            "updated_at": member.team.updated_at,
        } if member.team else None,
        "joined_at": member.joined_at,
    }


def serialize_invitation(invite: Invitation) -> dict:
    return {
        "id": invite.id,
        "email": invite.email,
        "project_id": invite.project_id,
        "project_name": invite.project.name if invite.project else "",
        "role_id": invite.role_id,
        "role_name": invite.role.name if invite.role else "",
        "code": invite.code,
        "status": invite.status,
        "created_at": invite.created_at,
    }


@router.get("/onboarding/status", response_model=OnboardingStatusOut)
def get_onboarding_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = db.query(ProjectMember).filter(
        ProjectMember.user_id == current_user.id
    ).all()

    projects = [membership.project for membership in memberships if membership.project]

    has_pending_invites = db.query(Invitation).filter(
        Invitation.email == current_user.email,
        Invitation.status == "PENDING",
    ).first() is not None

    return {
        "has_projects": len(projects) > 0,
        "has_pending_invites": has_pending_invites,
        "projects": projects,
    }


@router.get("/invitations/pending", response_model=List[InvitationOut])
def get_pending_invitations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invites = db.query(Invitation).filter(
        Invitation.email == current_user.email,
        Invitation.status == "PENDING",
    ).order_by(Invitation.created_at.desc()).all()

    return [serialize_invitation(invite) for invite in invites]


@router.post("/join")
def join_project(
    data: JoinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite = db.query(Invitation).filter(
        Invitation.code == data.code.strip().upper(),
        Invitation.status == "PENDING",
    ).first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired invitation code.",
        )

    if invite.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to another email address.",
        )

    existing_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == invite.project_id,
        ProjectMember.user_id == current_user.id,
    ).first()

    if existing_member:
        invite.status = "ACCEPTED"
        db.commit()
        return {
            "message": "You are already a member of this project.",
            "project": existing_member.project,
        }

    new_member = ProjectMember(
        user_id=current_user.id,
        project_id=invite.project_id,
        role_id=invite.role_id,
    )

    db.add(new_member)
    invite.status = "ACCEPTED"
    db.commit()
    db.refresh(new_member)

    return {
        "message": "Successfully joined project!",
        "project": new_member.project,
    }


@router.post("/ai-recommend", response_model=AIResponse)
def ask_ai_methodology(
    request: AIRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = get_methodology_recommendation(request.model_dump())
    record_ai_usage(
        db,
        user_id=current_user.id,
        feature="METHODOLOGY_ADVISOR",
        source="gemini" if result.get("confidence_score", 0) else "fallback",
    )
    return result


@router.post("/ai-roles")
def ask_ai_roles(
    request: AIRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = get_role_suggestions(request.methodology, request.description)
    record_ai_usage(
        db,
        user_id=current_user.id,
        feature="ROLE_SUGGESTIONS",
        source="gemini" if result.get("roles") else "fallback",
    )
    return result


@router.post("/create_full", response_model=ProjectOut)
def create_project_full(
    data: ProjectCreateFull,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_key = normalize_project_key(data.key)

    existing_project = db.query(Project).filter(Project.key == project_key).first()
    if existing_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project key already exists.",
        )

    pending_email_tasks: list[tuple[str, str, str, str]] = []

    try:
        new_project = Project(
            name=data.name.strip(),
            key=project_key,
            description=data.description,
            methodology=data.methodology,
            workflow_config=json.dumps(_workflow_config_for_methodology(data.methodology)),
            owner_id=current_user.id,
        )
        db.add(new_project)
        db.flush()

        project_admin_role = Role(
            project_id=new_project.id,
            name="Project Admin",
            description="Full control over project settings, members, roles, tasks and reports.",
            permissions=json.dumps(PROJECT_ADMIN_PERMISSIONS),
        )
        db.add(project_admin_role)
        db.flush()

        created_role_names = {"project admin"}

        for role_in in data.roles:
            role_name = role_in.name.strip()
            if not role_name:
                continue

            normalized_role_name = role_name.lower()
            if normalized_role_name in created_role_names:
                continue

            db_role = Role(
                project_id=new_project.id,
                name=role_name,
                description=role_in.description,
                permissions=json.dumps(DEFAULT_ROLE_PERMISSIONS),
            )
            db.add(db_role)
            db.flush()

            created_role_names.add(normalized_role_name)

            for email in role_in.emails:
                email_value = str(email).strip().lower()
                secure_code = secrets.token_hex(4).upper()
                final_code = f"{project_key}-{secure_code}"

                invite = Invitation(
                    email=email_value,
                    project_id=new_project.id,
                    role_id=db_role.id,
                    code=final_code,
                    status="PENDING",
                )
                db.add(invite)

                pending_email_tasks.append(
                    (email_value, new_project.name, db_role.name, final_code)
                )

        owner_membership = ProjectMember(
            user_id=current_user.id,
            project_id=new_project.id,
            role_id=project_admin_role.id,
        )
        db.add(owner_membership)

        db.commit()
        db.refresh(new_project)

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project could not be created. Please check if the project key or invitation codes already exist.",
        ) from exc

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Project could not be created: {exc}",
        ) from exc

    for email, project_name, role_name, code in pending_email_tasks:
        background_tasks.add_task(
            send_project_invitation_email,
            email=email,
            project_name=project_name,
            role_name=role_name,
            code=code,
        )

    return new_project


@router.get("/mine", response_model=List[ProjectOut])
def get_my_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = db.query(ProjectMember).filter(
        ProjectMember.user_id == current_user.id
    ).all()

    return [membership.project for membership in memberships if membership.project]


@router.get("/{project_id}/members", response_model=List[ProjectMemberOut])
def get_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)

    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id
    ).order_by(ProjectMember.joined_at.asc()).all()

    return [serialize_member(member) for member in members]



@router.get("/{project_id}/my-permissions")
def get_my_project_permissions(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    membership = check_project_permission(db, current_user.id, project_id)
    role_name = membership.role.name if membership.role else "Member"
    is_project_owner = project.owner_id == current_user.id
    is_project_admin = role_name == "Project Admin"

    role_permissions = _parse_permissions(membership.role.permissions if membership.role else None)
    permissions = {**DEFAULT_ROLE_PERMISSIONS, **role_permissions}

    if is_project_owner or is_project_admin:
        permissions.update(PROJECT_ADMIN_PERMISSIONS)

    permissions = _normalize_permissions_for_methodology(
        project.methodology,
        permissions,
    )

    return {
        "membership_id": membership.id,
        "role": _serialize_role(membership.role, project) if membership.role else None,
        "permissions": permissions,
        "is_project_owner": is_project_owner,
        "is_project_admin": is_project_admin,
    }

# --- BATCH 6A TEAM SETTINGS PERMISSIONS ---

from pydantic import EmailStr, Field
from backend.models.project import ProjectAuditLog, Sprint, Task, TaskStatus, Subtask, TaskComment, TaskAuditLog


PROJECT_SETTINGS_ROLES = ["Project Admin"]
TEAM_MANAGEMENT_ROLES = ["Project Admin", "Project Manager", "Product Owner", "Scrum Master", "Flow Manager", "Tech Lead"]
ROLE_MANAGEMENT_ROLES = ["Project Admin"]


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    methodology: str | None = None


class MethodologyTransitionRequest(BaseModel):
    target_methodology: str
    strategy: str = "recommended"


class ProjectDeleteRequest(BaseModel):
    confirmation_key: str


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role_id: int


class UpdateMemberRoleRequest(BaseModel):
    role_id: int


class UpdateRolePermissionsRequest(BaseModel):
    permissions: dict[str, bool]


class WorkflowColumnConfigRequest(BaseModel):
    key: str
    label: str | None = None
    enabled: bool | None = None
    order: int | None = None
    color: str | None = None


class WorkflowConfigUpdateRequest(BaseModel):
    wip_limits: dict[str, int | None] | None = None
    columns: list[WorkflowColumnConfigRequest] | None = None


class ProjectAiSettingsUpdateRequest(BaseModel):
    mode: str
    provider: str = "GEMINI"
    provider_name: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    clear_api_key: bool = False


def _parse_permissions(raw_permissions: str | None) -> dict:
    if not raw_permissions:
        return {}
    try:
        parsed = json.loads(raw_permissions)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _normalize_permissions_for_methodology(
    methodology: str,
    permissions: dict | None,
) -> dict[str, bool]:
    normalized = {
        str(key): bool(value)
        for key, value in (permissions or {}).items()
    }

    if methodology == "KANBAN":
        for key in SPRINT_PERMISSION_KEYS:
            normalized[key] = False

    return normalized


DEFAULT_WORKFLOW_CONFIG = {
    "wip_limits": {
        "TODO": None,
        "IN_PROGRESS": 3,
        "REVIEW": 2,
        "DONE": None,
    },
    "columns": [
        {"key": "TODO", "label": "To Do", "enabled": True, "order": 0, "color": "bg-slate-500"},
        {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
        {"key": "REVIEW", "label": "Code Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
        {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
    ],
}


METHODOLOGY_WORKFLOW_PRESETS = {
    "SCRUM": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": None,
            "REVIEW": None,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Sprint To Do", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Sprint Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
    "KANBAN": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": 5,
            "REVIEW": 3,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Intake", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
    "SCRUMBAN": {
        "wip_limits": {
            "TODO": None,
            "IN_PROGRESS": 4,
            "REVIEW": 2,
            "DONE": None,
        },
        "columns": [
            {"key": "TODO", "label": "Ready", "enabled": True, "order": 0, "color": "bg-slate-500"},
            {"key": "IN_PROGRESS", "label": "In Progress", "enabled": True, "order": 1, "color": "bg-blue-500"},
            {"key": "REVIEW", "label": "Code Review", "enabled": True, "order": 2, "color": "bg-purple-500"},
            {"key": "DONE", "label": "Done", "enabled": True, "order": 3, "color": "bg-green-500"},
        ],
    },
}


def _workflow_config_for_methodology(methodology: str) -> dict:
    normalized_methodology = methodology.upper()
    preset = METHODOLOGY_WORKFLOW_PRESETS.get(normalized_methodology, DEFAULT_WORKFLOW_CONFIG)
    return json.loads(json.dumps(preset))


def _parse_workflow_config(raw_config: str | None) -> dict:
    config = json.loads(json.dumps(DEFAULT_WORKFLOW_CONFIG))
    if not raw_config:
        return config

    try:
        parsed = json.loads(raw_config)
    except Exception:
        return config

    if not isinstance(parsed, dict):
        return config

    raw_limits = parsed.get("wip_limits")
    if isinstance(raw_limits, dict):
        for status_key in DEFAULT_WORKFLOW_CONFIG["wip_limits"]:
            value = raw_limits.get(status_key)
            if value is None or value == "":
                config["wip_limits"][status_key] = None
                continue

            try:
                normalized_value = int(value)
            except (TypeError, ValueError):
                continue

            config["wip_limits"][status_key] = max(0, normalized_value)

    allowed_statuses = set(DEFAULT_WORKFLOW_CONFIG["wip_limits"].keys())
    default_columns = {
        column["key"]: column.copy()
        for column in DEFAULT_WORKFLOW_CONFIG["columns"]
    }
    raw_columns = parsed.get("columns")
    if isinstance(raw_columns, list):
        for raw_column in raw_columns:
            if not isinstance(raw_column, dict):
                continue

            status_key = str(raw_column.get("key", "")).upper()
            if status_key not in allowed_statuses:
                continue

            next_column = default_columns[status_key].copy()
            label = str(raw_column.get("label") or next_column["label"]).strip()
            next_column["label"] = label[:40] or next_column["label"]
            next_column["enabled"] = bool(raw_column.get("enabled", True))
            next_column["color"] = str(raw_column.get("color") or next_column["color"])[:80]

            try:
                next_column["order"] = int(raw_column.get("order", next_column["order"]))
            except (TypeError, ValueError):
                next_column["order"] = int(next_column["order"])

            default_columns[status_key] = next_column

    config["columns"] = sorted(default_columns.values(), key=lambda column: (column["order"], column["key"]))
    return config


def _project_workflow_config(project: Project) -> dict:
    if project.workflow_config:
        return _parse_workflow_config(project.workflow_config)
    return _workflow_config_for_methodology(project.methodology)


def _serialize_project(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "key": project.key,
        "description": project.description,
        "methodology": project.methodology,
        "workflow_config": _project_workflow_config(project),
        "is_archived": project.is_archived,
        "ai_config": {
            "mode": project.ai_provider_mode or "PLATFORM",
            "provider": project.ai_provider or "GEMINI",
            "provider_name": project.ai_provider_name or project.ai_provider or "Gemini",
            "base_url": project.ai_base_url,
            "model": project.ai_model,
            "has_project_key": bool(project.ai_api_key_encrypted),
            "platform_configured": bool(get_settings().gemini_api_key),
        },
        "owner_id": project.owner_id,
        "created_at": project.created_at,
    }


def _serialize_project_audit_log(log: ProjectAuditLog) -> dict:
    metadata = None
    if log.metadata_json:
        try:
            metadata = json.loads(log.metadata_json)
        except Exception:
            metadata = None

    return {
        "id": log.id,
        "project_id": log.project_id,
        "actor_id": log.actor_id,
        "actor_name": log.actor.full_name if log.actor else None,
        "actor_avatar_url": log.actor.avatar_url if log.actor else None,
        "action": log.action,
        "field": log.field,
        "old_value": log.old_value,
        "new_value": log.new_value,
        "metadata": metadata,
        "created_at": log.created_at,
    }


def _serialize_role(role: Role, project: Project | None = None) -> dict:
    permissions = _parse_permissions(role.permissions)
    if project:
        permissions = _normalize_permissions_for_methodology(
            project.methodology,
            permissions,
        )

    return {
        "id": role.id,
        "project_id": role.project_id,
        "name": role.name,
        "description": role.description,
        "permissions": permissions,
    }


def _serialize_project_invitation(invite: Invitation) -> dict:
    return {
        "id": invite.id,
        "email": invite.email,
        "project_id": invite.project_id,
        "project_name": invite.project.name if invite.project else "",
        "role_id": invite.role_id,
        "role_name": invite.role.name if invite.role else "",
        "code": invite.code,
        "status": invite.status,
        "created_at": invite.created_at,
    }


def _normalize_methodology(value: str) -> str:
    methodology = value.upper()
    if methodology not in {"SCRUM", "KANBAN", "SCRUMBAN"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid methodology.")
    return methodology


def _build_methodology_transition_preview(db: Session, project: Project, target_methodology: str) -> dict:
    current_methodology = project.methodology
    active_sprint = db.query(Sprint).filter(
        Sprint.project_id == project.id,
        Sprint.is_active == True,  # noqa: E712
    ).first()
    future_sprints = db.query(Sprint).filter(
        Sprint.project_id == project.id,
        Sprint.is_active == False,  # noqa: E712
    ).count()
    tasks = db.query(Task).filter(Task.project_id == project.id).all()

    active_sprint_tasks = [
        task for task in tasks
        if active_sprint and task.sprint_id == active_sprint.id
    ]
    unfinished_sprint_tasks = [
        task for task in active_sprint_tasks
        if _enum_value(task.status) != "DONE"
    ]
    backlog_tasks = [task for task in tasks if task.sprint_id is None]
    sprint_tasks = [task for task in tasks if task.sprint_id is not None]
    story_point_tasks = [task for task in tasks if task.story_points is not None]

    blockers: list[str] = []
    warnings: list[str] = []
    actions: list[str] = []
    recommended_strategy = "no_op"

    if target_methodology == current_methodology:
        actions.append("No workflow change is required.")
    elif target_methodology == "KANBAN":
        recommended_strategy = "flatten_to_flow"

        if active_sprint:
            warnings.append(
                f"Active sprint '{active_sprint.name}' will be closed automatically. Unfinished work will move to continuous flow."
            )

        if future_sprints:
            warnings.append(
                f"{future_sprints} inactive sprint(s) will remain as history, but sprint planning will be hidden."
            )

        if story_point_tasks:
            warnings.append(
                "Existing story points will remain for history, but Kanban issue creation/editing will hide estimation."
            )

        actions.extend([
            "The active sprint will be closed if one is currently running.",
            "Unfinished sprint work will move back to flow without losing task history.",
            "Backlog and sprint planning will be hidden from navigation.",
            "Open work will be treated as continuous flow on the board.",
            "Sprint endpoints will reject new Kanban sprint operations.",
        ])
    elif current_methodology == "KANBAN" and target_methodology in {"SCRUM", "SCRUMBAN"}:
        recommended_strategy = "enable_planning"
        actions.extend([
            "Backlog and sprint planning will become available.",
            "Existing board work will be available for sprint planning.",
            "Story points will be visible again in create/edit issue flows.",
        ])

        if backlog_tasks:
            warnings.append(
                f"{len(backlog_tasks)} existing task(s) will start as planning backlog candidates."
            )
    elif current_methodology in {"SCRUM", "SCRUMBAN"} and target_methodology in {"SCRUM", "SCRUMBAN"}:
        recommended_strategy = "preserve_planning"
        actions.extend([
            "Existing backlog, sprint history and active planning structure will be preserved.",
            "Navigation and estimation controls will adapt to the selected methodology.",
        ])

        if target_methodology == "SCRUM" and backlog_tasks:
            warnings.append(
                f"{len(backlog_tasks)} unplanned task(s) should be reviewed during sprint planning."
            )

    return {
        "current_methodology": current_methodology,
        "target_methodology": target_methodology,
        "recommended_strategy": recommended_strategy,
        "can_apply": len(blockers) == 0,
        "blockers": blockers,
        "warnings": warnings,
        "actions": actions,
        "affected_counts": {
            "total_tasks": len(tasks),
            "backlog_tasks": len(backlog_tasks),
            "sprint_tasks": len(sprint_tasks),
            "active_sprint_tasks": len(active_sprint_tasks),
            "unfinished_active_sprint_tasks": len(unfinished_sprint_tasks),
            "future_sprints": future_sprints,
            "story_point_tasks": len(story_point_tasks),
        },
    }


@router.get("/{project_id}/methodology-transition-preview")
def get_methodology_transition_preview(
    project_id: int,
    target: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    target_methodology = _normalize_methodology(target)
    return _build_methodology_transition_preview(db, project, target_methodology)


@router.post("/{project_id}/methodology-transition")
def apply_methodology_transition(
    project_id: int,
    data: MethodologyTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    target_methodology = _normalize_methodology(data.target_methodology)
    preview = _build_methodology_transition_preview(db, project, target_methodology)

    if not preview["can_apply"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Methodology transition has blockers.",
                "blockers": preview["blockers"],
            },
        )

    old_methodology = project.methodology

    if old_methodology == target_methodology:
        return {
            "project": _serialize_project(project),
            "transition": preview,
            "message": "Project already uses this methodology.",
        }

    moved_to_flow_count = 0
    closed_active_sprint_id = None
    if target_methodology == "KANBAN":
        active_sprint = db.query(Sprint).filter(
            Sprint.project_id == project_id,
            Sprint.is_active == True,  # noqa: E712
        ).first()

        if active_sprint:
            active_sprint.is_active = False
            if active_sprint.end_date is None:
                active_sprint.end_date = datetime.utcnow()
            closed_active_sprint_id = active_sprint.id

        open_sprint_tasks = db.query(Task).filter(
            Task.project_id == project_id,
            Task.sprint_id.isnot(None),
            Task.status != TaskStatus.DONE,
        ).all()

        for task in open_sprint_tasks:
            task.sprint_id = None
            moved_to_flow_count += 1

    project.methodology = target_methodology
    old_workflow_config = project.workflow_config
    project.workflow_config = json.dumps(_workflow_config_for_methodology(target_methodology))

    audit_metadata = {
        "strategy": data.strategy,
        "recommended_strategy": preview["recommended_strategy"],
        "moved_to_flow_count": moved_to_flow_count,
        "closed_active_sprint_id": closed_active_sprint_id,
        "affected_counts": preview["affected_counts"],
        "warnings": preview["warnings"],
        "actions": preview["actions"],
        "workflow_reset": True,
    }

    db.add(
        ProjectAuditLog(
            project_id=project.id,
            actor_id=current_user.id,
            action="PROJECT_METHODOLOGY_CHANGED",
            field="methodology",
            old_value=old_methodology,
            new_value=target_methodology,
            metadata_json=json.dumps(audit_metadata),
        )
    )
    db.add(
        ProjectAuditLog(
            project_id=project.id,
            actor_id=current_user.id,
            action="PROJECT_WORKFLOW_UPDATED",
            field="workflow_config",
            old_value=old_workflow_config,
            new_value=project.workflow_config,
            metadata_json=json.dumps({
                "reason": "methodology_transition",
                "target_methodology": target_methodology,
            }),
        )
    )

    db.commit()
    db.refresh(project)
    broadcast_project_event(
        project.id,
        "project.changed",
        {
            "action": "methodology_changed",
            "project": _serialize_project(project),
            "old_methodology": old_methodology,
            "new_methodology": target_methodology,
        },
    )

    return {
        "project": _serialize_project(project),
        "transition": _build_methodology_transition_preview(db, project, target_methodology),
        "message": f"Methodology changed from {old_methodology} to {target_methodology}.",
    }


@router.get("/{project_id}/audit-logs")
def get_project_audit_logs(
    project_id: int,
    limit: int = Query(default=40, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    logs = (
        db.query(ProjectAuditLog)
        .filter(ProjectAuditLog.project_id == project_id)
        .order_by(ProjectAuditLog.created_at.desc(), ProjectAuditLog.id.desc())
        .limit(limit)
        .all()
    )

    return [_serialize_project_audit_log(log) for log in logs]


def _pdf_safe(value) -> str:
    if value is None:
        return "-"

    text = str(value)
    replacements = {
        "ă": "a",
        "â": "a",
        "î": "i",
        "ș": "s",
        "ş": "s",
        "ț": "t",
        "ţ": "t",
        "Ă": "A",
        "Â": "A",
        "Î": "I",
        "Ș": "S",
        "Ş": "S",
        "Ț": "T",
        "Ţ": "T",
        "–": "-",
        "—": "-",
        "“": '"',
        "”": '"',
        "„": '"',
        "’": "'",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text.encode("latin-1", "replace").decode("latin-1")


def _pdf_date(value) -> str:
    if not value:
        return "-"

    try:
        return value.strftime("%Y-%m-%d")
    except AttributeError:
        return str(value)


@router.get("/{project_id}/reports/status.pdf")
def export_project_status_pdf(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from io import BytesIO

    from fastapi.responses import StreamingResponse
    from fpdf import FPDF

    require_project_permission(db, current_user.id, project_id, "REPORT_VIEW")

    report = _build_reports_overview(db, project_id)
    project = report.get("project") or {}
    summary = report.get("summary") or {}
    velocity = report.get("velocity") or []
    active_sprint = report.get("active_sprint")
    status_distribution = report.get("status_distribution") or []
    priority_distribution = report.get("priority_distribution") or []
    status_age = report.get("status_age") or []
    wip_limits = report.get("wip_limits") or []
    bottleneck = report.get("bottleneck")

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_fill_color(15, 23, 42)
    pdf.rect(0, 0, 210, 28, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_xy(12, 9)
    pdf.cell(0, 8, _pdf_safe("SDLC Hub - Project Status Report"), ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(203, 213, 225)
    pdf.set_x(12)
    pdf.cell(0, 6, _pdf_safe(f"Project: {project.get('name', 'Unknown')} ({project.get('key', '-')})"), ln=True)

    pdf.ln(10)

    # Project overview
    pdf.set_text_color(15, 23, 42)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 8, _pdf_safe("1. Executive summary"), ln=True)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(51, 65, 85)
    pdf.multi_cell(
        0,
        6,
        _pdf_safe(
            "This report summarizes project delivery health using current tasks, story points, "
            "sprint information and audit-log based flow signals."
        ),
    )
    pdf.ln(2)

    def metric_row(label: str, value) -> None:
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(70, 7, _pdf_safe(label), border=1)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.cell(0, 7, _pdf_safe(value), border=1, ln=True)

    metric_row("Total tasks", summary.get("total_tasks", 0))
    metric_row("Active tasks", summary.get("active_tasks", 0))
    metric_row("Done tasks", summary.get("done_tasks", 0))
    metric_row("Completion rate", f"{summary.get('completion_rate', 0)}%")
    metric_row(
        "Story points",
        f"{summary.get('completed_story_points', 0)}/{summary.get('total_story_points', 0)} completed",
    )
    metric_row("Story point completion", f"{summary.get('story_point_completion_rate', 0)}%")
    metric_row("Average cycle time", f"{summary.get('average_cycle_time_days', 0)} days")
    metric_row("Flow/Kanban lead time", f"{summary.get('average_flow_lead_time_days', 0)} days")
    metric_row("WIP limit violations", summary.get("wip_limit_violations", 0))
    metric_row("Overdue tasks", summary.get("overdue_tasks", 0))
    metric_row("Due soon tasks", summary.get("due_soon_tasks", 0))
    metric_row("Closed sprints", summary.get("closed_sprints", 0))

    # Active sprint
    pdf.ln(7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, _pdf_safe("2. Sprint / flow status"), ln=True)

    if active_sprint:
        pdf.set_font("Helvetica", "", 10)
        metric_row("Active sprint", active_sprint.get("name", "-"))
        metric_row("Sprint goal", active_sprint.get("goal") or "-")
        metric_row("Sprint dates", f"{_pdf_date(active_sprint.get('start_date'))} - {_pdf_date(active_sprint.get('end_date'))}")
        metric_row(
            "Sprint points",
            f"{active_sprint.get('done_points', 0)}/{active_sprint.get('total_points', 0)} done",
        )
        metric_row(
            "Sprint tasks",
            f"{active_sprint.get('done_tasks', 0)}/{active_sprint.get('total_tasks', 0)} done",
        )
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(0, 6, _pdf_safe("No active sprint was found. For Kanban projects, use the flow metrics below."))

    # Velocity
    pdf.ln(7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, _pdf_safe("3. Velocity"), ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(60, 7, _pdf_safe("Sprint"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Done pts"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Planned pts"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Done tasks"), border=1, fill=True)
    pdf.cell(25, 7, _pdf_safe("Tasks"), border=1, ln=True, fill=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)

    if velocity:
        for item in velocity:
            pdf.cell(60, 7, _pdf_safe(item.get("name", "-"))[:32], border=1)
            pdf.cell(35, 7, _pdf_safe(item.get("done_points", 0)), border=1)
            pdf.cell(35, 7, _pdf_safe(item.get("total_points", 0)), border=1)
            pdf.cell(35, 7, _pdf_safe(item.get("done_tasks", 0)), border=1)
            pdf.cell(25, 7, _pdf_safe(item.get("total_tasks", 0)), border=1, ln=True)
    else:
        pdf.cell(190, 7, _pdf_safe("No closed sprint data available yet."), border=1, ln=True)

    # Distributions
    pdf.ln(7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, _pdf_safe("4. Distribution"), ln=True)

    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(95, 7, _pdf_safe("Status distribution"), border=1)
    pdf.cell(95, 7, _pdf_safe("Priority distribution"), border=1, ln=True)

    max_rows = max(len(status_distribution), len(priority_distribution))
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)

    for index in range(max_rows):
        status_item = status_distribution[index] if index < len(status_distribution) else {"name": "", "value": ""}
        priority_item = priority_distribution[index] if index < len(priority_distribution) else {"name": "", "value": ""}

        pdf.cell(
            95,
            7,
            _pdf_safe(f"{status_item.get('name', '')}: {status_item.get('value', '')}"),
            border=1,
        )
        pdf.cell(
            95,
            7,
            _pdf_safe(f"{priority_item.get('name', '')}: {priority_item.get('value', '')}"),
            border=1,
            ln=True,
        )

    # Bottleneck
    pdf.ln(7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, _pdf_safe("5. Bottleneck analysis"), ln=True)

    if bottleneck and bottleneck.get("tasks", 0) > 0:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(
            0,
            6,
            _pdf_safe(
                f"Highest average age appears in {bottleneck.get('status')} with "
                f"{bottleneck.get('average_age_days')} days average age across "
                f"{bottleneck.get('tasks')} active tasks."
            ),
        )
    else:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(0, 6, _pdf_safe("No bottleneck signal was detected from the current active tasks."))

    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(55, 7, _pdf_safe("Status"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Tasks"), border=1, fill=True)
    pdf.cell(50, 7, _pdf_safe("Avg age days"), border=1, fill=True)
    pdf.cell(50, 7, _pdf_safe("Max age days"), border=1, ln=True, fill=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)
    for item in status_age:
        pdf.cell(55, 7, _pdf_safe(item.get("status", "-")), border=1)
        pdf.cell(35, 7, _pdf_safe(item.get("tasks", 0)), border=1)
        pdf.cell(50, 7, _pdf_safe(item.get("average_age_days", 0)), border=1)
        pdf.cell(50, 7, _pdf_safe(item.get("max_age_days", 0)), border=1, ln=True)

    # WIP limits
    pdf.ln(7)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(0, 8, _pdf_safe("6. WIP limits"), ln=True)

    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(226, 232, 240)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(55, 7, _pdf_safe("Status"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Current"), border=1, fill=True)
    pdf.cell(35, 7, _pdf_safe("Limit"), border=1, fill=True)
    pdf.cell(65, 7, _pdf_safe("Health"), border=1, ln=True, fill=True)

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)
    for item in wip_limits:
        limit = item.get("limit")
        health = "Over limit" if item.get("exceeded") else "OK"
        if limit is None:
            health = "No limit configured"
        pdf.cell(55, 7, _pdf_safe(item.get("label") or item.get("status", "-"))[:30], border=1)
        pdf.cell(35, 7, _pdf_safe(item.get("current", 0)), border=1)
        pdf.cell(35, 7, _pdf_safe(limit if limit is not None else "-"), border=1)
        pdf.cell(65, 7, _pdf_safe(health), border=1, ln=True)

    # Footer
    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(100, 116, 139)
    pdf.multi_cell(
        0,
        5,
        _pdf_safe(
            "Generated by SDLC Hub. Metrics are calculated from project tasks, sprints and audit logs. "
            "Cycle time and bottleneck age are approximate when historical audit data is incomplete."
        ),
    )

    output = pdf.output(dest="S")
    if isinstance(output, str):
        pdf_bytes = output.encode("latin-1")
    else:
        pdf_bytes = bytes(output)

    filename = f"{project.get('key', 'project')}-status-report.pdf".replace(" ", "-")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )



@router.get("/{project_id}")
def get_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    return _serialize_project(project)


@router.put("/{project_id}")
def update_project_settings(
    project_id: int,
    data: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    require_project_permission(db, current_user.id, project_id, "PROJECT_UPDATE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    update_data = data.model_dump(exclude_unset=True)
    audit_entries = []

    if "name" in update_data and update_data["name"] is not None:
        next_name = update_data["name"].strip()
        if next_name != project.name:
            audit_entries.append(
                ProjectAuditLog(
                    project_id=project.id,
                    actor_id=current_user.id,
                    action="PROJECT_SETTINGS_UPDATED",
                    field="name",
                    old_value=project.name,
                    new_value=next_name,
                )
            )
            project.name = next_name

    if "description" in update_data:
        next_description = update_data["description"]
        if (next_description or "") != (project.description or ""):
            audit_entries.append(
                ProjectAuditLog(
                    project_id=project.id,
                    actor_id=current_user.id,
                    action="PROJECT_SETTINGS_UPDATED",
                    field="description",
                    old_value=project.description,
                    new_value=next_description,
                )
            )
            project.description = next_description

    if "methodology" in update_data and update_data["methodology"] is not None:
        methodology = _normalize_methodology(update_data["methodology"])
        if methodology != project.methodology:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Use the methodology transition endpoint to change workflow mode.",
            )

    if audit_entries:
        db.add_all(audit_entries)

    db.commit()
    db.refresh(project)
    serialized_project = _serialize_project(project)
    broadcast_project_event(
        project.id,
        "project.changed",
        {"action": "settings_updated", "project": serialized_project},
    )

    return serialized_project


def _require_project_owner(project: Project, current_user: User) -> None:
    if project.owner_id == current_user.id or current_user.is_global_admin:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the project owner can manage project AI credentials.",
    )


def _serialize_project_ai_settings(project: Project) -> dict:
    return {
        "mode": project.ai_provider_mode or "PLATFORM",
        "provider": project.ai_provider or "GEMINI",
        "provider_name": project.ai_provider_name or project.ai_provider or "Gemini",
        "base_url": project.ai_base_url,
        "model": project.ai_model,
        "has_project_key": bool(project.ai_api_key_encrypted),
        "platform_configured": bool(get_settings().gemini_api_key),
    }


@router.get("/{project_id}/ai-settings")
def get_project_ai_settings(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    _require_project_owner(project, current_user)
    return _serialize_project_ai_settings(project)


@router.put("/{project_id}/ai-settings")
def update_project_ai_settings(
    project_id: int,
    data: ProjectAiSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    _require_project_owner(project, current_user)

    mode = data.mode.upper()
    provider = data.provider.upper()
    if mode not in {"PLATFORM", "PROJECT"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid AI mode.")
    if provider not in {"GEMINI", "OPENAI_COMPATIBLE"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid AI provider type.")

    provider_name = (data.provider_name or provider.replace("_", " ").title()).strip()
    if len(provider_name) > 80:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider name is too long.")

    base_url = data.base_url.strip() if data.base_url else None
    model = data.model.strip() if data.model else None

    if mode == "PROJECT" and provider == "OPENAI_COMPATIBLE":
        if not base_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OpenAI-compatible providers require a base URL.",
            )
        if not model:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OpenAI-compatible providers require a model name.",
            )

    if data.clear_api_key:
        project.ai_api_key_encrypted = None

    if data.api_key and data.api_key.strip():
        project.ai_api_key_encrypted = encrypt_secret(data.api_key.strip())

    if mode == "PROJECT" and not project.ai_api_key_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add a project API key before switching to project-owned AI.",
        )

    project.ai_provider_mode = mode
    project.ai_provider = provider
    project.ai_provider_name = provider_name
    project.ai_base_url = base_url if provider == "OPENAI_COMPATIBLE" else None
    project.ai_model = model

    db.add(
        ProjectAuditLog(
            project_id=project.id,
            actor_id=current_user.id,
            action="AI_SETTINGS_UPDATED",
            field="ai_provider_mode",
            old_value=None,
            new_value=f"{mode}:{provider}:{provider_name}",
        )
    )
    db.commit()
    db.refresh(project)

    serialized_project = _serialize_project(project)
    broadcast_project_event(
        project.id,
        "project.changed",
        {"action": "ai_settings_updated", "project": serialized_project},
    )

    return _serialize_project_ai_settings(project)


@router.post("/{project_id}/ai-settings/test")
def test_project_ai_settings(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    _require_project_owner(project, current_user)

    if (project.ai_provider_mode or "PLATFORM") == "PLATFORM":
        configured = bool(get_settings().gemini_api_key)
        return {
            "ok": configured,
            "message": "Platform AI key is configured." if configured else "Platform AI key is not configured.",
        }

    api_key = decrypt_secret(project.ai_api_key_encrypted)
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project AI key is missing or cannot be decrypted.",
        )

    try:
        ok = test_ai_provider(
            provider=project.ai_provider or "GEMINI",
            api_key=api_key,
            base_url=project.ai_base_url,
            model=project.ai_model,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"AI provider test failed: {exc}",
        ) from exc

    return {
        "ok": ok,
        "message": "Project AI provider is valid." if ok else "Project AI provider did not return the expected response.",
    }


@router.put("/{project_id}/workflow")
def update_project_workflow(
    project_id: int,
    data: WorkflowConfigUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    old_config = project.workflow_config
    config = _parse_workflow_config(project.workflow_config)

    if data.wip_limits is not None:
        next_limits = config.get("wip_limits", {}).copy()
        for status_key, value in data.wip_limits.items():
            normalized_status = status_key.upper()
            if normalized_status not in DEFAULT_WORKFLOW_CONFIG["wip_limits"]:
                continue

            if value is None:
                next_limits[normalized_status] = None
            else:
                next_limits[normalized_status] = max(0, int(value))

        config["wip_limits"] = next_limits

    if data.columns is not None:
        allowed_statuses = set(DEFAULT_WORKFLOW_CONFIG["wip_limits"].keys())
        default_columns = {
            column["key"]: column.copy()
            for column in DEFAULT_WORKFLOW_CONFIG["columns"]
        }
        next_columns = {
            column["key"]: column.copy()
            for column in config.get("columns", DEFAULT_WORKFLOW_CONFIG["columns"])
            if column.get("key") in allowed_statuses
        }

        for raw_column in data.columns:
            status_key = raw_column.key.upper()
            if status_key not in allowed_statuses:
                continue

            base_column = next_columns.get(status_key) or default_columns[status_key].copy()
            if raw_column.label is not None:
                label = raw_column.label.strip()
                base_column["label"] = label[:40] or default_columns[status_key]["label"]
            if raw_column.enabled is not None:
                base_column["enabled"] = bool(raw_column.enabled)
            if raw_column.order is not None:
                base_column["order"] = int(raw_column.order)
            if raw_column.color is not None:
                base_column["color"] = raw_column.color[:80] or default_columns[status_key]["color"]

            next_columns[status_key] = base_column

        config["columns"] = sorted(next_columns.values(), key=lambda column: (column["order"], column["key"]))

    project.workflow_config = json.dumps(config)

    db.add(
        ProjectAuditLog(
            project_id=project.id,
            actor_id=current_user.id,
            action="PROJECT_WORKFLOW_UPDATED",
            field="workflow_config",
            old_value=old_config,
            new_value=project.workflow_config,
        )
    )
    db.commit()
    db.refresh(project)

    serialized_project = _serialize_project(project)
    broadcast_project_event(
        project.id,
        "project.changed",
        {"action": "workflow_updated", "project": serialized_project},
    )
    return serialized_project


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    data: ProjectDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "PROJECT_DELETE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if data.confirmation_key.strip().upper() != project.key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation key does not match project key.",
        )

    task_ids = [task.id for task in db.query(Task).filter(Task.project_id == project_id).all()]

    if task_ids:
        db.query(TaskAuditLog).filter(TaskAuditLog.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(TaskComment).filter(TaskComment.task_id.in_(task_ids)).delete(synchronize_session=False)
        db.query(Subtask).filter(Subtask.task_id.in_(task_ids)).delete(synchronize_session=False)

    db.query(Task).filter(Task.project_id == project_id).delete(synchronize_session=False)
    db.query(Sprint).filter(Sprint.project_id == project_id).delete(synchronize_session=False)
    db.query(Invitation).filter(Invitation.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectMember).filter(ProjectMember.project_id == project_id).delete(synchronize_session=False)
    db.query(ProjectTeam).filter(ProjectTeam.project_id == project_id).delete(synchronize_session=False)
    db.query(Role).filter(Role.project_id == project_id).delete(synchronize_session=False)
    db.delete(project)

    db.commit()

    return {"message": "Project deleted successfully."}


@router.get("/{project_id}/roles")
def get_project_roles(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_project_member(project_id, current_user.id, db)
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    roles = db.query(Role).filter(Role.project_id == project_id).order_by(Role.id.asc()).all()
    return [_serialize_role(role, project) for role in roles]


@router.put("/{project_id}/roles/{role_id}/permissions")
def update_role_permissions(
    project_id: int,
    role_id: int,
    data: UpdateRolePermissionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "ROLE_MANAGE")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    role = db.query(Role).filter(
        Role.id == role_id,
        Role.project_id == project_id,
    ).first()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.name == "Project Admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project Admin permissions cannot be edited.",
        )

    role.permissions = json.dumps(
        _normalize_permissions_for_methodology(project.methodology, data.permissions)
    )

    db.commit()
    db.refresh(role)

    return _serialize_role(role, project)


@router.get("/{project_id}/invitations")
def get_project_invitations(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "MEMBER_INVITE")

    invites = db.query(Invitation).filter(
        Invitation.project_id == project_id,
    ).order_by(Invitation.created_at.desc()).all()

    return [_serialize_project_invitation(invite) for invite in invites]


@router.post("/{project_id}/invitations")
def invite_project_member(
    project_id: int,
    data: InviteMemberRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "MEMBER_INVITE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    role = db.query(Role).filter(
        Role.id == data.role_id,
        Role.project_id == project_id,
    ).first()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.name == "Project Admin":
        require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    email_value = str(data.email).strip().lower()

    existing_user = db.query(User).filter(User.email == email_value).first()
    if existing_user:
        existing_member = db.query(ProjectMember).filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == existing_user.id,
        ).first()
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This user is already a member of the project.",
            )

    existing_invite = db.query(Invitation).filter(
        Invitation.project_id == project_id,
        Invitation.email == email_value,
        Invitation.status == "PENDING",
    ).first()

    if existing_invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email already has a pending invitation.",
        )

    secure_code = secrets.token_hex(4).upper()
    final_code = f"{project.key}-{secure_code}"

    invite = Invitation(
        email=email_value,
        project_id=project.id,
        role_id=role.id,
        code=final_code,
        status="PENDING",
    )

    db.add(invite)
    db.commit()
    db.refresh(invite)

    background_tasks.add_task(
        send_project_invitation_email,
        email=email_value,
        project_name=project.name,
        role_name=role.name,
        code=final_code,
    )

    return _serialize_project_invitation(invite)


@router.post("/{project_id}/invitations/{invitation_id}/resend")
def resend_project_invitation(
    project_id: int,
    invitation_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "MEMBER_INVITE")

    invite = db.query(Invitation).filter(
        Invitation.id == invitation_id,
        Invitation.project_id == project_id,
    ).first()

    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if invite.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending invitations can be resent.")

    background_tasks.add_task(
        send_project_invitation_email,
        email=invite.email,
        project_name=invite.project.name if invite.project else "Project",
        role_name=invite.role.name if invite.role else "Member",
        code=invite.code,
    )

    return {"message": "Invitation resent."}


@router.delete("/{project_id}/invitations/{invitation_id}")
def cancel_project_invitation(
    project_id: int,
    invitation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "ROLE_MANAGE")

    invite = db.query(Invitation).filter(
        Invitation.id == invitation_id,
        Invitation.project_id == project_id,
    ).first()

    if not invite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")

    if invite.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only pending invitations can be cancelled.")

    db.delete(invite)
    db.commit()

    return {"message": "Invitation cancelled."}


@router.put("/{project_id}/members/{membership_id}/role")
def update_project_member_role(
    project_id: int,
    membership_id: int,
    data: UpdateMemberRoleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "MEMBER_REMOVE")

    membership = db.query(ProjectMember).filter(
        ProjectMember.id == membership_id,
        ProjectMember.project_id == project_id,
    ).first()

    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    project = db.query(Project).filter(Project.id == project_id).first()
    if project and membership.user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project owner role cannot be changed from here.",
        )

    role = db.query(Role).filter(
        Role.id == data.role_id,
        Role.project_id == project_id,
    ).first()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.name == "Project Admin":
        require_project_permission(db, current_user.id, project_id, "SETTINGS_MANAGE")

    membership.role_id = role.id

    db.commit()
    db.refresh(membership)

    return serialize_member(membership)


@router.delete("/{project_id}/members/{membership_id}")
def remove_project_member(
    project_id: int,
    membership_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "MEMBER_REMOVE")

    membership = db.query(ProjectMember).filter(
        ProjectMember.id == membership_id,
        ProjectMember.project_id == project_id,
    ).first()

    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found.")

    project = db.query(Project).filter(Project.id == project_id).first()
    if project and membership.user_id == project.owner_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project owner cannot be removed.",
        )

    db.delete(membership)
    db.commit()

    return {"message": "Member removed."}



# --- BATCH 6B ROLE CRUD ---

from pydantic import Field as _RoleField


try:
    ROLE_MANAGEMENT_ROLES
except NameError:
    ROLE_MANAGEMENT_ROLES = ["Project Admin"]


class ProjectRoleCreateRequest(BaseModel):
    name: str = _RoleField(min_length=1, max_length=80)
    description: str | None = None
    permissions: dict[str, bool] | None = None


class ProjectRoleUpdateRequest(BaseModel):
    name: str | None = _RoleField(default=None, min_length=1, max_length=80)
    description: str | None = None
    permissions: dict[str, bool] | None = None


@router.post("/{project_id}/roles")
def create_project_role(
    project_id: int,
    data: ProjectRoleCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "ROLE_MANAGE")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    role_name = data.name.strip()
    existing_role = db.query(Role).filter(
        Role.project_id == project_id,
        Role.name.ilike(role_name),
    ).first()

    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A role with this name already exists.",
        )

    role = Role(
        project_id=project_id,
        name=role_name,
        description=data.description,
        permissions=json.dumps(
            _normalize_permissions_for_methodology(
                project.methodology,
                data.permissions or DEFAULT_ROLE_PERMISSIONS,
            )
        ),
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    return _serialize_role(role, project)


@router.put("/{project_id}/roles/{role_id}")
def update_project_role(
    project_id: int,
    role_id: int,
    data: ProjectRoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "ROLE_MANAGE")
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    role = db.query(Role).filter(
        Role.id == role_id,
        Role.project_id == project_id,
    ).first()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.name == "Project Admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project Admin role cannot be edited.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        role_name = update_data["name"].strip()

        duplicate = db.query(Role).filter(
            Role.project_id == project_id,
            Role.id != role_id,
            Role.name.ilike(role_name),
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A role with this name already exists.",
            )

        role.name = role_name

    if "description" in update_data:
        role.description = update_data["description"]

    if "permissions" in update_data and update_data["permissions"] is not None:
        role.permissions = json.dumps(
            _normalize_permissions_for_methodology(
                project.methodology,
                update_data["permissions"],
            )
        )

    db.commit()
    db.refresh(role)

    return _serialize_role(role, project)


@router.delete("/{project_id}/roles/{role_id}")
def delete_project_role(
    project_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "ROLE_MANAGE")

    role = db.query(Role).filter(
        Role.id == role_id,
        Role.project_id == project_id,
    ).first()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found.")

    if role.name == "Project Admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project Admin role cannot be deleted.",
        )

    member_count = db.query(ProjectMember).filter(ProjectMember.role_id == role_id).count()
    if member_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a role that is assigned to members. Move members to another role first.",
        )

    pending_invite_count = db.query(Invitation).filter(
        Invitation.role_id == role_id,
        Invitation.status == "PENDING",
    ).count()

    if pending_invite_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a role with pending invitations. Cancel those invitations first.",
        )

    db.delete(role)
    db.commit()

    return {"message": "Role deleted successfully."}


# --- BATCH 7 PROJECT SELECTOR REAL DASHBOARD ---

def _dashboard_enum_value(value):
    if value is None:
        return None
    if hasattr(value, "value"):
        return value.value
    return str(value)


def _serialize_dashboard_task(task: Task) -> dict:
    return {
        "id": task.id,
        "key": task.key,
        "title": task.title,
        "status": _dashboard_enum_value(task.status),
        "priority": _dashboard_enum_value(task.priority),
        "story_points": task.story_points,
        "due_date": task.due_date,
        "assignee_id": task.assignee_id,
        "assignee_name": task.assignee_name,
        "project_id": task.project_id,
        "sprint_id": task.sprint_id,
        "created_at": task.created_at,
    }


@router.get("/{project_id}/dashboard/summary")
def get_project_dashboard_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.id.desc()).all()
    members_count = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).count()
    pending_invites_count = db.query(Invitation).filter(
        Invitation.project_id == project_id,
        Invitation.status == "PENDING",
    ).count()

    statuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"]
    priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    tasks_by_status = {key: 0 for key in statuses}
    tasks_by_priority = {key: 0 for key in priorities}

    total_story_points = 0
    done_story_points = 0
    backlog_count = 0

    for task in tasks:
        task_status = _dashboard_enum_value(task.status)
        task_priority = _dashboard_enum_value(task.priority)

        if task_status in tasks_by_status:
            tasks_by_status[task_status] += 1

        if task_priority in tasks_by_priority:
            tasks_by_priority[task_priority] += 1

        if task.story_points:
            total_story_points += task.story_points
            if task_status == "DONE":
                done_story_points += task.story_points

        if task.sprint_id is None:
            backlog_count += 1

    my_active_tasks = [
        task for task in tasks
        if task.assignee_id == current_user.id and _dashboard_enum_value(task.status) != "DONE"
    ][:6]

    active_sprint = db.query(Sprint).filter(
        Sprint.project_id == project_id,
        Sprint.is_active == True,  # noqa: E712
    ).first()

    active_sprint_payload = None
    if active_sprint:
        sprint_tasks = [task for task in tasks if task.sprint_id == active_sprint.id]
        sprint_done_tasks = [
            task for task in sprint_tasks
            if _dashboard_enum_value(task.status) == "DONE"
        ]

        sprint_total_points = sum(task.story_points or 0 for task in sprint_tasks)
        sprint_done_points = sum(task.story_points or 0 for task in sprint_done_tasks)

        active_sprint_payload = {
            "id": active_sprint.id,
            "name": active_sprint.name,
            "goal": active_sprint.goal,
            "start_date": active_sprint.start_date,
            "end_date": active_sprint.end_date,
            "tasks_total": len(sprint_tasks),
            "tasks_done": len(sprint_done_tasks),
            "story_points_total": sprint_total_points,
            "story_points_done": sprint_done_points,
            "progress_percent": round((len(sprint_done_tasks) / len(sprint_tasks)) * 100) if sprint_tasks else 0,
        }

    return {
        "project": _serialize_project(project),
        "members_count": members_count,
        "pending_invites_count": pending_invites_count,
        "tasks_total": len(tasks),
        "tasks_by_status": tasks_by_status,
        "tasks_by_priority": tasks_by_priority,
        "backlog_count": backlog_count,
        "my_active_tasks_count": len(my_active_tasks),
        "my_tasks": [_serialize_dashboard_task(task) for task in my_active_tasks],
        "done_tasks_count": tasks_by_status["DONE"],
        "total_story_points": total_story_points,
        "done_story_points": done_story_points,
        "active_sprint": active_sprint_payload,
    }


@router.get("/{project_id}/dashboard/activity")
def get_project_dashboard_activity(
    project_id: int,
    limit: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    rows = (
        db.query(TaskAuditLog, Task)
        .join(Task, TaskAuditLog.task_id == Task.id)
        .filter(Task.project_id == project_id)
        .order_by(TaskAuditLog.created_at.desc())
        .limit(min(max(limit, 1), 30))
        .all()
    )

    return [
        {
            "id": log.id,
            "task_id": task.id,
            "task_key": task.key,
            "task_title": task.title,
            "actor_id": log.actor_id,
            "actor_name": log.actor_name or "System",
            "action": log.action,
            "field": log.field,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "created_at": log.created_at,
        }
        for log, task in rows
    ]



# --- BATCH 7 REAL DASHBOARD ---

def _enum_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _task_summary(task: Task) -> dict:
    return {
        "id": task.id,
        "key": task.key,
        "title": task.title,
        "status": _enum_value(task.status),
        "priority": _enum_value(task.priority),
        "story_points": task.story_points,
        "due_date": task.due_date,
        "assignee_id": task.assignee_id,
        "assignee_name": task.assignee_name,
        "sprint_id": task.sprint_id,
        "created_at": task.created_at,
    }


RISK_COMMENT_KEYWORDS = (
    "blocked",
    "blocker",
    "blocking",
    "stuck",
    "cannot",
    "can't",
    "issue",
    "problem",
    "fails",
    "failing",
    "broken",
    "urgent",
    "dependency",
    "waiting",
    "blocaj",
    "blocat",
    "blocata",
    "nu merge",
    "eroare",
    "urgent",
    "astept",
)


def _dashboard_plain_datetime(value):
    if not value:
        return None
    return value.replace(tzinfo=None) if getattr(value, "tzinfo", None) else value


def _dashboard_age_days(start, end) -> int:
    start_value = _dashboard_plain_datetime(start)
    end_value = _dashboard_plain_datetime(end)
    if not start_value or not end_value:
        return 0
    return max(0, int((end_value - start_value).total_seconds() // 86400))


def _dashboard_task_label(task: Task) -> str:
    return f"{task.key or f'TASK-{task.id}'}"


def _dashboard_risk_card(
    *,
    title: str,
    value: str,
    severity: str,
    detail: str,
    category: str,
    task: Task | None = None,
    age_days: int | None = None,
) -> dict:
    payload = {
        "title": title,
        "value": value,
        "severity": severity,
        "detail": detail,
        "category": category,
    }
    if task:
        payload.update(
            {
                "task_id": task.id,
                "task_key": task.key,
                "task_title": task.title,
                "status": _enum_value(task.status),
                "priority": _enum_value(task.priority),
                "assignee_name": task.assignee_name,
            }
        )
    if age_days is not None:
        payload["age_days"] = age_days
    return payload


def _build_dashboard_risk_cards(
    *,
    project: Project,
    tasks: list[Task],
    active_sprint: Sprint | None,
    now: datetime,
    status_changed_at_by_task: dict[int, datetime],
    latest_comments_by_task: dict[int, TaskComment],
    overdue_tasks: int,
    unassigned_tasks: int,
    critical_open: int,
    review_tasks: int,
) -> list[dict]:
    cards: list[dict] = []
    active_items = [task for task in tasks if _enum_value(task.status) != "DONE"]

    if project.methodology in {"SCRUM", "SCRUMBAN"} and not active_sprint:
        cards.append(
            _dashboard_risk_card(
                title="No active sprint",
                value="Planning",
                severity="medium",
                category="methodology",
                detail="Scrum/Scrumban flow has no active sprint, so planning and sprint reporting are incomplete.",
            )
        )

    overdue_items = sorted(
        [
            task for task in active_items
            if _dashboard_plain_datetime(task.due_date)
            and _dashboard_plain_datetime(task.due_date) < now
        ],
        key=lambda task: (
            _enum_value(task.priority) != "CRITICAL",
            _dashboard_plain_datetime(task.due_date) or datetime.max,
        ),
    )
    for task in overdue_items[:3]:
        late_days = max(1, _dashboard_age_days(task.due_date, now))
        cards.append(
            _dashboard_risk_card(
                title=f"Overdue: {_dashboard_task_label(task)}",
                value=f"{late_days}d late",
                severity="high" if _enum_value(task.priority) in {"HIGH", "CRITICAL"} else "medium",
                category="deadline",
                task=task,
                age_days=late_days,
                detail=(
                    f"{task.title} is past its due date"
                    f"{f' and assigned to {task.assignee_name}' if task.assignee_name else ' without a clear owner'}."
                ),
            )
        )

    comment_signals = []
    for task in active_items:
        comment = latest_comments_by_task.get(task.id)
        if not comment:
            continue
        body = (comment.body or "").lower()
        if any(keyword in body for keyword in RISK_COMMENT_KEYWORDS):
            comment_signals.append((task, comment))

    comment_signals.sort(
        key=lambda item: (
            _enum_value(item[0].priority) != "CRITICAL",
            _dashboard_plain_datetime(item[1].created_at) or datetime.min,
        ),
        reverse=True,
    )
    for task, comment in comment_signals[:3]:
        excerpt = " ".join((comment.body or "").split())[:120]
        cards.append(
            _dashboard_risk_card(
                title=f"Blocked signal: {_dashboard_task_label(task)}",
                value="Comment",
                severity="high" if _enum_value(task.priority) in {"HIGH", "CRITICAL"} else "medium",
                category="comment",
                task=task,
                detail=f"{comment.author_name or 'A team member'} flagged possible friction: {excerpt}",
            )
        )

    stale_review_items = []
    stale_progress_items = []
    for task in active_items:
        status_value = _enum_value(task.status)
        status_started_at = status_changed_at_by_task.get(task.id) or task.updated_at or task.created_at
        age_days = _dashboard_age_days(status_started_at, now)
        if status_value == "REVIEW" and age_days >= 2:
            stale_review_items.append((task, age_days))
        if status_value == "IN_PROGRESS" and age_days >= 4:
            stale_progress_items.append((task, age_days))

    for task, age_days in sorted(stale_review_items, key=lambda item: item[1], reverse=True)[:2]:
        cards.append(
            _dashboard_risk_card(
                title=f"Review aging: {_dashboard_task_label(task)}",
                value=f"{age_days}d",
                severity="medium" if age_days < 4 else "high",
                category="flow",
                task=task,
                age_days=age_days,
                detail=f"{task.title} has been waiting in review long enough to threaten flow.",
            )
        )

    for task, age_days in sorted(stale_progress_items, key=lambda item: item[1], reverse=True)[:2]:
        cards.append(
            _dashboard_risk_card(
                title=f"Stale progress: {_dashboard_task_label(task)}",
                value=f"{age_days}d",
                severity="medium",
                category="flow",
                task=task,
                age_days=age_days,
                detail=f"{task.title} has stayed in progress for several days. Check blockers or scope drift.",
            )
        )

    critical_unassigned = [
        task for task in active_items
        if _enum_value(task.priority) == "CRITICAL" and task.assignee_id is None
    ]
    for task in critical_unassigned[:2]:
        cards.append(
            _dashboard_risk_card(
                title=f"Critical unowned: {_dashboard_task_label(task)}",
                value="No owner",
                severity="high",
                category="ownership",
                task=task,
                detail=f"{task.title} is critical but has no assignee.",
            )
        )

    if len(overdue_items) > 3:
        cards.append(
            _dashboard_risk_card(
                title="Overdue queue",
                value=f"+{len(overdue_items) - 3}",
                severity="high",
                category="deadline",
                detail="More overdue tasks exist beyond the top signals shown here.",
            )
        )

    if not cards:
        cards.append(
            _dashboard_risk_card(
                title="No obvious risks",
                value="Healthy",
                severity="low",
                category="health",
                detail="No overdue work, stale status, blocker comments or critical ownership gaps detected.",
            )
        )

    return cards[:8]


@router.get("/{project_id}/dashboard")
def get_project_dashboard(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from backend.models.project import TaskStatus, TaskPriority

    check_project_permission(db, current_user.id, project_id)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .order_by(Task.created_at.desc())
        .all()
    )

    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    active_sprint = (
        db.query(Sprint)
        .filter(
            Sprint.project_id == project_id,
            Sprint.is_active == True,  # noqa: E712
        )
        .first()
    )

    total_tasks = len(tasks)
    completed_tasks = len([task for task in tasks if _enum_value(task.status) == "DONE"])
    active_tasks = len([task for task in tasks if _enum_value(task.status) != "DONE"])
    backlog_tasks = len([task for task in tasks if task.sprint_id is None])
    unassigned_tasks = len([
        task for task in tasks
        if _enum_value(task.status) != "DONE" and task.assignee_id is None
    ])
    now = datetime.utcnow()
    week_end = now + timedelta(days=7)

    def _due_date_without_timezone(task: Task):
        if not task.due_date:
            return None
        return task.due_date.replace(tzinfo=None) if task.due_date.tzinfo else task.due_date

    overdue_tasks = len([
        task for task in tasks
        if _enum_value(task.status) != "DONE"
        and _due_date_without_timezone(task)
        and _due_date_without_timezone(task) < now
    ])
    due_soon_tasks = len([
        task for task in tasks
        if _enum_value(task.status) != "DONE"
        and _due_date_without_timezone(task)
        and now <= _due_date_without_timezone(task) <= week_end
    ])

    completion_rate = round((completed_tasks / total_tasks) * 100) if total_tasks else 0

    status_distribution = {status_item.value: 0 for status_item in TaskStatus}
    for task in tasks:
        status_value = _enum_value(task.status)
        status_distribution[status_value] = status_distribution.get(status_value, 0) + 1

    priority_distribution = {priority_item.value: 0 for priority_item in TaskPriority}
    for task in tasks:
        priority_value = _enum_value(task.priority)
        priority_distribution[priority_value] = priority_distribution.get(priority_value, 0) + 1

    my_active_tasks = [
        _task_summary(task)
        for task in tasks
        if task.assignee_id == current_user.id and _enum_value(task.status) != "DONE"
    ][:6]

    sprint_payload = None
    if active_sprint:
        sprint_tasks = [task for task in tasks if task.sprint_id == active_sprint.id]
        sprint_done = len([task for task in sprint_tasks if _enum_value(task.status) == "DONE"])
        sprint_total = len(sprint_tasks)
        sprint_progress = round((sprint_done / sprint_total) * 100) if sprint_total else 0

        sprint_payload = {
            "id": active_sprint.id,
            "name": active_sprint.name,
            "goal": active_sprint.goal,
            "start_date": active_sprint.start_date,
            "end_date": active_sprint.end_date,
            "is_active": active_sprint.is_active,
            "total_tasks": sprint_total,
            "done_tasks": sprint_done,
            "progress_percent": sprint_progress,
        }

    task_ids = [task.id for task in tasks]
    task_lookup = {task.id: task for task in tasks}

    recent_activity = []
    status_changed_at_by_task: dict[int, datetime] = {}
    latest_comments_by_task: dict[int, TaskComment] = {}

    if task_ids:
        logs = (
            db.query(TaskAuditLog)
            .filter(TaskAuditLog.task_id.in_(task_ids))
            .order_by(TaskAuditLog.created_at.desc())
            .limit(12)
            .all()
        )

        for log in logs:
            related_task = task_lookup.get(log.task_id)
            recent_activity.append({
                "id": log.id,
                "task_id": log.task_id,
                "task_key": related_task.key if related_task else None,
                "task_title": related_task.title if related_task else None,
                "actor_name": log.actor_name,
                "action": log.action,
                "field": log.field,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "created_at": log.created_at,
            })

        status_logs = (
            db.query(TaskAuditLog)
            .filter(
                TaskAuditLog.task_id.in_(task_ids),
                TaskAuditLog.action == "TASK_UPDATED",
                TaskAuditLog.field == "status",
            )
            .order_by(TaskAuditLog.created_at.desc())
            .all()
        )
        for log in status_logs:
            if log.task_id not in status_changed_at_by_task:
                status_changed_at_by_task[log.task_id] = log.created_at

        comments = (
            db.query(TaskComment)
            .filter(TaskComment.task_id.in_(task_ids))
            .order_by(TaskComment.created_at.desc())
            .all()
        )
        for comment in comments:
            if comment.task_id not in latest_comments_by_task:
                latest_comments_by_task[comment.task_id] = comment

    critical_open = len([
        task for task in tasks
        if _enum_value(task.priority) == "CRITICAL" and _enum_value(task.status) != "DONE"
    ])

    review_tasks = len([
        task for task in tasks
        if _enum_value(task.status) == "REVIEW"
    ])

    risk_cards = _build_dashboard_risk_cards(
        project=project,
        tasks=tasks,
        active_sprint=active_sprint,
        now=now,
        status_changed_at_by_task=status_changed_at_by_task,
        latest_comments_by_task=latest_comments_by_task,
        overdue_tasks=overdue_tasks,
        unassigned_tasks=unassigned_tasks,
        critical_open=critical_open,
        review_tasks=review_tasks,
    )

    unassigned_penalty = min(35, round((unassigned_tasks / active_tasks) * 35)) if active_tasks else 0
    critical_penalty = min(25, critical_open * 5)
    review_penalty = min(20, review_tasks * 3)
    overdue_penalty = min(25, overdue_tasks * 6)
    blocker_penalty = min(20, len([card for card in risk_cards if card.get("category") == "comment"]) * 8)
    stale_penalty = min(20, len([card for card in risk_cards if card.get("category") == "flow"]) * 5)
    team_health_score = max(
        0,
        100 - unassigned_penalty - critical_penalty - review_penalty - overdue_penalty - blocker_penalty - stale_penalty,
    )

    total_story_points = sum(task.story_points or 0 for task in tasks)
    completed_story_points = sum(
        task.story_points or 0
        for task in tasks
        if _enum_value(task.status) == "DONE"
    )

    return {
        "project": _serialize_project(project),
        "metrics": {
            "total_tasks": total_tasks,
            "active_tasks": active_tasks,
            "completed_tasks": completed_tasks,
            "backlog_tasks": backlog_tasks,
            "unassigned_tasks": unassigned_tasks,
            "due_soon_tasks": due_soon_tasks,
            "overdue_tasks": overdue_tasks,
            "critical_open_tasks": critical_open,
            "review_tasks": review_tasks,
            "completion_rate": completion_rate,
            "team_members_count": len(members),
            "team_health_score": team_health_score,
            "total_story_points": total_story_points,
            "completed_story_points": completed_story_points,
        },
        "active_sprint": sprint_payload,
        "my_active_tasks": my_active_tasks,
        "status_distribution": status_distribution,
        "priority_distribution": priority_distribution,
        "recent_activity": recent_activity,
        "risk_cards": risk_cards,
    }





# --- PRIORITY 4 REPORTING V1 ---

def _report_enum_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _report_plain_date(value):
    if not value:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


def _report_days_between(start, end) -> float:
    start_value = _report_plain_date(start)
    end_value = _report_plain_date(end)

    if not start_value or not end_value:
        return 0.0

    seconds = max(0.0, (end_value - start_value).total_seconds())
    return round(seconds / 86400, 2)


def _report_chart_item(name: str, value: int) -> dict:
    return {"name": name, "value": value}


def _report_average(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0


def _build_reports_overview(db: Session, project_id: int) -> dict:
    now = datetime.utcnow()
    week_end = now + timedelta(days=7)

    project = db.query(Project).filter(Project.id == project_id).first()
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    sprints = (
        db.query(Sprint)
        .filter(Sprint.project_id == project_id)
        .order_by(Sprint.end_date.asc().nullslast(), Sprint.id.asc())
        .all()
    )

    task_ids = [task.id for task in tasks]

    status_order = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"]
    priority_order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    workflow_config = _parse_workflow_config(project.workflow_config if project else None)
    workflow_columns = {
        str(column.get("key", "")).upper(): column
        for column in workflow_config.get("columns", [])
        if isinstance(column, dict)
    }
    wip_limits_config = workflow_config.get("wip_limits", {}) or {}

    status_distribution = {
        status: 0 for status in status_order
    }
    priority_distribution = {
        priority: 0 for priority in priority_order
    }

    total_story_points = 0
    completed_story_points = 0
    active_tasks = 0
    done_tasks_count = 0
    overdue_tasks = 0
    due_soon_tasks = 0

    for task in tasks:
        status = _report_enum_value(task.status)
        priority = _report_enum_value(task.priority)
        due_date = _report_plain_date(task.due_date)

        status_distribution[status] = status_distribution.get(status, 0) + 1
        priority_distribution[priority] = priority_distribution.get(priority, 0) + 1

        points = task.story_points or 0
        total_story_points += points

        if status == "DONE":
            done_tasks_count += 1
            completed_story_points += points
        else:
            active_tasks += 1

            if due_date and due_date < now:
                overdue_tasks += 1

            if due_date and now <= due_date <= week_end:
                due_soon_tasks += 1

    closed_sprints = [
        sprint for sprint in sprints
        if not sprint.is_active and sprint.end_date is not None
    ]

    velocity = []
    for sprint in closed_sprints[-8:]:
        sprint_tasks = [task for task in tasks if task.sprint_id == sprint.id]
        done_tasks = [
            task for task in sprint_tasks
            if _report_enum_value(task.status) == "DONE"
        ]

        total_points = sum(task.story_points or 0 for task in sprint_tasks)
        done_points = sum(task.story_points or 0 for task in done_tasks)

        velocity.append(
            {
                "sprint_id": sprint.id,
                "name": sprint.name,
                "start_date": sprint.start_date,
                "end_date": sprint.end_date,
                "total_points": total_points,
                "done_points": done_points,
                "done_tasks": len(done_tasks),
                "total_tasks": len(sprint_tasks),
            }
        )

    active_sprint = next((sprint for sprint in sprints if sprint.is_active), None)
    active_sprint_report = None

    if active_sprint:
        sprint_tasks = [task for task in tasks if task.sprint_id == active_sprint.id]
        sprint_done_tasks = [
            task for task in sprint_tasks
            if _report_enum_value(task.status) == "DONE"
        ]

        sprint_total_points = sum(task.story_points or 0 for task in sprint_tasks)
        sprint_done_points = sum(task.story_points or 0 for task in sprint_done_tasks)
        remaining_points = max(0, sprint_total_points - sprint_done_points)

        active_sprint_report = {
            "sprint_id": active_sprint.id,
            "name": active_sprint.name,
            "goal": active_sprint.goal,
            "start_date": active_sprint.start_date,
            "end_date": active_sprint.end_date,
            "total_points": sprint_total_points,
            "done_points": sprint_done_points,
            "remaining_points": remaining_points,
            "total_tasks": len(sprint_tasks),
            "done_tasks": len(sprint_done_tasks),
        }

    done_date_by_task: dict[int, datetime] = {}
    last_status_change_by_task: dict[int, datetime] = {}
    status_change_counts: dict[str, int] = {status: 0 for status in status_order}
    status_logs = []

    if task_ids:
        status_logs = (
            db.query(TaskAuditLog)
            .filter(
                TaskAuditLog.task_id.in_(task_ids),
                TaskAuditLog.action == "TASK_UPDATED",
                TaskAuditLog.field == "status",
            )
            .order_by(TaskAuditLog.created_at.asc())
            .all()
        )

        for log in status_logs:
            last_status_change_by_task[log.task_id] = log.created_at

            new_status = str(log.new_value or "")
            if new_status:
                status_change_counts[new_status] = status_change_counts.get(new_status, 0) + 1

            if new_status == "DONE" and log.task_id not in done_date_by_task:
                done_date_by_task[log.task_id] = log.created_at

    status_logs_by_task: dict[int, list[TaskAuditLog]] = {}
    for log in status_logs:
        status_logs_by_task.setdefault(log.task_id, []).append(log)

    done_cycle_times = []
    flow_lead_times = []
    lead_times_by_priority: dict[str, list[float]] = {priority: [] for priority in priority_order}
    project_methodology = str(project.methodology if project else "").upper()

    for task in tasks:
        if _report_enum_value(task.status) != "DONE":
            continue

        done_date = done_date_by_task.get(task.id) or task.updated_at or task.created_at
        lead_time = _report_days_between(task.created_at, done_date)
        done_cycle_times.append(lead_time)
        lead_times_by_priority.setdefault(_report_enum_value(task.priority), []).append(lead_time)

        # Kanban/flow lead time: in a Kanban project all completed tasks count;
        # in Scrum/Scrumban, unplanned/non-sprint completed tasks show continuous-flow behavior.
        if project_methodology == "KANBAN" or task.sprint_id is None:
            flow_lead_times.append(lead_time)

    average_cycle_time_days = (
        round(sum(done_cycle_times) / len(done_cycle_times), 2)
        if done_cycle_times
        else 0
    )
    average_flow_lead_time_days = _report_average(flow_lead_times)

    status_age = []
    for status in status_order:
        open_tasks_in_status = [
            task for task in tasks
            if _report_enum_value(task.status) == status and status != "DONE"
        ]

        ages = []
        for task in open_tasks_in_status:
            last_change = last_status_change_by_task.get(task.id) or task.created_at
            ages.append(_report_days_between(last_change, now))

        status_age.append(
            {
                "status": status,
                "tasks": len(open_tasks_in_status),
                "average_age_days": round(sum(ages) / len(ages), 2) if ages else 0,
                "max_age_days": round(max(ages), 2) if ages else 0,
            }
        )

    bottleneck_status = None
    if status_age:
        bottleneck_status = max(
            status_age,
            key=lambda item: (item["average_age_days"], item["tasks"]),
        )

    completion_rate = round((done_tasks_count / len(tasks)) * 100, 2) if tasks else 0
    story_point_completion_rate = (
        round((completed_story_points / total_story_points) * 100, 2)
        if total_story_points
        else 0
    )

    lead_time_distribution = [
        {"name": "ALL", "value": _report_average(done_cycle_times), "tasks": len(done_cycle_times)}
    ]
    lead_time_distribution.extend(
        {
            "name": priority,
            "value": _report_average(lead_times_by_priority.get(priority, [])),
            "tasks": len(lead_times_by_priority.get(priority, [])),
        }
        for priority in priority_order
    )

    cumulative_flow = []
    if tasks:
        task_dates = [
            _report_plain_date(task.created_at)
            for task in tasks
            if _report_plain_date(task.created_at)
        ]
        first_task_date = min(task_dates).date() if task_dates else now.date()
        flow_start_date = max(first_task_date, (now - timedelta(days=13)).date())
        flow_days = max(1, min(30, (now.date() - flow_start_date).days + 1))

        for offset in range(flow_days):
            current_day = flow_start_date + timedelta(days=offset)
            day_end = datetime(
                current_day.year,
                current_day.month,
                current_day.day,
                23,
                59,
                59,
                999999,
            )
            counts = {status: 0 for status in status_order}

            for task in tasks:
                created_at = _report_plain_date(task.created_at)
                if not created_at or created_at > day_end:
                    continue

                status_at_day = "TODO"
                for log in status_logs_by_task.get(task.id, []):
                    log_date = _report_plain_date(log.created_at)
                    if log_date and log_date <= day_end:
                        status_at_day = str(log.new_value or status_at_day)
                    else:
                        break

                counts[status_at_day] = counts.get(status_at_day, 0) + 1

            cumulative_flow.append({"date": current_day.isoformat(), **counts})

    wip_limits_report = []
    for status_key in status_order:
        column = workflow_columns.get(status_key, {})
        current_count = status_distribution.get(status_key, 0)
        raw_limit = wip_limits_config.get(status_key)
        limit = raw_limit if isinstance(raw_limit, int) else None
        exceeded = limit is not None and current_count > limit

        wip_limits_report.append(
            {
                "status": status_key,
                "label": str(column.get("label") or status_key.replace("_", " ").title()),
                "current": current_count,
                "limit": limit,
                "remaining": max(0, limit - current_count) if limit is not None else None,
                "exceeded": exceeded,
            }
        )

    wip_limit_violations = sum(1 for item in wip_limits_report if item["exceeded"])
    combined_wip_limit = sum(
        item["limit"]
        for item in wip_limits_report
        if item["status"] in {"IN_PROGRESS", "REVIEW"} and item["limit"] is not None
    )
    combined_wip_limit = combined_wip_limit or None
    wip_history = [
        {
            "date": point["date"],
            "wip": int(point.get("IN_PROGRESS", 0) or 0) + int(point.get("REVIEW", 0) or 0),
            "limit": combined_wip_limit,
            "exceeded": (
                combined_wip_limit is not None
                and int(point.get("IN_PROGRESS", 0) or 0) + int(point.get("REVIEW", 0) or 0) > combined_wip_limit
            ),
        }
        for point in cumulative_flow
    ]

    sprint_burndown = []
    sprint_burnup = []
    if active_sprint and active_sprint.start_date and active_sprint.end_date:
        sprint_tasks = [task for task in tasks if task.sprint_id == active_sprint.id]
        sprint_total_points = sum(task.story_points or 0 for task in sprint_tasks)
        start_date = _report_plain_date(active_sprint.start_date).date()
        end_date = _report_plain_date(active_sprint.end_date).date()
        burndown_days = max(1, min(60, (end_date - start_date).days + 1))

        for offset in range(burndown_days):
            current_day = start_date + timedelta(days=offset)
            day_end = datetime(
                current_day.year,
                current_day.month,
                current_day.day,
                23,
                59,
                59,
                999999,
            )
            done_points_at_day = 0

            for task in sprint_tasks:
                done_date = done_date_by_task.get(task.id)
                if not done_date and _report_enum_value(task.status) == "DONE":
                    done_date = task.updated_at or task.created_at

                done_date = _report_plain_date(done_date)
                if done_date and done_date <= day_end:
                    done_points_at_day += task.story_points or 0

            if burndown_days > 1:
                ideal_remaining = round(
                    sprint_total_points * ((burndown_days - 1 - offset) / (burndown_days - 1)),
                    2,
                )
            else:
                ideal_remaining = 0

            remaining_points = max(0, sprint_total_points - done_points_at_day)
            ideal_done = max(0, round(sprint_total_points - ideal_remaining, 2))

            sprint_burndown.append(
                {
                    "date": current_day.isoformat(),
                    "remaining_points": remaining_points,
                    "done_points": done_points_at_day,
                    "ideal_remaining": ideal_remaining,
                }
            )
            sprint_burnup.append(
                {
                    "date": current_day.isoformat(),
                    "done_points": done_points_at_day,
                    "scope_points": sprint_total_points,
                    "ideal_done": ideal_done,
                }
            )

    return {
        "project": _serialize_project(project) if project else None,
        "summary": {
            "total_tasks": len(tasks),
            "active_tasks": active_tasks,
            "done_tasks": done_tasks_count,
            "completion_rate": completion_rate,
            "total_story_points": total_story_points,
            "completed_story_points": completed_story_points,
            "story_point_completion_rate": story_point_completion_rate,
            "overdue_tasks": overdue_tasks,
            "due_soon_tasks": due_soon_tasks,
            "average_cycle_time_days": average_cycle_time_days,
            "average_flow_lead_time_days": average_flow_lead_time_days,
            "flow_completed_tasks": len(flow_lead_times),
            "wip_limit_violations": wip_limit_violations,
            "closed_sprints": len(closed_sprints),
        },
        "velocity": velocity,
        "active_sprint": active_sprint_report,
        "status_distribution": [
            _report_chart_item(status, status_distribution.get(status, 0))
            for status in status_order
        ],
        "priority_distribution": [
            _report_chart_item(priority, priority_distribution.get(priority, 0))
            for priority in priority_order
        ],
        "status_age": status_age,
        "status_change_counts": [
            _report_chart_item(status, status_change_counts.get(status, 0))
            for status in status_order
        ],
        "lead_time_distribution": lead_time_distribution,
        "cumulative_flow": cumulative_flow,
        "wip_limits": wip_limits_report,
        "wip_history": wip_history,
        "sprint_burndown": sprint_burndown,
        "sprint_burnup": sprint_burnup,
        "bottleneck": bottleneck_status,
    }


@router.get("/{project_id}/reports/overview")
def get_project_reports_overview(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "REPORT_VIEW")
    return _build_reports_overview(db, project_id)

# --- PRIORITY 3 WORKLOAD BALANCER V1 ---

def _workload_status(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _workload_due_date(task: Task):
    if not task.due_date:
        return None
    return task.due_date.replace(tzinfo=None) if task.due_date.tzinfo else task.due_date


def _workload_task_payload(task: Task) -> dict:
    return {
        "id": task.id,
        "key": task.key,
        "title": task.title,
        "status": _workload_status(task.status),
        "priority": _workload_status(task.priority),
        "story_points": task.story_points,
        "due_date": task.due_date,
        "assignee_id": task.assignee_id,
        "assignee_name": task.assignee_name,
        "assignee_avatar_url": task.assignee_avatar_url,
        "sprint_id": task.sprint_id,
    }


def _build_project_workload(db: Session, project_id: int) -> dict:
    now = datetime.utcnow()

    project = db.query(Project).filter(Project.id == project_id).first()
    members = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.joined_at.asc())
        .all()
    )
    tasks = db.query(Task).filter(Task.project_id == project_id).all()

    active_tasks = [
        task for task in tasks
        if _workload_status(task.status) != "DONE"
    ]

    unassigned_tasks = [
        task for task in active_tasks
        if task.assignee_id is None
    ]

    member_payloads = []

    for member in members:
        member_tasks = [
            task for task in active_tasks
            if task.assignee_id == member.user_id
        ]

        member_tasks.sort(
            key=lambda task: (
                _workload_due_date(task) is None,
                _workload_due_date(task) or datetime.max,
                task.id,
            )
        )

        story_points = sum(task.story_points or 0 for task in member_tasks)
        overdue_tasks = len([
            task for task in member_tasks
            if _workload_due_date(task) and _workload_due_date(task) < now
        ])
        review_tasks = len([
            task for task in member_tasks
            if _workload_status(task.status) == "REVIEW"
        ])
        critical_tasks = len([
            task for task in member_tasks
            if _workload_status(task.priority) == "CRITICAL"
        ])
        stale_review_tasks = len([
            task for task in member_tasks
            if _workload_status(task.status) == "REVIEW"
            and _dashboard_age_days(task.updated_at or task.created_at, now) >= 2
        ])
        stale_progress_tasks = len([
            task for task in member_tasks
            if _workload_status(task.status) == "IN_PROGRESS"
            and _dashboard_age_days(task.updated_at or task.created_at, now) >= 4
        ])
        due_soon_tasks = len([
            task for task in member_tasks
            if _workload_due_date(task) and now <= _workload_due_date(task) <= now + timedelta(days=7)
        ])

        risk_score = min(
            100,
            len(member_tasks) * 8
            + story_points * 3
            + overdue_tasks * 20
            + review_tasks * 8
            + critical_tasks * 12
            + stale_review_tasks * 8
            + stale_progress_tasks * 6
        )

        if risk_score >= 70:
            load_label = "Overloaded"
        elif risk_score >= 40:
            load_label = "Busy"
        elif len(member_tasks) == 0:
            load_label = "Available"
        else:
            load_label = "Balanced"

        risk_factors = []
        if overdue_tasks:
            risk_factors.append(f"{overdue_tasks} overdue task{'s' if overdue_tasks != 1 else ''}")
        if critical_tasks:
            risk_factors.append(f"{critical_tasks} critical item{'s' if critical_tasks != 1 else ''}")
        if stale_review_tasks:
            risk_factors.append(f"{stale_review_tasks} stale review item{'s' if stale_review_tasks != 1 else ''}")
        if stale_progress_tasks:
            risk_factors.append(f"{stale_progress_tasks} long-running task{'s' if stale_progress_tasks != 1 else ''}")
        if due_soon_tasks:
            risk_factors.append(f"{due_soon_tasks} due this week")
        if story_points >= 13:
            risk_factors.append(f"{story_points} active story points")
        if not risk_factors:
            risk_factors.append("capacity looks normal")

        member_payloads.append(
            {
                "membership_id": member.id,
                "user_id": member.user_id,
                "full_name": member.user.full_name if member.user else None,
                "email": member.user.email if member.user else None,
                "avatar_url": member.user.avatar_url if member.user else None,
                "role_name": member.role.name if member.role else "Member",
                "active_tasks": len(member_tasks),
                "story_points": story_points,
                "overdue_tasks": overdue_tasks,
                "review_tasks": review_tasks,
                "critical_tasks": critical_tasks,
                "stale_review_tasks": stale_review_tasks,
                "stale_progress_tasks": stale_progress_tasks,
                "due_soon_tasks": due_soon_tasks,
                "risk_score": risk_score,
                "load_label": load_label,
                "risk_factors": risk_factors[:5],
                "tasks": [_workload_task_payload(task) for task in member_tasks],
            }
        )

    member_payloads.sort(
        key=lambda item: (
            item["risk_score"],
            item["story_points"],
            item["active_tasks"],
        ),
        reverse=True,
    )

    unassigned_story_points = sum(task.story_points or 0 for task in unassigned_tasks)
    overloaded_members = len([
        member for member in member_payloads
        if member["risk_score"] >= 70
    ])

    return {
        "project": _serialize_project(project) if project else None,
        "summary": {
            "members_count": len(member_payloads),
            "active_tasks": len(active_tasks),
            "assigned_tasks": len(active_tasks) - len(unassigned_tasks),
            "unassigned_tasks": len(unassigned_tasks),
            "unassigned_story_points": unassigned_story_points,
            "total_story_points": sum(task.story_points or 0 for task in active_tasks),
            "overdue_tasks": sum(member["overdue_tasks"] for member in member_payloads),
            "review_tasks": sum(member["review_tasks"] for member in member_payloads),
            "overloaded_members": overloaded_members,
            "stale_flow_tasks": sum(
                member["stale_review_tasks"] + member["stale_progress_tasks"]
                for member in member_payloads
            ),
        },
        "members": member_payloads,
        "unassigned_tasks": [_workload_task_payload(task) for task in unassigned_tasks],
    }




@router.get("/{project_id}/workload")
def get_project_workload(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)
    return _build_project_workload(db, project_id)


@router.post("/{project_id}/workload/ai-suggestions")
def get_project_workload_suggestions(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "AI_USE")

    workload = _build_project_workload(db, project_id)
    members = workload["members"]

    overloaded = [
        member for member in members
        if member["risk_score"] >= 70 and member["tasks"]
    ]
    available = [
        member for member in members
        if member["risk_score"] <= 35
    ]

    suggestions = []

    for source in overloaded:
        if not available:
            break

        target = sorted(
            available,
            key=lambda member: (member["risk_score"], member["active_tasks"], member["story_points"]),
        )[0]

        movable_tasks = [
            task for task in source["tasks"]
            if task["status"] in {"TODO", "IN_PROGRESS"} and task["priority"] != "CRITICAL"
        ]

        if not movable_tasks:
            movable_tasks = source["tasks"]

        task = sorted(
            movable_tasks,
            key=lambda item: (
                item["story_points"] or 0,
                item["due_date"] is None,
                item["due_date"] or "",
            ),
            reverse=True,
        )[0]

        suggestions.append(
            {
                "type": "REASSIGN_TASK",
                "severity": "high" if source["risk_score"] >= 85 else "medium",
                "task_id": task["id"],
                "task_key": task["key"],
                "task_title": task["title"],
                "from_user_id": source["user_id"],
                "from_name": source["full_name"] or source["email"] or "Unassigned",
                "to_user_id": target["user_id"],
                "to_name": target["full_name"] or target["email"] or "Available member",
                "reason": (
                    f"{source['full_name'] or source['email']} has a high workload score "
                    f"({source['risk_score']}/100) driven by {', '.join(source.get('risk_factors', [])[:3])}. "
                    f"{target['full_name'] or target['email']} has more available capacity "
                    f"({target['risk_score']}/100, {', '.join(target.get('risk_factors', [])[:2])})."
                ),
            }
        )

        target["risk_score"] += 20
        target["active_tasks"] += 1
        target["story_points"] += task["story_points"] or 0

    if workload["summary"]["unassigned_tasks"] > 0 and available:
        target = sorted(
            available,
            key=lambda member: (member["risk_score"], member["active_tasks"], member["story_points"]),
        )[0]

        for task in workload["unassigned_tasks"][:3]:
            suggestions.append(
                {
                    "type": "ASSIGN_UNASSIGNED_TASK",
                    "severity": "medium",
                    "task_id": task["id"],
                    "task_key": task["key"],
                    "task_title": task["title"],
                    "from_user_id": None,
                    "from_name": "Unassigned",
                    "to_user_id": target["user_id"],
                    "to_name": target["full_name"] or target["email"] or "Available member",
                    "reason": (
                        f"This task is currently unassigned. {target['full_name'] or target['email']} "
                        f"has the clearest capacity signal: {', '.join(target.get('risk_factors', [])[:2])}."
                    ),
                }
            )

    if not suggestions:
        suggestions.append(
            {
                "type": "NO_ACTION_NEEDED",
                "severity": "low",
                "task_id": None,
                "task_key": None,
                "task_title": None,
                "from_user_id": None,
                "from_name": None,
                "to_user_id": None,
                "to_name": None,
                "reason": "The current workload distribution looks balanced based on active tasks, overdue work and story points.",
            }
        )

    project = db.query(Project).filter(Project.id == project_id).first()
    ai_result = enhance_workload_suggestions(
        workload=workload,
        suggestions=suggestions,
        ai_config=resolve_project_ai_config(project),
    )
    enhanced_suggestions = ai_result.get("suggestions") or suggestions
    default_summary = (
        "Workload suggestions combine active tasks, story points, overdue work, stale flow, "
        "review queues, critical priority and near-term deadlines."
    )
    summary = ai_result.get("summary") or default_summary
    source = ai_result.get("source") or "algorithm"

    record_ai_usage(
        db,
        user_id=current_user.id,
        project_id=project_id,
        feature="WORKLOAD_BALANCER",
        source=source,
        status="ERROR" if str(source).startswith("fallback_after_error") else "SUCCESS",
        detail=ai_result.get("error"),
    )

    return {
        "summary": summary,
        "source": source,
        "suggestions": enhanced_suggestions,
    }


# --- BATCH 7 PROJECT ACTIVITY ---

class ProjectActivityOut(BaseModel):
    id: int
    task_id: int
    task_key: str
    task_title: str
    actor_id: int | None = None
    actor_name: str | None = None
    actor_avatar_url: str | None = None
    action: str
    field: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    created_at: str


@router.get("/{project_id}/activity", response_model=List[ProjectActivityOut])
def get_project_activity(
    project_id: int,
    limit: int = 80,
    hours: int | None = None,
    actor_id: int | None = None,
    action: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    from datetime import datetime, timedelta

    safe_limit = max(1, min(limit, 200))

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
        .limit(safe_limit)
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
            "actor_avatar_url": log.actor_avatar_url,
            "action": log.action,
            "field": log.field,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "created_at": log.created_at.isoformat() if log.created_at else "",
        }
        for log, task in rows
    ]

    # Fallback: pentru proiecte fără audit logs, arătăm task-urile ca activitate inițială.
    if not activities:
        tasks = (
            db.query(Task)
            .filter(Task.project_id == project_id)
            .order_by(Task.created_at.desc())
            .limit(safe_limit)
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
                "actor_avatar_url": None,
                "action": "TASK_CREATED",
                "field": "title",
                "old_value": None,
                "new_value": task.title,
                "created_at": task.created_at.isoformat() if task.created_at else "",
            }
            for task in tasks
        ]

    return activities
