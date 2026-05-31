from pathlib import Path
import asyncio
import json
from contextlib import suppress
from time import monotonic

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from jose import JWTError, jwt

from backend.config import get_settings
from backend.database.session import SessionLocal
from backend.models.admin import HttpErrorLog
from backend.models.project import Project, ProjectMember
from backend.models.user import User
from backend.realtime import realtime_manager
from backend.routers import admin, auth, calendar, documentation, github, notifications, projects, sprints, tasks, teams
from backend.routers.activity import router as activity_router
from backend.utils.notifications import generate_calendar_event_reminders, generate_due_task_reminders
from backend.utils.security import ALGORITHM, SECRET_KEY


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

def _get_request_user_id(request: Request) -> int | None:
    auth_header = request.headers.get("authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        return None

    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

    user_id = payload.get("id")
    return int(user_id) if user_id is not None else None


@app.middleware("http")
async def log_http_errors(request: Request, call_next):
    response = await call_next(request)

    if response.status_code >= 400 and request.url.path != "/health":
        db = SessionLocal()
        try:
            db.add(
                HttpErrorLog(
                    method=request.method,
                    path=request.url.path,
                    status_code=response.status_code,
                    user_id=_get_request_user_id(request),
                )
            )
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    return response


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(sprints.router)
app.include_router(calendar.router)
app.include_router(teams.router)
app.include_router(activity_router)
app.include_router(notifications.router)
app.include_router(documentation.router)
app.include_router(github.router)


@app.on_event("startup")
async def configure_realtime_loop():
    realtime_manager.set_loop(asyncio.get_running_loop())

    if settings.enable_notification_scheduler:
        app.state.notification_reminder_task = asyncio.create_task(
            notification_reminder_loop()
        )


@app.on_event("shutdown")
async def shutdown_background_jobs():
    reminder_task = getattr(app.state, "notification_reminder_task", None)

    if reminder_task:
        reminder_task.cancel()
        with suppress(asyncio.CancelledError):
            await reminder_task


async def notification_reminder_loop():
    initial_delay = max(0, settings.notification_scheduler_initial_delay_seconds)
    interval = max(60, settings.notification_scheduler_interval_seconds)

    await asyncio.sleep(initial_delay)

    while True:
        db = SessionLocal()
        try:
            created = generate_due_task_reminders(db)
            created += generate_calendar_event_reminders(db)
            db.commit()
            if created:
                print(f"Notification scheduler created {created} reminders.")
        except Exception as exc:
            db.rollback()
            print(f"Notification scheduler error: {exc}")
        finally:
            db.close()

        await asyncio.sleep(interval)


def _get_websocket_context(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        return None

    if not email:
        return None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            return None

        member_project_ids = {
            row[0]
            for row in db.query(ProjectMember.project_id)
            .filter(ProjectMember.user_id == user.id)
            .all()
        }
        owned_project_ids = {
            row[0]
            for row in db.query(Project.id)
            .filter(Project.owner_id == user.id)
            .all()
        }

        return {
            "user_id": user.id,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "project_ids": member_project_ids | owned_project_ids,
        }
    finally:
        db.close()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    context = _get_websocket_context(token or "")

    if context is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await realtime_manager.connect(
        websocket,
        user_id=context["user_id"],
        project_ids=context["project_ids"],
    )

    try:
        await websocket.send_json({"type": "connected", "payload": {"project_ids": list(context["project_ids"])}})
        last_typing_events: dict[tuple[int, int], float] = {}

        while True:
            message = await websocket.receive_text()
            if message == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
                continue

            try:
                realtime_message = json.loads(message)
            except json.JSONDecodeError:
                continue

            if not isinstance(realtime_message, dict):
                continue

            if realtime_message.get("type") != "comment.typing":
                continue

            payload = realtime_message.get("payload") or {}
            if not isinstance(payload, dict):
                continue

            try:
                project_id = int(realtime_message.get("project_id") or payload.get("project_id") or 0)
                task_id = int(payload.get("task_id") or 0)
            except (TypeError, ValueError):
                continue

            if project_id not in context["project_ids"] or task_id <= 0:
                continue

            is_typing = bool(payload.get("is_typing", True))
            now = monotonic()
            throttle_key = (project_id, task_id)

            if is_typing and now - last_typing_events.get(throttle_key, 0) < 1.0:
                continue

            last_typing_events[throttle_key] = now

            await realtime_manager.send_to_project(
                project_id,
                {
                    "type": "comment.typing",
                    "project_id": project_id,
                    "payload": {
                        "task_id": task_id,
                        "user_id": context["user_id"],
                        "full_name": context.get("full_name"),
                        "avatar_url": context.get("avatar_url"),
                        "is_typing": is_typing,
                    },
                },
            )
    except WebSocketDisconnect:
        await realtime_manager.disconnect(websocket)
    except Exception:
        await realtime_manager.disconnect(websocket)


@app.get("/")
def read_root():
    return {
        "message": "SDLC AI Hub API is running 🚀",
        "environment": settings.environment,
        "version": settings.app_version,
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
    }
