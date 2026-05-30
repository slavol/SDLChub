from pydantic import BaseModel, EmailStr
from typing import Optional

# Proprietăți comune
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

# Proprietăți necesare la înregistrare
class UserCreate(UserBase):
    password: str

# Proprietăți necesare la login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Proprietăți returnate către Frontend (FĂRĂ parolă)
class UserOut(UserBase):
    id: int
    is_active: bool
    is_global_admin: bool = False
    notification_in_app_enabled: bool = True
    notification_email_enabled: bool = True
    notify_task_assignments: bool = True
    notify_mentions: bool = True
    notify_calendar: bool = True
    notify_due_dates: bool = True
    notify_ai_risk: bool = True

    class Config:
        # Asta îi spune lui Pydantic să accepte obiecte SQLAlchemy
        from_attributes = True
