from __future__ import annotations

import hashlib
import hmac
import json
import re
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query, status
from sqlalchemy.orm import Session

from backend.config import get_settings
from backend.database.session import get_db
from backend.models.github import GitHubEvent
from backend.models.project import ProjectMember, Task, TaskAuditLog, TaskComment, TaskStatus
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.realtime import broadcast_project_event
from backend.schemas.github import GitHubEventOut, GitHubPullRequestOut, PullRequestConfirmRequest
from backend.services.documentation_service import upsert_task_documentation_page
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/github", tags=["GitHub / DevOps"])

TASK_KEY_RE = re.compile(r"\b[A-Z][A-Z0-9]+-\d+\b")


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
