from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import List
import os
from dotenv import load_dotenv
from jose import jwt
from datetime import datetime, timedelta

load_dotenv()

# Configurare conexiune SMTP
conf = ConnectionConfig(
    MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
    MAIL_FROM=os.getenv("MAIL_FROM"),
    MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER=os.getenv("MAIL_SERVER"),
    
    # Setări de securitate pentru Gmail
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    
    # MODIFICARE CRITICĂ PENTRU MACOS:
    # Setăm False pentru a ignora eroarea de certificat local
    VALIDATE_CERTS=False 
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

def create_verification_token(email: str):
    """Generează un token JWT special doar pentru verificare email, expiră în 24h"""
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"sub": email, "type": "email_verification", "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def send_verification_email(email: EmailStr, token: str):
    """Trimite email-ul HTML cu link-ul de activare"""
    
    domain = os.getenv("DOMAIN", "http://localhost:3000")
    # Link-ul către pagina de frontend care va procesa validarea
    link = f"{domain}/verify-email?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #111827; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
            .header {{ background-color: #ffffff; padding: 30px 40px; border-bottom: 1px solid #e5e7eb; }}
            .logo {{ font-size: 20px; font-weight: bold; color: #111827; display: flex; align-items: center; gap: 8px; }}
            .logo span {{ color: #2563eb; }}
            .content {{ padding: 40px; }}
            h2 {{ margin-top: 0; color: #111827; font-size: 22px; }}
            p {{ line-height: 1.6; color: #4b5563; font-size: 16px; margin-bottom: 24px; }}
            .btn-wrap {{ text-align: center; margin: 35px 0; }}
            /* Am adaugat !important la culoare pentru siguranta */
            .btn {{ background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SDLC <span>Hub</span></div>
            </div>
            <div class="content">
                <h2>Verify your email address</h2>
                <p>Thanks for getting started with SDLC Hub! We're excited to have you on board.</p>
                <p>Please verify your email address to unlock full access to your project dashboard and AI features.</p>
                
                <div class="btn-wrap">
                    <a href="{link}" class="btn" style="color: #ffffff !important;">Verify Email Address</a>
                </div>
                
                <p style="font-size: 14px; margin-top: 30px;">This link will expire in 24 hours. If you did not create an account, no further action is required.</p>
            </div>
            <div class="footer">
                &copy; 2026 SDLC Hub. Automated message, please do not reply.
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Activate your SDLC AI Hub Account",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)

# --- ADAUGĂ ASTA LA FINAL ÎN backend/utils/email.py ---

def create_reset_token(email: str):
    """Generează un token pentru resetare parolă, expiră în 30 minute"""
    expire = datetime.utcnow() + timedelta(minutes=30)
    # Folosim un type diferit ca să nu poată folosi tokenul de activare pentru resetare
    to_encode = {"sub": email, "type": "password_reset", "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def send_reset_password_email(email: EmailStr, token: str):
    domain = os.getenv("DOMAIN", "http://localhost:3000")
    link = f"{domain}/reset-password?token={token}"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #111827; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
            .header {{ background-color: #ffffff; padding: 30px 40px; border-bottom: 1px solid #e5e7eb; }}
            .logo {{ font-size: 20px; font-weight: bold; color: #111827; display: flex; align-items: center; gap: 8px; }}
            .logo span {{ color: #2563eb; }}
            .content {{ padding: 40px; }}
            h2 {{ margin-top: 0; color: #111827; font-size: 22px; }}
            p {{ line-height: 1.6; color: #4b5563; font-size: 16px; margin-bottom: 24px; }}
            .btn-wrap {{ text-align: center; margin: 35px 0; }}
            .btn {{ background-color: #ef4444; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SDLC <span>Hub</span></div>
            </div>
            <div class="content">
                <h2>Reset your password</h2>
                <p>We received a request to reset the password for your SDLC Hub account.</p>
                <p>Click the button below to choose a new password:</p>
                
                <div class="btn-wrap">
                    <a href="{link}" class="btn" style="color: #ffffff !important;">Reset Password</a>
                </div>
                
                <p style="font-size: 14px; margin-top: 30px;">This link expires in 30 minutes. If you did not request a password reset, you can safely ignore this email.</p>
            </div>
            <div class="footer">
                &copy; 2026 SDLC Hub. Automated message.
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Reset your SDLC Hub Password",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)

# --- ADAUGĂ ASTA LA FINAL ÎN backend/utils/email.py ---

async def send_project_invitation_email(email: EmailStr, project_name: str, role_name: str, code: str):
    domain = os.getenv("DOMAIN", "http://localhost:3000")
    register_link = f"{domain}/register"
    login_link = f"{domain}/login"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; color: #111827; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
            .header {{ background-color: #ffffff; padding: 30px 40px; border-bottom: 1px solid #e5e7eb; }}
            .logo {{ font-size: 20px; font-weight: bold; color: #111827; display: flex; align-items: center; gap: 8px; }}
            .logo span {{ color: #2563eb; }}
            .content {{ padding: 40px; }}
            h2 {{ margin-top: 0; color: #111827; font-size: 22px; }}
            .role-badge {{ background-color: #dbeafe; color: #1e40af; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 0.9em; }}
            .code-box {{ background-color: #111827; color: #10b981; font-family: monospace; font-size: 24px; letter-spacing: 2px; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 1px solid #374151; }}
            .btn {{ background-color: #2563eb; color: #ffffff !important; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; transition: background-color 0.2s; }}
            .footer {{ background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }}
            a {{ color: #2563eb; text-decoration: none; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">SDLC <span>Hub</span></div>
            </div>
            <div class="content">
                <h2>You've been invited to join a project! 🚀</h2>
                <p>You have been invited to collaborate on <strong>{project_name}</strong> as a <span class="role-badge">{role_name}</span>.</p>
                
                <p>Use the invitation code below to join the team:</p>
                
                <div class="code-box">
                    {code}
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="{register_link}" class="btn">Create Account & Join</a>
                </div>

                <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
                    Copy the code above. If you already have an account, <a href="{login_link}">log in here</a> and select "Join Team".
                </p>
            </div>
            <div class="footer">
                &copy; 2026 SDLC Hub. Automated message.
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject=f"Invitation to join {project_name}",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    fm = FastMail(conf)
    await fm.send_message(message)