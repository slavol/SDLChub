from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import timedelta
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr # <--- Importuri necesare

from backend.database.session import get_db
from backend.models.user import User
from backend.models.project import Invitation, Project, ProjectMember
from backend.schemas.auth import (
    AccountPasswordUpdateRequest,
    AccountUpdateRequest,
    AuthUser,
    PasswordResetConfirm,
    PasswordResetRequest,
    ResendVerificationRequest,
    Token,
    TokenData,
    UserLogin,
    UserRegister,
)
from backend.utils.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    ACCESS_TOKEN_EXPIRE_MINUTES,
    SECRET_KEY,
    ALGORITHM
)
from backend.utils.email import (
    send_verification_email, 
    create_verification_token, 
    send_reset_password_email, 
    create_reset_token,
    build_frontend_link,
    is_email_enabled
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# --- ENDPOINTS ---

@router.post("/register")
async def register(
    user_data: UserRegister, 
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        is_active=False 
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    verification_token = create_verification_token(new_user.email)
    response = {"message": "Registration successful. Please check your email to activate your account."}

    if is_email_enabled():
        try:
            await send_verification_email(new_user.email, verification_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Account created, but verification email could not be sent: {exc}",
            ) from exc
    else:
        response = {
            "message": "Registration successful. SMTP is disabled, use the development verification link.",
            "dev_verification_url": build_frontend_link("/verify-email", verification_token),
        }
    
    return response

@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        return {"message": "If the account exists and is inactive, a verification email has been sent."}

    if user.is_active:
        return {"message": "Account is already active. You can login."}

    verification_token = create_verification_token(user.email)
    if is_email_enabled():
        try:
            await send_verification_email(user.email, verification_token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Verification email could not be sent: {exc}",
            ) from exc
        return {"message": "Verification email sent. Please check your inbox."}

    return {
        "message": "SMTP is disabled, use the development verification link.",
        "dev_verification_url": build_frontend_link("/verify-email", verification_token),
    }

@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired verification token",
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "email_verification":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_active:
        return {"message": "Account already activated. You can login."}
        
    user.is_active = True
    db.commit()
    
    return {"message": "Account successfully activated!"}

@router.post("/login", response_model=Token)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_credentials.email).first()

    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Please check your email.",
        )

    pending_invite = db.query(Invitation).filter(
        Invitation.email == user.email,
        Invitation.status == "PENDING",
    ).first()

    has_invites = pending_invite is not None

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "id": user.id,
            "full_name": user.full_name,
        },
        expires_delta=access_token_expires,
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "has_pending_invites": has_invites,
        "user": user,
    }


# --- FORGOT PASSWORD ---
@router.post("/forgot-password")
async def forgot_password(
    request: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        # Returnăm success fals pentru securitate
        return {"message": "If the email exists, a reset link has been sent."}
    
    token = create_reset_token(user.email)
    if is_email_enabled():
        try:
            await send_reset_password_email(user.email, token)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Reset email could not be sent: {exc}",
            ) from exc
        return {"message": "If the email exists, a reset link has been sent."}
    
    return {
        "message": "SMTP is disabled, use the development reset link.",
        "dev_reset_url": build_frontend_link("/reset-password", token),
    }

# --- RESET PASSWORD ---
@router.post("/reset-password")
def reset_password(
    data: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid or expired token",
    )
    
    try:
        payload = jwt.decode(data.token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if email is None or token_type != "password_reset":
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise credentials_exception
        
    user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    
    return {"message": "Password updated successfully! You can now login."}

# --- UTILS ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")

        if email is None:
            raise credentials_exception

        token_data = TokenData(email=email)

    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == token_data.email).first()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive account",
        )

    return user

@router.get("/me", response_model=AuthUser)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/account-summary")
def read_account_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ProjectMember, Project)
        .join(Project, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == current_user.id)
        .order_by(Project.created_at.desc())
        .all()
    )

    projects = [
        {
            "id": project.id,
            "name": project.name,
            "key": project.key,
            "methodology": project.methodology,
            "role_name": membership.role.name if membership.role else "Member",
            "is_owner": project.owner_id == current_user.id,
            "joined_at": membership.joined_at,
        }
        for membership, project in rows
    ]

    return {
        "user": current_user,
        "projects_count": len(projects),
        "projects": projects,
    }


@router.put("/me", response_model=AuthUser)
def update_current_user(
    data: AccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] is not None:
        new_email = update_data["email"].strip().lower()
        existing_user = db.query(User).filter(
            User.email == new_email,
            User.id != current_user.id,
        ).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already used by another account.",
            )
        current_user.email = new_email

    if "full_name" in update_data:
        current_user.full_name = update_data["full_name"].strip() if update_data["full_name"] else None

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=AuthUser)
async def upload_current_user_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }

    if avatar.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be a JPG, PNG, WEBP or GIF image.",
        )

    content = await avatar.read()
    max_size = 2 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar image must be smaller than 2MB.",
        )

    upload_dir = Path(__file__).resolve().parents[2] / "uploads" / "avatars"
    upload_dir.mkdir(parents=True, exist_ok=True)

    extension = allowed_types[avatar.content_type]
    filename = f"user-{current_user.id}-{uuid4().hex}{extension}"
    destination = upload_dir / filename
    destination.write_bytes(content)

    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)

    return current_user


@router.put("/me/password")
def update_current_user_password(
    data: AccountPasswordUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password updated successfully."}
