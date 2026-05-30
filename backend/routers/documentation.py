from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.documentation import DocumentationPage, DocumentationRevision
from backend.models.project import Task, TaskStatus
from backend.realtime import broadcast_project_event
from backend.models.user import User
from backend.routers.auth import get_current_user
from backend.schemas.documentation import (
    DocumentationPageCreate,
    DocumentationPageOut,
    DocumentationRevisionOut,
    DocumentationPageUpdate,
)
from backend.services.documentation_service import enum_value, upsert_task_documentation_page
from backend.utils.permissions import check_project_permission, require_project_permission


router = APIRouter(prefix="/documentation", tags=["Documentation"])


def _ensure_task_belongs_to_project(db: Session, project_id: int, task_id: int | None) -> Task | None:
    if not task_id:
        return None

    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task does not belong to this project.",
        )

    return task


def _snapshot_revision(
    db: Session,
    page: DocumentationPage,
    *,
    actor_id: int | None,
    action: str,
) -> DocumentationRevision:
    revision = DocumentationRevision(
        page_id=page.id,
        project_id=page.project_id,
        task_id=page.task_id,
        title=page.title,
        content=page.content,
        action=action,
        actor_id=actor_id,
    )
    db.add(revision)
    db.flush()
    return revision


@router.get("/project/{project_id}", response_model=List[DocumentationPageOut])
def list_project_documentation(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    return (
        db.query(DocumentationPage)
        .filter(DocumentationPage.project_id == project_id)
        .order_by(DocumentationPage.updated_at.desc(), DocumentationPage.id.desc())
        .all()
    )


@router.post("/project/{project_id}", response_model=DocumentationPageOut)
def create_documentation_page(
    project_id: int,
    page_in: DocumentationPageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "TASK_UPDATE")
    _ensure_task_belongs_to_project(db, project_id, page_in.task_id)

    page = DocumentationPage(
        project_id=project_id,
        task_id=page_in.task_id,
        title=page_in.title.strip(),
        content=page_in.content,
        created_by_id=current_user.id,
    )

    db.add(page)
    db.commit()
    db.refresh(page)
    broadcast_project_event(
        project_id,
        "documentation.changed",
        {"action": "created", "page_id": page.id, "task_id": page.task_id},
    )

    return page


@router.post("/from-task/{task_id}", response_model=DocumentationPageOut)
def generate_documentation_from_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    require_project_permission(db, current_user.id, task.project_id, "AI_USE")

    if enum_value(task.status) != TaskStatus.DONE.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Documentation can only be generated after the task is Done.",
        )

    page = upsert_task_documentation_page(db, task, current_user.id)
    db.commit()
    db.refresh(page)
    broadcast_project_event(
        task.project_id,
        "documentation.changed",
        {"action": "generated", "page_id": page.id, "task_id": task.id},
    )

    return page


@router.get("/{page_id}", response_model=DocumentationPageOut)
def get_documentation_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = db.query(DocumentationPage).filter(DocumentationPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documentation page not found.")

    check_project_permission(db, current_user.id, page.project_id)
    return page


@router.get("/{page_id}/history", response_model=List[DocumentationRevisionOut])
def get_documentation_page_history(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = db.query(DocumentationPage).filter(DocumentationPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documentation page not found.")

    check_project_permission(db, current_user.id, page.project_id)
    return (
        db.query(DocumentationRevision)
        .filter(DocumentationRevision.page_id == page.id)
        .order_by(DocumentationRevision.created_at.desc(), DocumentationRevision.id.desc())
        .all()
    )


@router.put("/{page_id}", response_model=DocumentationPageOut)
def update_documentation_page(
    page_id: int,
    page_in: DocumentationPageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = db.query(DocumentationPage).filter(DocumentationPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documentation page not found.")

    require_project_permission(db, current_user.id, page.project_id, "TASK_UPDATE")

    update_data = page_in.model_dump(exclude_unset=True)
    changed = False

    if "task_id" in update_data:
        _ensure_task_belongs_to_project(db, page.project_id, update_data["task_id"])

    next_title = page.title
    next_content = page.content
    next_task_id = page.task_id

    if "title" in update_data and update_data["title"] is not None:
        next_title = update_data["title"].strip()

    if "content" in update_data and update_data["content"] is not None:
        next_content = update_data["content"]

    if "task_id" in update_data:
        next_task_id = update_data["task_id"]

    changed = (
        next_title != page.title
        or next_content != page.content
        or next_task_id != page.task_id
    )

    if changed:
        _snapshot_revision(db, page, actor_id=current_user.id, action="UPDATED")
        page.title = next_title
        page.content = next_content
        page.task_id = next_task_id

    db.commit()
    db.refresh(page)
    broadcast_project_event(
        page.project_id,
        "documentation.changed",
        {"action": "updated", "page_id": page.id, "task_id": page.task_id},
    )

    return page


@router.delete("/{page_id}")
def delete_documentation_page(
    page_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    page = db.query(DocumentationPage).filter(DocumentationPage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documentation page not found.")

    require_project_permission(db, current_user.id, page.project_id, "TASK_UPDATE")

    project_id = page.project_id
    page_id = page.id
    task_id = page.task_id
    _snapshot_revision(db, page, actor_id=current_user.id, action="DELETED")
    db.delete(page)
    db.commit()
    broadcast_project_event(
        project_id,
        "documentation.changed",
        {"action": "deleted", "page_id": page_id, "task_id": task_id},
    )

    return {"message": "Documentation page deleted."}
