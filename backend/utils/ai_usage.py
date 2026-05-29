from sqlalchemy.orm import Session

from backend.models.admin import AiUsageLog


def record_ai_usage(
    db: Session,
    *,
    user_id: int | None,
    feature: str,
    project_id: int | None = None,
    source: str | None = None,
    status: str = "SUCCESS",
    detail: str | None = None,
) -> None:
    try:
        db.add(
            AiUsageLog(
                user_id=user_id,
                project_id=project_id,
                feature=feature,
                provider="gemini",
                source=source,
                status=status,
                detail=detail,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
