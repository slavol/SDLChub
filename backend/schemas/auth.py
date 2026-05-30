from typing import Optional

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class AuthUser(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
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
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    has_pending_invites: bool = False
    user: AuthUser


class TokenData(BaseModel):
    email: Optional[str] = None
    id: Optional[int] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class AccountUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None


class AccountPasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str


class AccountNotificationPreferencesUpdate(BaseModel):
    notification_in_app_enabled: Optional[bool] = None
    notification_email_enabled: Optional[bool] = None
    notify_task_assignments: Optional[bool] = None
    notify_mentions: Optional[bool] = None
    notify_calendar: Optional[bool] = None
    notify_due_dates: Optional[bool] = None
    notify_ai_risk: Optional[bool] = None
