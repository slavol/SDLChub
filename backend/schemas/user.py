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

    class Config:
        # Asta îi spune lui Pydantic să accepte obiecte SQLAlchemy
        from_attributes = True
