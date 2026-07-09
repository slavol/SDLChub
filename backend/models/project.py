import enum
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Text, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database.session import Base

# --- MODELS EXISTENTE ---

class Project(Base):
    __tablename__ = "projects"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    key = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    methodology = Column(String, default="SCRUM")
    workflow_config = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    ai_provider_mode = Column(String, default="PLATFORM", nullable=False)
    ai_provider = Column(String, default="OLLAMA", nullable=False)
    ai_provider_name = Column(String, nullable=True)
    ai_base_url = Column(String, nullable=True)
    ai_model = Column(String, nullable=True)
    ai_api_key_encrypted = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id")) # <--- Asta exista deja
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- RELAȚII ---
    # Adaugă linia asta pentru a lega owner_id de modelul User
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_projects") 

    members = relationship("ProjectMember", back_populates="project")
    invitations = relationship("Invitation", back_populates="project")
    roles = relationship("Role", back_populates="project")
    teams = relationship("ProjectTeam", back_populates="project")
    tasks = relationship("Task", back_populates="project")
    sprints = relationship("Sprint", back_populates="project")
    calendar_events = relationship("CalendarEvent", back_populates="project", cascade="all, delete-orphan")
    availability_blocks = relationship("CalendarAvailability", back_populates="project", cascade="all, delete-orphan")
    audit_logs = relationship("ProjectAuditLog", back_populates="project", cascade="all, delete-orphan", order_by="ProjectAuditLog.created_at")

class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("project_teams.id"), nullable=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="memberships")
    project = relationship("Project", back_populates="members")
    role = relationship("Role")
    team = relationship("ProjectTeam", back_populates="members", foreign_keys=[team_id])

class Role(Base):
    __tablename__ = "roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    permissions = Column(String, default="{}") 

    project = relationship("Project", back_populates="roles")


class ProjectTeam(Base):
    __tablename__ = "project_teams"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    parent_id = Column(Integer, ForeignKey("project_teams.id"), nullable=True)
    manager_membership_id = Column(Integer, ForeignKey("project_members.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="teams")
    parent = relationship("ProjectTeam", remote_side=[id], back_populates="children")
    children = relationship("ProjectTeam", back_populates="parent")
    manager = relationship("ProjectMember", foreign_keys=[manager_membership_id], post_update=True)
    members = relationship("ProjectMember", back_populates="team", foreign_keys="ProjectMember.team_id")
    tasks = relationship("Task", back_populates="team")

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
    role = relationship("Role", foreign_keys=[role_id])

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
    due_date = Column(DateTime, nullable=True)
    
    project_id = Column(Integer, ForeignKey("projects.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("project_teams.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", back_populates="assigned_tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    team = relationship("ProjectTeam", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.id")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan", order_by="TaskComment.created_at")
    audit_logs = relationship("TaskAuditLog", back_populates="task", cascade="all, delete-orphan", order_by="TaskAuditLog.created_at")

    @property
    def assignee_name(self):
        return self.assignee.full_name if self.assignee else None

    @property
    def assignee_avatar_url(self):
        return self.assignee.avatar_url if self.assignee else None

    @property
    def team_name(self):
        return self.team.name if self.team else None

class Subtask(Base):
    __tablename__ = "subtasks"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    title = Column(String)
    is_done = Column(Boolean, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    task = relationship("Task", back_populates="subtasks")
    created_by = relationship("User", foreign_keys=[created_by_id])

    @property
    def created_by_name(self):
        return self.created_by.full_name if self.created_by else None

class TaskComment(Base):
    __tablename__ = "task_comments"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    author_id = Column(Integer, ForeignKey("users.id"))
    body = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    task = relationship("Task", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])

    @property
    def author_name(self):
        return self.author.full_name if self.author else None

    @property
    def author_avatar_url(self):
        return self.author.avatar_url if self.author else None

class TaskAuditLog(Base):
    __tablename__ = "task_audit_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String)
    field = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    task = relationship("Task", back_populates="audit_logs")
    actor = relationship("User", foreign_keys=[actor_id])

    @property
    def actor_name(self):
        return self.actor.full_name if self.actor else None

    @property
    def actor_avatar_url(self):
        return self.actor.avatar_url if self.actor else None


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String, default="MEETING")
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    location = Column(String, nullable=True)
    meeting_url = Column(String, nullable=True)
    attendee_ids = Column(Text, default="[]")
    recurrence_series_id = Column(String, nullable=True, index=True)
    recurrence_mode = Column(String, default="none")
    recurrence_until = Column(DateTime, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="calendar_events")
    created_by = relationship("User", foreign_keys=[created_by_id])

    @property
    def created_by_name(self):
        return self.created_by.full_name if self.created_by else None


class CalendarAvailability(Base):
    __tablename__ = "calendar_availability"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="VACATION", nullable=False)
    title = Column(String, nullable=True)
    starts_at = Column(DateTime, nullable=False)
    ends_at = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=True, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="availability_blocks")
    user = relationship("User", foreign_keys=[user_id])
    created_by = relationship("User", foreign_keys=[created_by_id])

    @property
    def user_name(self):
        return self.user.full_name if self.user else None

    @property
    def user_email(self):
        return self.user.email if self.user else None

    @property
    def user_avatar_url(self):
        return self.user.avatar_url if self.user else None

    @property
    def created_by_name(self):
        return self.created_by.full_name if self.created_by else None


class ProjectAuditLog(Base):
    __tablename__ = "project_audit_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String)
    field = Column(String, nullable=True)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", back_populates="audit_logs")
    actor = relationship("User", foreign_keys=[actor_id])

    @property
    def actor_name(self):
        return self.actor.full_name if self.actor else None
