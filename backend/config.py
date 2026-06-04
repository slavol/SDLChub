from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV = BASE_DIR / ".env"
BACKEND_ENV = BASE_DIR / "backend" / ".env"


def load_environment() -> None:
    """
    Load both repo-level and backend-local env files consistently.

    Priority:
    - existing OS env variables stay untouched
    - root .env is loaded first
    - backend/.env fills missing values after that
    """
    load_dotenv(ROOT_ENV, override=False)
    load_dotenv(BACKEND_ENV, override=False)


class Settings(BaseSettings):
    # App
    app_name: str = "SDLC Hub API"
    app_version: str = "2.0"
    environment: str = "development"
    frontend_url: str = "http://127.0.0.1:3000"

    # Database
    database_url: str = "postgresql+psycopg2://sdlc_user:sdlc_password@127.0.0.1:5432/sdlchub"

    # Security
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Mail
    mail_username: str | None = None
    mail_password: str | None = None
    mail_from: str | None = None
    mail_port: int = 587
    mail_server: str | None = None
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    use_credentials: bool = True
    validate_certs: bool = True
    mail_timeout: int = 20

    # AI
    gemini_api_key: str | None = None

    # GitHub
    github_webhook_secret: str | None = None

    # Background jobs
    enable_notification_scheduler: bool = True
    notification_scheduler_interval_seconds: int = 900
    notification_scheduler_initial_delay_seconds: int = 10

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), str(BACKEND_ENV)),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    load_environment()
    return Settings()
