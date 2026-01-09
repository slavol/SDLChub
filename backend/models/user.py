from sqlalchemy import Column, Integer, String, Boolean, Enum, DateTime
from sqlalchemy.sql import func
from database.session import Base
from .enums import GlobalRole

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String)
    avatar_url = Column(String, nullable=True)
    
    # Rol global (pentru administrarea platformei SaaS)
    global_role = Column(Enum(GlobalRole), default=GlobalRole.USER)
    
    is_active = Column(Boolean, default=True) # Devine true după confirmare mail
    created_at = Column(DateTime(timezone=True), server_default=func.now())