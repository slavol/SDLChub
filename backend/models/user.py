from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from database.session import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    # Relații
    owned_projects = relationship("models.project.Project", back_populates="owner")
    memberships = relationship("models.project.ProjectMember", back_populates="user")
    assigned_tasks = relationship("Task", back_populates="assignee")