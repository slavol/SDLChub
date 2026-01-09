from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Enum, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.session import Base
from .enums import Methodology

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    name = Column(String, nullable=False)
    key = Column(String, nullable=False) # ex: "JIRA"
    description = Column(Text, nullable=True)
    
    # Engine-ul Polimorf
    methodology = Column(Enum(Methodology), default=Methodology.SCRUM)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relații
    workspace = relationship("Workspace")
    sprints = relationship("Sprint", back_populates="project")
    tasks = relationship("Task", back_populates="project")

class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=False) # ex: "Sprint 1"
    goal = Column(Text, nullable=True)
    
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # Status: PLANNED, ACTIVE, COMPLETED
    status = Column(String, default="PLANNED") 
    
    project = relationship("Project", back_populates="sprints")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True) # Null in Kanban
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    
    status = Column(String, default="TODO") # TODO, IN_PROGRESS, DONE
    priority = Column(String, default="MEDIUM")
    story_points = Column(Integer, nullable=True)
    
    project = relationship("Project", back_populates="tasks")
    assignee = relationship("models.user.User")