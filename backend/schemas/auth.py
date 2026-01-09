from pydantic import BaseModel, EmailStr
from typing import Optional

# Ce primim la Înregistrare
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

# Ce primim la Login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Ce returnăm după Login (Token-ul)
class Token(BaseModel):
    access_token: str
    token_type: str
    has_pending_invites: bool = False # Flag pentru Frontend (Fluxul A)

# Datele din Token decodat
class TokenData(BaseModel):
    email: Optional[str] = None
    id: Optional[int] = None

# --- SCHEME PENTRU RESET ---
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str