from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from backend.database.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    github_username = Column(String, nullable=True, index=True)
    avatar_url = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_global_admin = Column(Boolean, default=False, nullable=False)
    notification_in_app_enabled = Column(Boolean, default=True, nullable=False)
    notification_email_enabled = Column(Boolean, default=True, nullable=False)
    notify_task_assignments = Column(Boolean, default=True, nullable=False)
    notify_mentions = Column(Boolean, default=True, nullable=False)
    notify_calendar = Column(Boolean, default=True, nullable=False)
    notify_due_dates = Column(Boolean, default=True, nullable=False)
    notify_ai_risk = Column(Boolean, default=True, nullable=False)

    owned_projects = relationship("Project", back_populates="owner")
    memberships = relationship("ProjectMember", back_populates="user")
    assigned_tasks = relationship("Task", back_populates="assignee")
    calendar_events = relationship("CalendarEvent", back_populates="created_by")
    project_audit_logs = relationship("ProjectAuditLog", back_populates="actor")
