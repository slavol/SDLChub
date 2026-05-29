from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.database.session import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reporter_email = Column(String, nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="MEDIUM", nullable=False)
    status = Column(String, default="OPEN", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    reporter = relationship("User", foreign_keys=[reporter_id])
    comments = relationship(
        "SupportTicketComment",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="SupportTicketComment.created_at",
    )

    @property
    def reporter_name(self):
        return self.reporter.full_name if self.reporter else None

    @property
    def comments_count(self):
        return len(self.comments or [])


class SupportTicketComment(Base):
    __tablename__ = "support_ticket_comments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)
    is_admin_note = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("SupportTicket", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])

    @property
    def author_name(self):
        return self.author.full_name if self.author else None

    @property
    def author_email(self):
        return self.author.email if self.author else None


class HttpErrorLog(Base):
    __tablename__ = "http_error_logs"

    id = Column(Integer, primary_key=True, index=True)
    method = Column(String, nullable=False)
    path = Column(String, nullable=False)
    status_code = Column(Integer, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])

    @property
    def user_name(self):
        return self.user.full_name if self.user else None


class AiUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    feature = Column(String, nullable=False)
    provider = Column(String, default="gemini", nullable=False)
    source = Column(String, nullable=True)
    status = Column(String, default="SUCCESS", nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
    project = relationship("Project", foreign_keys=[project_id])

    @property
    def user_name(self):
        return self.user.full_name if self.user else None

    @property
    def project_name(self):
        return self.project.name if self.project else None
