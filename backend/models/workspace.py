from sqlalchemy import Column, Integer, String, ForeignKey, JSON, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.session import Base
from .enums import InvitationStatus

# 1. Organizația (Firma/Echipa mare)
class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id")) # Creatorul workspace-ului
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")

# 2. Roluri Customizabile per Workspace
class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    name = Column(String, nullable=False) # ex: "Junior Dev", "Project Manager"
    
    # JSON cu permisiuni granulare
    # ex: {"can_delete_task": false, "can_manage_users": true}
    permissions = Column(JSON, default={}) 

    workspace = relationship("Workspace")

# 3. Tabelul de legătură (User <-> Workspace)
class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id")) # Ce rol are userul aici

    user = relationship("User")
    workspace = relationship("Workspace")
    role = relationship("Role")

# 4. Invitații (Sistemul de mail/cod)
class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, index=True, nullable=False)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    
    token = Column(String, unique=True, index=True) # Codul din link
    code_manual = Column(String, nullable=True) # Codul scurt pt input manual (ex: TEAM-99)
    
    status = Column(Enum(InvitationStatus), default=InvitationStatus.PENDING)
    expires_at = Column(DateTime)