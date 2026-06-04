import os
import smtplib
from html import escape
from datetime import datetime, timedelta
from email.message import EmailMessage

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from jose import jwt
from pydantic import EmailStr

from backend.config import get_settings

settings = get_settings()

# Configurare conexiune SMTP
MAIL_USERNAME = settings.mail_username
MAIL_PASSWORD = settings.mail_password
MAIL_FROM = settings.mail_from
MAIL_SERVER = settings.mail_server
MAIL_PORT = settings.mail_port
DOMAIN = settings.frontend_url.rstrip("/")

smtp_enabled = bool(MAIL_USERNAME and MAIL_PASSWORD and MAIL_FROM and MAIL_SERVER)
if not smtp_enabled:
    print("⚠️ SMTP nu este configurat complet. Trimiterea de email-uri este dezactivată în modul de dezvoltare.")
    conf = None
else:
    conf = ConnectionConfig(
        MAIL_USERNAME=MAIL_USERNAME,
        MAIL_PASSWORD=MAIL_PASSWORD,
        MAIL_FROM=MAIL_FROM,
        MAIL_PORT=MAIL_PORT,
        MAIL_SERVER=MAIL_SERVER,
        
        MAIL_STARTTLS=settings.mail_starttls,
        MAIL_SSL_TLS=settings.mail_ssl_tls,
        USE_CREDENTIALS=settings.use_credentials,
        VALIDATE_CERTS=settings.validate_certs,
        TIMEOUT=settings.mail_timeout,
    )

SECRET_KEY = os.getenv("SECRET_KEY", "secret_cheie_default")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

def build_frontend_link(path: str, token: str):
    return f"{DOMAIN}{path}?token={token}"

def is_email_enabled():
    return smtp_enabled


def send_notification_email_sync(
    *,
    recipient: str,
    subject: str,
    title: str,
    body: str | None = None,
    link_url: str | None = None,
    action_label: str = "Open in SDLC Hub",
) -> None:
    """Send a small transactional email from sync code paths."""
    if not smtp_enabled:
        print(f"⚠️ SMTP disabled, skipping notification email to {recipient}.")
        return

    absolute_link = None
    if link_url:
        absolute_link = link_url if link_url.startswith("http") else f"{DOMAIN}{link_url}"

    safe_title = escape(title)
    safe_body = escape(body or "You have a new update in SDLC Hub.")
    safe_action_label = escape(action_label)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; background: #f3f4f6; color: #111827; margin: 0; padding: 0; }}
            .container {{ max-width: 580px; margin: 36px auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }}
            .header {{ padding: 24px 30px; border-bottom: 1px solid #e5e7eb; font-weight: 700; }}
            .header span {{ color: #2563eb; }}
            .content {{ padding: 30px; }}
            h2 {{ margin: 0 0 16px; font-size: 21px; color: #111827; }}
            p {{ line-height: 1.6; color: #4b5563; font-size: 15px; }}
            .button {{ display: inline-block; margin-top: 20px; padding: 12px 20px; background: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700; }}
            .footer {{ padding: 18px 30px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">SDLC <span>Hub</span></div>
            <div class="content">
                <h2>{safe_title}</h2>
                <p>{safe_body}</p>
                {f'<a href="{escape(absolute_link)}" class="button">{safe_action_label}</a>' if absolute_link else ""}
            </div>
            <div class="footer">Automated notification from SDLC Hub.</div>
        </div>
    </body>
    </html>
    """

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = MAIL_FROM
    message["To"] = recipient
    message.set_content(f"{title}\n\n{body or ''}\n\n{absolute_link or DOMAIN}")
    message.add_alternative(html, subtype="html")

    timeout = getattr(settings, "mail_timeout", 20)
    if settings.mail_ssl_tls:
        with smtplib.SMTP_SSL(MAIL_SERVER, MAIL_PORT, timeout=timeout) as smtp:
            if settings.use_credentials:
                smtp.login(MAIL_USERNAME, MAIL_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(MAIL_SERVER, MAIL_PORT, timeout=timeout) as smtp:
        if settings.mail_starttls:
            smtp.starttls()
        if settings.use_credentials:
            smtp.login(MAIL_USERNAME, MAIL_PASSWORD)
        smtp.send_message(message)

def create_verification_token(email: str):
    """Generează un token JWT special doar pentru verificare email, expiră în 24h"""
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode = {"sub": email, "type": "email_verification", "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def send_verification_email(email: EmailStr, token: str):
    """Trimite email-ul HTML cu link-ul de activare"""
    if not smtp_enabled:
        print(f"⚠️ SMTP disabled, skipping verification email to {email}.")
        return

    link = build_frontend_link("/verify-email", token)

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
        subject="Activate your SDLC Hub Account",
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
    if not smtp_enabled:
        print(f"⚠️ SMTP disabled, skipping reset password email to {email}.")
        return

    link = build_frontend_link("/reset-password", token)

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
    if not smtp_enabled:
        print(f"⚠️ SMTP disabled, skipping project invitation email to {email}.")
        return

    register_link = f"{DOMAIN}/register"
    login_link = f"{DOMAIN}/login"

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
