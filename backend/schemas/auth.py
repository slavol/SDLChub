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

# Ce returnăm (Token-ul)
class Token(BaseModel):
    access_token: str
    token_type: str

# Structura datelor din Token (payload)
class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None