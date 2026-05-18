from backend.routers.activity import router as activity_router
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import get_settings
from backend.routers import auth, calendar, projects, sprints, tasks


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

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(sprints.router)
app.include_router(calendar.router)
app.include_router(activity_router)


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
