from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func

from backend.database.session import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True, index=True)

    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    link_url = Column(String, nullable=True)
    metadata_json = Column(Text, nullable=True)

    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
