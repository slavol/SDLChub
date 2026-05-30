from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from backend.database.session import Base


class GitHubEvent(Base):
    __tablename__ = "github_events"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(String, unique=True, nullable=True, index=True)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True, index=True)
    mapped_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    event_type = Column(String, nullable=False, index=True)
    action = Column(String, nullable=True)
    repository = Column(String, nullable=True)
    sender_login = Column(String, nullable=True)

    task_key = Column(String, nullable=True, index=True)
    commit_sha = Column(String, nullable=True)
    pull_request_number = Column(Integer, nullable=True)
    url = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    payload_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
