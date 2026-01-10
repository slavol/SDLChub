import enum
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.session import Base

# --- MODELS EXISTENTE ---

class Project(Base):
    __tablename__ = "projects"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    key = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    methodology = Column(String, default="SCRUM")
    owner_id = Column(Integer, ForeignKey("users.id")) # <--- Asta exista deja
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- RELAȚII ---
    # Adaugă linia asta pentru a lega owner_id de modelul User
    owner = relationship("User", foreign_keys=[owner_id]) 

    members = relationship("ProjectMember", back_populates="project")
    invitations = relationship("Invitation", back_populates="project")
    roles = relationship("Role", back_populates="project")
    tasks = relationship("Task", back_populates="project")
    sprints = relationship("Sprint", back_populates="project")

class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="memberships")
    project = relationship("Project", back_populates="members")
    role = relationship("Role")

class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    permissions = Column(String, default="{}") 

    project = relationship("Project", back_populates="roles")

class Invitation(Base):
    __tablename__ = "invitations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    code = Column(String, unique=True, index=True)
    status = Column(String, default="PENDING") 
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="invitations")

# --- MODELE NOI (TASK & SPRINT) ---

class TaskPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class TaskStatus(str, enum.Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEW = "REVIEW"
    DONE = "DONE"

class Sprint(Base):
    __tablename__ = "sprints"
    __table_args__ = {'extend_existing': True} # <--- Fix critic

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String) 
    goal = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=False)
    
    project = relationship("Project", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")

class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = {'extend_existing': True} # <--- Fix critic

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True) 
    title = Column(String)
    description = Column(Text, nullable=True)
    
    status = Column(Enum(TaskStatus), default=TaskStatus.TODO)
    priority = Column(Enum(TaskPriority), default=TaskPriority.MEDIUM)
    story_points = Column(Integer, nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks")
    sprint = relationship("Sprint", back_populates="tasks")