from __future__ import annotations

import hashlib
import hmac
import json
import subprocess
import time
import urllib.error
import urllib.request
import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database.session import get_db
from backend.models.github import GitHubEvent, GitHubProjectIntegration
from backend.models.project import Project, ProjectMember, Task, TaskAuditLog, TaskComment, TaskStatus
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.realtime import broadcast_project_event
from backend.schemas.github import (
    GitHubEventOut,
    GitHubIntegrationOut,
    GitHubIntegrationTestOut,
    GitHubIntegrationUpsert,
    GitHubPullRequestOut,
    PullRequestConfirmRequest,
)
from backend.services.documentation_service import upsert_task_documentation_page
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/github", tags=["GitHub / DevOps"])

NGROK_PROCESS: subprocess.Popen | None = None
NGROK_DEFAULT_PORT = 8000
NGROK_API_URL = "http://127.0.0.1:4040/api/tunnels"


def _read_ngrok_tunnel() -> dict:
    try:
        with urllib.request.urlopen(NGROK_API_URL, timeout=1.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError:
        return {
            "running": False,
            "public_url": None,
            "webhook_url": None,
            "message": "ngrok is not running.",
        }
    except Exception as exc:
        return {
            "running": False,
            "public_url": None,
            "webhook_url": None,
            "message": f"Could not read ngrok status: {exc}",
        }

    tunnels = payload.get("tunnels") or []
    https_tunnel = next(
        (
            tunnel
            for tunnel in tunnels
            if tunnel.get("public_url", "").startswith("https://")
        ),
        tunnels[0] if tunnels else None,
    )

    public_url = https_tunnel.get("public_url") if https_tunnel else None

    return {
        "running": bool(public_url),
        "public_url": public_url,
        "webhook_url": f"{public_url.rstrip('/')}/github/webhook" if public_url else None,
        "message": "ngrok tunnel is running." if public_url else "ngrok is running, but no public tunnel was found.",
        "tunnels": tunnels,
    }


def _start_ngrok_process(port: int = NGROK_DEFAULT_PORT) -> dict:
    global NGROK_PROCESS

    current = _read_ngrok_tunnel()
    if current.get("running"):
        return current

    if NGROK_PROCESS and NGROK_PROCESS.poll() is None:
        # Process exists but API is not ready yet. Continue polling below.
        pass
    else:
        try:
            NGROK_PROCESS = subprocess.Popen(
                ["ngrok", "http", str(port)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                stdin=subprocess.DEVNULL,
                start_new_session=True,
            )
        except FileNotFoundError:
            return {
                "running": False,
                "public_url": None,
                "webhook_url": None,
                "message": "ngrok command was not found. Install ngrok or make sure it is available in PATH.",
            }
        except Exception as exc:
            return {
                "running": False,
                "public_url": None,
                "webhook_url": None,
                "message": f"Could not start ngrok: {exc}",
            }

    for _ in range(16):
        time.sleep(0.5)
        current = _read_ngrok_tunnel()
        if current.get("running"):
            return current

        if NGROK_PROCESS and NGROK_PROCESS.poll() is not None:
            return {
                "running": False,
                "public_url": None,
                "webhook_url": None,
                "message": "ngrok process stopped before creating a tunnel. Check your ngrok authtoken/account.",
            }

    return {
        "running": False,
        "public_url": None,
        "webhook_url": None,
        "message": "ngrok did not expose a tunnel in time. Try running ngrok http 8000 manually to inspect the error.",
    }


def _stop_ngrok_process() -> dict:
    global NGROK_PROCESS

    if NGROK_PROCESS and NGROK_PROCESS.poll() is None:
        NGROK_PROCESS.terminate()

        try:
            NGROK_PROCESS.wait(timeout=4)
        except subprocess.TimeoutExpired:
            NGROK_PROCESS.kill()

        NGROK_PROCESS = None

        return {
            "running": False,
            "public_url": None,
            "webhook_url": None,
            "message": "ngrok tunnel stopped.",
        }

    NGROK_PROCESS = None

    return {
        **_read_ngrok_tunnel(),
        "message": "No ngrok process started by SDLC Hub is currently tracked.",
    }


TASK_KEY_RE = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")




def _repo_full_name_from_payload(payload: dict[str, Any]) -> str | None:
    repository = payload.get("repository") or {}
    if not isinstance(repository, dict):
        return None

    full_name = repository.get("full_name")
    if isinstance(full_name, str) and "/" in full_name:
        return full_name.strip()

    return None


def _normalize_repository_full_name(value: str) -> str:
    normalized = (value or "").strip()

    if normalized.startswith("https://github.com/"):
        normalized = normalized.replace("https://github.com/", "", 1)
    if normalized.startswith("http://github.com/"):
        normalized = normalized.replace("http://github.com/", "", 1)
    if normalized.endswith(".git"):
        normalized = normalized[:-4]

    normalized = normalized.strip("/")

    if not re.match(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", normalized):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repository must use the owner/repository format.",
        )

    return normalized


def _secret_hint() -> str | None:
    secret = get_settings().github_webhook_secret
    if not secret:
        return None

    if len(secret) <= 4:
        return "configured"

    return f"••••{secret[-4:]}"



def _require_project_owner(db: Session, current_user: User, project_id: int) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()

    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if project.owner_id == current_user.id or bool(getattr(current_user, "is_global_admin", False)):
        return project

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only the project owner can manage the GitHub repository integration.",
    )

def _integration_to_out(project_id: int, integration: GitHubProjectIntegration | None) -> dict:
    settings = get_settings()

    if not integration:
        return {
            "id": None,
            "project_id": project_id,
            "configured": False,
            "repository_full_name": None,
            "repository_url": None,
            "default_branch": "main",
            "webhook_url": None,
            "webhook_endpoint_path": "/github/webhook",
            "setup_status": "NOT_CONFIGURED",
            "auto_link_commits": True,
            "auto_transition_prs": True,
            "secret_configured": bool(settings.github_webhook_secret),
            "webhook_secret_hint": _secret_hint(),
            "last_ping_at": None,
            "last_delivery_at": None,
            "last_error": None,
            "created_at": None,
            "updated_at": None,
        }

    return {
        "id": integration.id,
        "project_id": integration.project_id,
        "configured": True,
        "repository_full_name": integration.repository_full_name,
        "repository_url": integration.repository_url,
        "default_branch": integration.default_branch or "main",
        "webhook_url": integration.webhook_url,
        "webhook_endpoint_path": "/github/webhook",
        "setup_status": integration.setup_status or "CONFIGURED",
        "auto_link_commits": bool(integration.auto_link_commits),
        "auto_transition_prs": bool(integration.auto_transition_prs),
        "secret_configured": bool(settings.github_webhook_secret),
        "webhook_secret_hint": integration.webhook_secret_hint or _secret_hint(),
        "last_ping_at": integration.last_ping_at,
        "last_delivery_at": integration.last_delivery_at,
        "last_error": integration.last_error,
        "created_at": integration.created_at,
        "updated_at": integration.updated_at,
    }


def _find_integration_for_payload(db: Session, payload: dict[str, Any]) -> GitHubProjectIntegration | None:
    repo_full_name = _repo_full_name_from_payload(payload)
    if not repo_full_name:
        return None

    return (
        db.query(GitHubProjectIntegration)
        .filter(GitHubProjectIntegration.repository_full_name.ilike(repo_full_name))
        .first()
    )


def _refresh_integration_from_payload(
    db: Session,
    payload: dict[str, Any],
    event_type: str,
) -> GitHubProjectIntegration | None:
    integration = _find_integration_for_payload(db, payload)
    if not integration:
        return None

    now = datetime.utcnow()
    integration.last_delivery_at = now
    integration.last_error = None

    if event_type == "ping":
        integration.last_ping_at = now

    if integration.setup_status in {"CONFIGURED", "WAITING_FOR_PING", "ERROR"}:
        integration.setup_status = "CONNECTED"

    db.flush()
    return integration


def _enum_value(value) -> str:
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _extract_task_keys(*values: str | None) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()

    for value in values:
        if not value:
            continue

        for match in TASK_KEY_RE.findall(value.upper()):
            if match not in seen:
                keys.append(match)
                seen.add(match)

    return keys


def _verify_signature(secret: str, body: bytes, signature: str | None) -> None:
    if not signature:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing GitHub signature.")

    expected = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid GitHub signature.")


def _compact_payload(payload: dict[str, Any]) -> str:
    try:
        return json.dumps(payload)[:12000]
    except Exception:
        return "{}"


def _normalize_github_identity(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]", "", (value or "").lower())


def _resolve_github_user(db: Session, sender_login: str | None, project_id: int | None) -> User | None:
    if not sender_login or not project_id:
        return None

    login = sender_login.strip()
    normalized_login = _normalize_github_identity(login)
    if not normalized_login:
        return None

    exact_membership = (
        db.query(ProjectMember)
        .join(User, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .filter(User.github_username.ilike(login))
        .first()
    )
    if exact_membership and exact_membership.user:
        return exact_membership.user

    memberships = (
        db.query(ProjectMember)
        .join(User, ProjectMember.user_id == User.id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )

    for membership in memberships:
        user = membership.user
        if not user:
            continue

        email_local = (user.email or "").split("@")[0]
        candidates = {
            _normalize_github_identity(email_local),
            _normalize_github_identity(user.full_name),
        }
        if normalized_login in candidates:
            if not user.github_username:
                user.github_username = login[:120]
            return user

    return None


def _add_task_comment(db: Session, task: Task, body: str, author_id: int | None = None) -> None:
    selected_author_id = author_id

    if selected_author_id is None and task.project and task.project.owner_id:
        selected_author_id = task.project.owner_id
    elif selected_author_id is None and task.assignee_id:
        selected_author_id = task.assignee_id

    if selected_author_id is None:
        return

    db.add(
        TaskComment(
            task_id=task.id,
            author_id=selected_author_id,
            body=body,
        )
    )


def _add_audit_log(
    db: Session,
    task: Task,
    *,
    action: str,
    field: str | None = None,
    old_value=None,
    new_value=None,
) -> None:
    db.add(
        TaskAuditLog(
            task_id=task.id,
            actor_id=None,
            action=action,
            field=field,
            old_value=None if old_value is None else str(old_value),
            new_value=None if new_value is None else str(new_value),
        )
    )


def _store_event(
    db: Session,
    *,
    delivery_id: str | None,
    event_type: str,
    action: str | None,
    repository: str | None,
    sender_login: str | None,
    mapped_user: User | None,
    task: Task | None,
    task_key: str | None,
    commit_sha: str | None,
    pull_request_number: int | None,
    url: str | None,
    summary: str,
    payload: dict[str, Any],
) -> GitHubEvent:
    github_event = GitHubEvent(
        delivery_id=delivery_id if task is None else f"{delivery_id}:{task.id}:{event_type}:{commit_sha or pull_request_number or action}",
        project_id=task.project_id if task else None,
        task_id=task.id if task else None,
        mapped_user_id=mapped_user.id if mapped_user else None,
        event_type=event_type,
        action=action,
        repository=repository,
        sender_login=sender_login,
        task_key=task_key,
        commit_sha=commit_sha,
        pull_request_number=pull_request_number,
        url=url,
        summary=summary,
        payload_json=_compact_payload(payload),
    )
    db.add(github_event)
    return github_event


def _find_tasks_by_keys(db: Session, keys: list[str]) -> list[Task]:
    if not keys:
        return []

    return (
        db.query(Task)
        .filter(Task.key.in_(keys))
        .all()
    )


def _handle_push(
    db: Session,
    *,
    delivery_id: str | None,
    payload: dict[str, Any],
) -> int:
    repository = (payload.get("repository") or {}).get("full_name")
    sender_login = (payload.get("sender") or {}).get("login")
    commits = payload.get("commits") or []
    processed = 0

    for commit in commits:
        message = commit.get("message") or ""
        sha = commit.get("id") or commit.get("sha")
        url = commit.get("url")
        author_name = (commit.get("author") or {}).get("name") or sender_login or "GitHub"

        keys = _extract_task_keys(message)
        tasks = _find_tasks_by_keys(db, keys)

        for task in tasks:
            mapped_user = _resolve_github_user(db, sender_login, task.project_id)
            summary = f"Commit linked to {task.key}: {message.splitlines()[0][:180]}"
            body = (
                f"GitHub commit linked by {author_name}:\n\n"
                f"{message}\n\n"
                f"Repository: {repository or 'unknown'}\n"
                f"Commit: {sha or 'unknown'}\n"
                f"{url or ''}"
            )

            _add_task_comment(db, task, body, mapped_user.id if mapped_user else None)
            _add_audit_log(
                db,
                task,
                action="GITHUB_COMMIT_LINKED",
                field="github.commit",
                old_value=None,
                new_value=sha or message[:120],
            )

            _store_event(
                db,
                delivery_id=delivery_id,
                event_type="push",
                action="commit",
                repository=repository,
                sender_login=sender_login,
                mapped_user=mapped_user,
                task=task,
                task_key=task.key,
                commit_sha=sha,
                pull_request_number=None,
                url=url,
                summary=summary,
                payload=payload,
            )
            processed += 1

    return processed


def _handle_pull_request(
    db: Session,
    *,
    delivery_id: str | None,
    payload: dict[str, Any],
) -> int:
    action = payload.get("action")
    repository = (payload.get("repository") or {}).get("full_name")
    sender_login = (payload.get("sender") or {}).get("login")
    pull_request = payload.get("pull_request") or {}

    title = pull_request.get("title")
    body = pull_request.get("body")
    url = pull_request.get("html_url")
    number = pull_request.get("number")
    merged = bool(pull_request.get("merged"))
    branch = ((pull_request.get("head") or {}).get("ref")) or ""

    keys = _extract_task_keys(title, body, branch)
    tasks = _find_tasks_by_keys(db, keys)
    processed = 0

    for task in tasks:
        mapped_user = _resolve_github_user(db, sender_login, task.project_id)
        old_status = _enum_value(task.status)
        new_status = None

        if action in {"opened", "reopened", "ready_for_review"}:
            if old_status != TaskStatus.REVIEW.value:
                task.status = TaskStatus.REVIEW
                new_status = TaskStatus.REVIEW.value
        elif action == "closed" and merged:
            if old_status != TaskStatus.DONE.value:
                task.status = TaskStatus.DONE
                new_status = TaskStatus.DONE.value
                documentation_page = upsert_task_documentation_page(db, task, None)
                _add_audit_log(
                    db,
                    task,
                    action="DOCUMENTATION_GENERATED",
                    field="documentation_page_id",
                    old_value=None,
                    new_value=documentation_page.id,
                )

        pr_label = f"PR #{number}" if number else "Pull request"
        summary = f"{pr_label} {action or 'updated'} for {task.key}: {title or 'Untitled PR'}"

        comment_lines = [
            f"GitHub {pr_label} {action or 'updated'} for {task.key}.",
            "",
            f"Title: {title or 'Untitled PR'}",
            f"Repository: {repository or 'unknown'}",
        ]

        if merged:
            comment_lines.append("Merged: yes")

        if url:
            comment_lines.append(url)

        if new_status:
            comment_lines.append("")
            comment_lines.append(f"Task moved from {old_status} to {new_status}.")

            _add_audit_log(
                db,
                task,
                action="TASK_UPDATED",
                field="status",
                old_value=old_status,
                new_value=new_status,
            )

        _add_task_comment(db, task, "\n".join(comment_lines), mapped_user.id if mapped_user else None)
        _add_audit_log(
            db,
            task,
            action="GITHUB_PR_LINKED",
            field="github.pull_request",
            old_value=None,
            new_value=f"{number or ''} {action or ''}".strip(),
        )

        _store_event(
            db,
            delivery_id=delivery_id,
            event_type="pull_request",
            action=action,
            repository=repository,
            sender_login=sender_login,
            mapped_user=mapped_user,
            task=task,
            task_key=task.key,
            commit_sha=None,
            pull_request_number=number,
            url=url,
            summary=summary,
            payload=payload,
        )
        processed += 1

    return processed






@router.get("/ngrok/status")
def get_ngrok_status(
    current_user: User = Depends(get_current_user),
):
    return _read_ngrok_tunnel()


@router.post("/ngrok/start")
def start_ngrok_tunnel(
    port: int = NGROK_DEFAULT_PORT,
    project_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        _require_project_owner(db, current_user, project_id)

    safe_port = port if 1 <= port <= 65535 else NGROK_DEFAULT_PORT
    return _start_ngrok_process(safe_port)


@router.post("/ngrok/stop")
def stop_ngrok_tunnel(
    project_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if project_id is not None:
        _require_project_owner(db, current_user, project_id)

    return _stop_ngrok_process()


@router.get("/integration/project/{project_id}", response_model=GitHubIntegrationOut)
def get_project_github_integration(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    integration = (
        db.query(GitHubProjectIntegration)
        .filter(GitHubProjectIntegration.project_id == project_id)
        .first()
    )

    return _integration_to_out(project_id, integration)


@router.put("/integration/project/{project_id}", response_model=GitHubIntegrationOut)
def upsert_project_github_integration(
    project_id: int,
    data: GitHubIntegrationUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)
    _require_project_owner(db, current_user, project_id)

    repository_full_name = _normalize_repository_full_name(data.repository_full_name)
    repository_url = (data.repository_url or "").strip() or f"https://github.com/{repository_full_name}"
    webhook_url = (data.webhook_url or "").strip() or None

    if webhook_url and not webhook_url.endswith("/github/webhook"):
        webhook_url = webhook_url.rstrip("/") + "/github/webhook"

    integration = (
        db.query(GitHubProjectIntegration)
        .filter(GitHubProjectIntegration.project_id == project_id)
        .first()
    )

    if not integration:
        integration = GitHubProjectIntegration(
            project_id=project_id,
            created_by_id=current_user.id,
        )
        db.add(integration)

    integration.repository_full_name = repository_full_name
    integration.repository_url = repository_url
    integration.default_branch = (data.default_branch or "main").strip() or "main"
    integration.webhook_url = webhook_url
    integration.webhook_secret_hint = _secret_hint()
    integration.auto_link_commits = bool(data.auto_link_commits)
    integration.auto_transition_prs = bool(data.auto_transition_prs)

    if integration.last_ping_at or integration.last_delivery_at:
        integration.setup_status = "CONNECTED"
    else:
        integration.setup_status = "WAITING_FOR_PING"

    integration.last_error = None

    db.commit()
    db.refresh(integration)

    broadcast_project_event(
        project_id,
        "project.changed",
        {
            "action": "github_integration_updated",
            "project_id": project_id,
            "github_integration": _integration_to_out(project_id, integration),
        },
    )

    return _integration_to_out(project_id, integration)


@router.post("/integration/project/{project_id}/test", response_model=GitHubIntegrationTestOut)
def test_project_github_integration(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    settings = get_settings()
    integration = (
        db.query(GitHubProjectIntegration)
        .filter(GitHubProjectIntegration.project_id == project_id)
        .first()
    )

    if not integration:
        return {
            "configured": False,
            "secret_configured": bool(settings.github_webhook_secret),
            "status": "NOT_CONFIGURED",
            "message": "Configure a GitHub repository before testing the webhook connection.",
            "repository_full_name": None,
            "webhook_url": None,
            "last_ping_at": None,
            "last_delivery_at": None,
        }

    if not settings.github_webhook_secret:
        integration.setup_status = "ERROR"
        integration.last_error = "GITHUB_WEBHOOK_SECRET is not configured."
        db.commit()

        return {
            "configured": True,
            "secret_configured": False,
            "status": "ERROR",
            "message": "Backend secret is missing. Set GITHUB_WEBHOOK_SECRET and restart the backend.",
            "repository_full_name": integration.repository_full_name,
            "webhook_url": integration.webhook_url,
            "last_ping_at": integration.last_ping_at,
            "last_delivery_at": integration.last_delivery_at,
        }

    if integration.last_ping_at or integration.last_delivery_at:
        integration.setup_status = "CONNECTED"
        integration.last_error = None
        message = "GitHub connection looks active. At least one webhook delivery was received."
    else:
        integration.setup_status = "WAITING_FOR_PING"
        message = "Configuration saved. Use GitHub's Redeliver/Ping button to send a webhook test."

    db.commit()

    return {
        "configured": True,
        "secret_configured": True,
        "status": integration.setup_status,
        "message": message,
        "repository_full_name": integration.repository_full_name,
        "webhook_url": integration.webhook_url,
        "last_ping_at": integration.last_ping_at,
        "last_delivery_at": integration.last_delivery_at,
    }


@router.delete("/integration/project/{project_id}")
def delete_project_github_integration(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)
    _require_project_owner(db, current_user, project_id)

    integration = (
        db.query(GitHubProjectIntegration)
        .filter(GitHubProjectIntegration.project_id == project_id)
        .first()
    )

    if not integration:
        return {"message": "GitHub integration already disconnected."}

    db.delete(integration)
    db.commit()

    broadcast_project_event(
        project_id,
        "project.changed",
        {"action": "github_integration_deleted", "project_id": project_id},
    )

    return {"message": "GitHub integration disconnected."}


@router.post("/webhook")
async def github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
    x_github_delivery: str | None = Header(default=None, alias="X-GitHub-Delivery"),
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
):
    settings = get_settings()

    if not settings.github_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GitHub webhook secret is not configured.",
        )

    body = await request.body()
    _verify_signature(settings.github_webhook_secret, body, x_hub_signature_256)

    if x_github_delivery:
        duplicate = db.query(GitHubEvent).filter(GitHubEvent.delivery_id == x_github_delivery).first()
        if duplicate:
            return {"processed": False, "reason": "duplicate_delivery", "events_created": 0}

    try:
        payload = json.loads(body.decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload.") from exc

    event_type = x_github_event or "unknown"
    integration = _refresh_integration_from_payload(db, payload, event_type)
    integration_project_id = integration.project_id if integration else None

    if event_type == "ping":
        _store_event(
            db,
            delivery_id=x_github_delivery,
            event_type="ping",
            action="ping",
            repository=(payload.get("repository") or {}).get("full_name"),
            sender_login=(payload.get("sender") or {}).get("login"),
            mapped_user=None,
            task=None,
            task_key=None,
            commit_sha=None,
            pull_request_number=None,
            url=None,
            summary="GitHub webhook ping received.",
            payload=payload,
        )
        db.commit()
        return {"processed": True, "event": "ping", "events_created": 1}

    if event_type == "push":
        created = _handle_push(db, delivery_id=x_github_delivery, payload=payload)
    elif event_type == "pull_request":
        created = _handle_pull_request(db, delivery_id=x_github_delivery, payload=payload)
    else:
        _store_event(
            db,
            delivery_id=x_github_delivery,
            event_type=event_type,
            action=payload.get("action"),
            repository=(payload.get("repository") or {}).get("full_name"),
            sender_login=(payload.get("sender") or {}).get("login"),
            mapped_user=None,
            task=None,
            task_key=None,
            commit_sha=None,
            pull_request_number=None,
            url=None,
            summary=f"Unsupported GitHub event received: {event_type}",
            payload=payload,
        )
        created = 1

    db.commit()
    return {"processed": True, "event": event_type, "events_created": created}


def _pull_request_payload(db: Session, event: GitHubEvent) -> dict:
    task = db.query(Task).filter(Task.id == event.task_id).first() if event.task_id else None
    mapped_user = db.query(User).filter(User.id == event.mapped_user_id).first() if event.mapped_user_id else None

    return {
        "id": event.id,
        "project_id": event.project_id,
        "task_id": event.task_id,
        "task_key": event.task_key,
        "task_title": task.title if task else None,
        "task_status": _enum_value(task.status) if task else None,
        "action": event.action,
        "repository": event.repository,
        "sender_login": event.sender_login,
        "mapped_user_id": event.mapped_user_id,
        "mapped_user_name": mapped_user.full_name if mapped_user else None,
        "mapped_user_email": mapped_user.email if mapped_user else None,
        "pull_request_number": event.pull_request_number,
        "url": event.url,
        "summary": event.summary,
        "created_at": event.created_at,
    }


@router.get("/pull-requests/project/{project_id}", response_model=list[GitHubPullRequestOut])
def list_project_pull_requests(
    project_id: int,
    limit: int = Query(default=120, ge=1, le=300),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    events = (
        db.query(GitHubEvent)
        .filter(GitHubEvent.project_id == project_id)
        .filter(GitHubEvent.event_type == "pull_request")
        .order_by(GitHubEvent.created_at.desc(), GitHubEvent.id.desc())
        .limit(limit)
        .all()
    )
    return [_pull_request_payload(db, event) for event in events]


@router.post("/pull-requests/{event_id}/confirm", response_model=GitHubPullRequestOut)
def confirm_pull_request_transition(
    event_id: int,
    request: PullRequestConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(GitHubEvent).filter(GitHubEvent.id == event_id).first()
    if not event or event.event_type != "pull_request":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pull request event not found.")

    if not event.project_id or not event.task_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pull request is not linked to a task.")

    require_project_permission(db, current_user.id, event.project_id, "TASK_UPDATE")

    task = db.query(Task).filter(Task.id == event.task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked task not found.")

    target_status = request.target_status.upper()
    if target_status not in {TaskStatus.REVIEW.value, TaskStatus.DONE.value}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="target_status must be REVIEW or DONE.")

    old_status = _enum_value(task.status)
    task.status = TaskStatus(target_status)

    _add_audit_log(
        db,
        task,
        action="GITHUB_PR_MANUAL_CONFIRM",
        field="status",
        old_value=old_status,
        new_value=target_status,
    )

    if target_status == TaskStatus.DONE.value:
        documentation_page = upsert_task_documentation_page(db, task, current_user.id)
        _add_audit_log(
            db,
            task,
            action="DOCUMENTATION_GENERATED",
            field="documentation_page_id",
            old_value=None,
            new_value=documentation_page.id,
        )

    note = (request.note or "").strip()
    comment = (
        f"Pull request transition confirmed manually by {current_user.full_name or current_user.email}.\n"
        f"PR: #{event.pull_request_number or '-'}\n"
        f"Status: {old_status} -> {target_status}"
    )
    if note:
        comment += f"\nNote: {note[:500]}"
    if event.url:
        comment += f"\n{event.url}"
    _add_task_comment(db, task, comment, current_user.id)

    event.action = f"{event.action or 'updated'}:manual_{target_status.lower()}"
    event.summary = f"Manual confirmation for {task.key}: task moved to {target_status}"

    db.commit()
    db.refresh(event)
    broadcast_project_event(
        event.project_id,
        "task.changed",
        {"action": "github_pr_manual_confirm", "task_id": task.id, "task_key": task.key},
    )
    return _pull_request_payload(db, event)


@router.get("/events/project/{project_id}", response_model=list[GitHubEventOut])
def list_project_github_events(
    project_id: int,
    event_type: str | None = Query(default=None),
    limit: int = Query(default=80, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    query = db.query(GitHubEvent).filter(GitHubEvent.project_id == project_id)

    if event_type:
        query = query.filter(GitHubEvent.event_type == event_type)

    return (
        query.order_by(GitHubEvent.created_at.desc(), GitHubEvent.id.desc())
        .limit(limit)
        .all()
    )
