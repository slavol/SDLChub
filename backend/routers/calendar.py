import json
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.database.session import get_db
from backend.models.project import CalendarAvailability, CalendarEvent, ProjectMember
from backend.models.user import User
from backend.realtime import broadcast_project_event
from backend.routers.auth import get_current_user
from backend.schemas.calendar import (
    CalendarAvailabilityCreate,
    CalendarAvailabilityOut,
    CalendarAvailabilityUpdate,
    CalendarEventCreate,
    CalendarEventOut,
    CalendarEventUpdate,
)
from backend.utils.permissions import check_project_permission, member_has_permission, require_project_permission
from backend.utils.notifications import notify_calendar_attendees


router = APIRouter(prefix="/calendar", tags=["Calendar"])



AVAILABILITY_STATUSES = {"AVAILABLE", "UNAVAILABLE", "VACATION", "SICK_LEAVE", "FOCUS_TIME"}


def _normalize_availability_status(value: str | None) -> str:
    normalized = (value or "VACATION").strip().upper()
    if normalized not in AVAILABILITY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid availability status.",
        )
    return normalized


def _availability_to_out(block: CalendarAvailability) -> dict:
    return {
        "id": block.id,
        "project_id": block.project_id,
        "user_id": block.user_id,
        "user_name": block.user_name,
        "user_email": block.user_email,
        "user_avatar_url": block.user_avatar_url,
        "created_by_id": block.created_by_id,
        "created_by_name": block.created_by_name,
        "status": block.status,
        "title": block.title,
        "starts_at": block.starts_at,
        "ends_at": block.ends_at,
        "all_day": block.all_day,
        "note": block.note,
        "created_at": block.created_at,
        "updated_at": block.updated_at,
    }


def _ensure_user_is_project_member(db: Session, project_id: int, user_id: int) -> None:
    exists = (
        db.query(ProjectMember.id)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
        .first()
    )
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Availability can only be created for project members.",
        )


def _can_manage_availability(
    member: ProjectMember,
    current_user: User,
    block: CalendarAvailability,
) -> bool:
    if block.user_id == current_user.id or block.created_by_id == current_user.id:
        return True

    if not member or not member.project:
        return False

    return member_has_permission(member.project, member, current_user.id, "CALENDAR_UPDATE")


def _load_attendee_ids(raw_value: str | None) -> List[int]:
    if not raw_value:
        return []

    try:
        values = json.loads(raw_value)
    except json.JSONDecodeError:
        return []

    if not isinstance(values, list):
        return []

    return [int(value) for value in values if isinstance(value, int) or str(value).isdigit()]


def _dump_attendee_ids(values: List[int] | None) -> str:
    unique_ids = sorted({int(value) for value in values or [] if value})
    return json.dumps(unique_ids)


def _event_to_out(event: CalendarEvent) -> dict:
    return {
        "id": event.id,
        "project_id": event.project_id,
        "title": event.title,
        "description": event.description,
        "event_type": event.event_type,
        "starts_at": event.starts_at,
        "ends_at": event.ends_at,
        "location": event.location,
        "meeting_url": event.meeting_url,
        "attendee_ids": _load_attendee_ids(event.attendee_ids),
        "recurrence_series_id": event.recurrence_series_id,
        "recurrence_mode": event.recurrence_mode or "none",
        "recurrence_until": event.recurrence_until,
        "created_by_id": event.created_by_id,
        "created_by_name": event.created_by_name,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
    }


def _validate_date_range(starts_at: datetime, ends_at: datetime) -> None:
    if ends_at <= starts_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event end time must be after the start time.",
        )


def _build_recurring_starts(start: datetime, until: datetime | None, mode: str) -> list[datetime]:
    normalized_mode = (mode or "none").lower()
    if normalized_mode == "none":
        return [start]

    end_date = until or start
    if end_date < start:
        return [start]

    dates: list[datetime] = []
    cursor = start

    while cursor <= end_date and len(dates) < 60:
        weekday = cursor.weekday()

        if normalized_mode == "daily":
            dates.append(cursor)
            cursor = cursor + timedelta(days=1)
            continue

        if normalized_mode == "weekdays":
            if weekday < 5:
                dates.append(cursor)
            cursor = cursor + timedelta(days=1)
            continue

        if normalized_mode == "weekly":
            dates.append(cursor)
            cursor = cursor + timedelta(days=7)
            continue

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recurrence mode.",
        )

    return dates or [start]


def _ensure_attendees_are_members(db: Session, project_id: int, attendee_ids: List[int]) -> None:
    if not attendee_ids:
        return

    member_ids = {
        row.user_id
        for row in db.query(ProjectMember.user_id)
        .filter(ProjectMember.project_id == project_id)
        .all()
    }

    missing_ids = sorted(set(attendee_ids) - member_ids)
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All attendees must be members of this project.",
        )


def _can_manage_event(member: ProjectMember, current_user: User, event: CalendarEvent, permission_key: str) -> bool:
    if event.created_by_id == current_user.id:
        return True

    if not member or not member.project:
        return False

    return member_has_permission(member.project, member, current_user.id, permission_key)



@router.get("/project/{project_id}/availability", response_model=List[CalendarAvailabilityOut])
def get_project_calendar_availability(
    project_id: int,
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    query = db.query(CalendarAvailability).filter(CalendarAvailability.project_id == project_id)

    if start:
        query = query.filter(CalendarAvailability.ends_at >= start)
    if end:
        query = query.filter(CalendarAvailability.starts_at <= end)
    if user_id:
        query = query.filter(CalendarAvailability.user_id == user_id)

    blocks = query.order_by(CalendarAvailability.starts_at.asc()).all()
    return [_availability_to_out(block) for block in blocks]


@router.post("/project/{project_id}/availability", response_model=CalendarAvailabilityOut)
def create_project_calendar_availability(
    project_id: int,
    data: CalendarAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    member = check_project_permission(db, current_user.id, project_id)

    target_user_id = data.user_id or current_user.id
    _ensure_user_is_project_member(db, project_id, target_user_id)

    if target_user_id != current_user.id and not member_has_permission(
        member.project,
        member,
        current_user.id,
        "CALENDAR_UPDATE",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing project permission: CALENDAR_UPDATE.",
        )

    _validate_date_range(data.starts_at, data.ends_at)

    block = CalendarAvailability(
        project_id=project_id,
        user_id=target_user_id,
        created_by_id=current_user.id,
        status=_normalize_availability_status(data.status),
        title=(data.title or "").strip() or None,
        starts_at=data.starts_at,
        ends_at=data.ends_at,
        all_day=bool(data.all_day),
        note=(data.note or "").strip() or None,
    )

    db.add(block)
    db.commit()
    db.refresh(block)

    broadcast_project_event(
        project_id,
        "calendar.changed",
        {"action": "availability_created", "availability_id": block.id, "user_id": block.user_id},
    )

    return _availability_to_out(block)


@router.put("/availability/{availability_id}", response_model=CalendarAvailabilityOut)
def update_project_calendar_availability(
    availability_id: int,
    data: CalendarAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    block = db.query(CalendarAvailability).filter(CalendarAvailability.id == availability_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability block not found.")

    member = check_project_permission(db, current_user.id, block.project_id)

    if not _can_manage_availability(member, current_user, block):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing project permission: CALENDAR_UPDATE.",
        )

    update_data = data.model_dump(exclude_unset=True)

    if "user_id" in update_data:
        next_user_id = update_data["user_id"] or block.user_id
        if next_user_id != block.user_id:
            if not member_has_permission(member.project, member, current_user.id, "CALENDAR_UPDATE"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Missing project permission: CALENDAR_UPDATE.",
                )
            _ensure_user_is_project_member(db, block.project_id, next_user_id)
            block.user_id = next_user_id

    if "status" in update_data:
        block.status = _normalize_availability_status(update_data["status"])

    if "title" in update_data:
        block.title = (update_data["title"] or "").strip() or None

    if "note" in update_data:
        block.note = (update_data["note"] or "").strip() or None

    if "all_day" in update_data:
        block.all_day = bool(update_data["all_day"])

    starts_at = update_data.get("starts_at", block.starts_at)
    ends_at = update_data.get("ends_at", block.ends_at)
    _validate_date_range(starts_at, ends_at)

    if "starts_at" in update_data:
        block.starts_at = starts_at
    if "ends_at" in update_data:
        block.ends_at = ends_at

    db.commit()
    db.refresh(block)

    broadcast_project_event(
        block.project_id,
        "calendar.changed",
        {"action": "availability_updated", "availability_id": block.id, "user_id": block.user_id},
    )

    return _availability_to_out(block)


@router.delete("/availability/{availability_id}")
def delete_project_calendar_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    block = db.query(CalendarAvailability).filter(CalendarAvailability.id == availability_id).first()
    if not block:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Availability block not found.")

    member = check_project_permission(db, current_user.id, block.project_id)

    if not _can_manage_availability(member, current_user, block):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing project permission: CALENDAR_UPDATE.",
        )

    project_id = block.project_id
    deleted_id = block.id
    db.delete(block)
    db.commit()

    broadcast_project_event(
        project_id,
        "calendar.changed",
        {"action": "availability_deleted", "availability_id": deleted_id},
    )

    return {"message": "Availability block deleted."}


@router.get("/project/{project_id}", response_model=List[CalendarEventOut])
def get_project_calendar_events(
    project_id: int,
    start: Optional[datetime] = Query(None),
    end: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_project_permission(db, current_user.id, project_id)

    query = db.query(CalendarEvent).filter(CalendarEvent.project_id == project_id)

    if start:
        query = query.filter(CalendarEvent.ends_at >= start)
    if end:
        query = query.filter(CalendarEvent.starts_at <= end)

    events = query.order_by(CalendarEvent.starts_at.asc()).all()
    return [_event_to_out(event) for event in events]


@router.post("/project/{project_id}", response_model=CalendarEventOut)
def create_project_calendar_event(
    project_id: int,
    event_in: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_project_permission(db, current_user.id, project_id, "CALENDAR_CREATE")
    _validate_date_range(event_in.starts_at, event_in.ends_at)
    _ensure_attendees_are_members(db, project_id, event_in.attendee_ids)

    attendee_ids = set(event_in.attendee_ids)
    attendee_ids.add(current_user.id)

    recurrence_mode = (event_in.recurrence_mode or "none").lower()
    duration = event_in.ends_at - event_in.starts_at
    start_dates = _build_recurring_starts(event_in.starts_at, event_in.recurrence_until, recurrence_mode)
    recurrence_series_id = str(uuid.uuid4()) if recurrence_mode != "none" and len(start_dates) > 1 else None
    created_events: list[CalendarEvent] = []

    for start_date in start_dates:
        event = CalendarEvent(
            project_id=project_id,
            title=event_in.title.strip(),
            description=event_in.description,
            event_type=event_in.event_type,
            starts_at=start_date,
            ends_at=start_date + duration,
            location=event_in.location,
            meeting_url=event_in.meeting_url,
            attendee_ids=_dump_attendee_ids(list(attendee_ids)),
            recurrence_series_id=recurrence_series_id,
            recurrence_mode=recurrence_mode,
            recurrence_until=event_in.recurrence_until if recurrence_mode != "none" else None,
            created_by_id=current_user.id,
        )
        db.add(event)
        created_events.append(event)

    db.commit()
    new_event = created_events[0]
    db.refresh(new_event)

    notify_calendar_attendees(db, new_event, attendee_ids, current_user)
    db.commit()
    db.refresh(new_event)
    broadcast_project_event(
        new_event.project_id,
        "calendar.changed",
        {
            "action": "created",
            "event_id": new_event.id,
            "recurrence_series_id": recurrence_series_id,
            "created_count": len(created_events),
        },
    )

    return _event_to_out(new_event)


@router.put("/{event_id}", response_model=CalendarEventOut)
def update_calendar_event(
    event_id: int,
    event_in: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    member = check_project_permission(db, current_user.id, event.project_id)
    if not _can_manage_event(member, current_user, event, "CALENDAR_UPDATE"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing project permission: CALENDAR_UPDATE.")

    update_data = event_in.model_dump(exclude_unset=True)
    old_attendee_ids = set(_load_attendee_ids(event.attendee_ids))
    new_attendee_ids: set[int] = set()

    starts_at = update_data.get("starts_at", event.starts_at)
    ends_at = update_data.get("ends_at", event.ends_at)
    _validate_date_range(starts_at, ends_at)

    if "attendee_ids" in update_data:
        requested_attendee_ids = set(update_data["attendee_ids"] or [])
        _ensure_attendees_are_members(db, event.project_id, list(requested_attendee_ids))
        new_attendee_ids = requested_attendee_ids - old_attendee_ids
        update_data["attendee_ids"] = _dump_attendee_ids(list(requested_attendee_ids))

    update_data.pop("recurrence_mode", None)
    update_data.pop("recurrence_until", None)

    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    if new_attendee_ids:
        notify_calendar_attendees(db, event, new_attendee_ids, current_user)
        db.commit()
        db.refresh(event)

    broadcast_project_event(
        event.project_id,
        "calendar.changed",
        {"action": "updated", "event_id": event.id},
    )

    return _event_to_out(event)


@router.delete("/{event_id}")
def delete_calendar_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    member = check_project_permission(db, current_user.id, event.project_id)
    if not _can_manage_event(member, current_user, event, "CALENDAR_DELETE"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing project permission: CALENDAR_DELETE.")

    project_id = event.project_id
    db.delete(event)
    db.commit()
    broadcast_project_event(
        project_id,
        "calendar.changed",
        {"action": "deleted", "event_id": event_id},
    )

    return {"message": "Calendar event deleted"}


@router.delete("/{event_id}/series")
def delete_calendar_event_series(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar event not found")

    member = check_project_permission(db, current_user.id, event.project_id)
    if not _can_manage_event(member, current_user, event, "CALENDAR_DELETE"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing project permission: CALENDAR_DELETE.")

    project_id = event.project_id
    series_id = event.recurrence_series_id

    if not series_id:
        db.delete(event)
        deleted = 1
    else:
        deleted = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.project_id == project_id,
                CalendarEvent.recurrence_series_id == series_id,
            )
            .delete(synchronize_session=False)
        )

    db.commit()
    broadcast_project_event(
        project_id,
        "calendar.changed",
        {"action": "series_deleted", "event_id": event_id, "recurrence_series_id": series_id, "deleted": deleted},
    )

    return {"message": "Calendar event series deleted.", "deleted": deleted}
