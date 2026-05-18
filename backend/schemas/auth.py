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
