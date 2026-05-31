from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func

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



class GitHubProjectIntegration(Base):
    __tablename__ = "github_project_integrations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    repository_full_name = Column(String, nullable=False, index=True)
    repository_url = Column(String, nullable=True)
    default_branch = Column(String, nullable=True, default="main")

    webhook_url = Column(String, nullable=True)
    webhook_secret_hint = Column(String, nullable=True)
    setup_status = Column(String, nullable=False, default="CONFIGURED")

    auto_link_commits = Column(Boolean, nullable=False, default=True)
    auto_transition_prs = Column(Boolean, nullable=False, default=True)

    last_ping_at = Column(DateTime(timezone=True), nullable=True)
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
