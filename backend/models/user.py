from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
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
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    security_logs = relationship("UserSecurityLog", back_populates="user", cascade="all, delete-orphan")



class UserSession(Base):
    __tablename__ = "user_sessions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_family = Column(String, nullable=True, index=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    device_label = Column(String, nullable=True)
    location_hint = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    revoke_reason = Column(String, nullable=True)

    user = relationship("User", back_populates="sessions")


class UserSecurityLog(Base):
    __tablename__ = "user_security_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("user_sessions.id"), nullable=True, index=True)
    event_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    detail = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="security_logs")
    session = relationship("UserSession", foreign_keys=[session_id])
