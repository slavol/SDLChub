from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.session import Base

# --- PROIECTUL ---
class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    key = Column(String, nullable=False) # Ex: "APP"
    description = Column(Text, nullable=True)
    logo_url = Column(String, nullable=True)
    methodology = Column(String, default="SCRUM") # SCRUM, KANBAN, SCRUMBAN

    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relații
    owner = relationship("models.user.User", back_populates="owned_projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    roles = relationship("Role", back_populates="project", cascade="all, delete-orphan")
    invitations = relationship("Invitation", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project")
    sprints = relationship("Sprint", back_populates="project")

# --- MEMBRII ---
class ProjectMember(Base):
    __tablename__ = "project_members"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("models.user.User", back_populates="memberships")
    project = relationship("Project", back_populates="members")
    role = relationship("Role")

# --- ROLURI ---
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=False) 
    description = Column(String, nullable=True)
    permissions = Column(String, default="{}") 

    project = relationship("Project", back_populates="roles")

# --- INVITAȚII ---
class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    code = Column(String, unique=True, index=True)
    status = Column(String, default="PENDING")

    project = relationship("Project", back_populates="invitations")

# --- SPRINT ---
class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=False)
    goal = Column(Text, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="PLANNED") 

    project = relationship("Project", back_populates="sprints")

# --- TASK ---
class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="TODO") 
    priority = Column(String, default="MEDIUM")
    story_points = Column(Integer, nullable=True)
    risk_level = Column(String, default="LOW") 

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("models.user.User")