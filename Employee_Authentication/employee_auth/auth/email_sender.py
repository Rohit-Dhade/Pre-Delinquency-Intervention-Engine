"""
Async email sender for password reset emails.
Uses aiosmtplib with Gmail SMTP (same credentials as Node.js Nodemailer).
"""

import os
import logging
from email.message import EmailMessage

import aiosmtplib

logger = logging.getLogger("uvicorn.error")

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
BANK_NAME = os.getenv("BANK_NAME", "FinTrust Bank")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


async def send_reset_email(
    to_email: str,
    reset_token: str,
    employee_name: str,
) -> None:
    """
    Send a password reset email via Gmail SMTP.

    If sending fails, log at ERROR level but do NOT raise
    (prevents timing attacks on the reset endpoint).
    """
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    body = (
        f"Dear {employee_name},\n\n"
        f"A password reset was requested for your account.\n"
        f"Click the link below to reset your password.\n"
        f"This link expires in 15 minutes.\n\n"
        f"{reset_link}\n\n"
        f"If you did not request this, "
        f"please contact your system administrator.\n\n"
        f"— {BANK_NAME} Security Team"
    )

    msg = EmailMessage()
    msg["From"] = GMAIL_USER
    msg["To"] = to_email
    msg["Subject"] = f"Password Reset — {BANK_NAME}"
    msg.set_content(body)

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=GMAIL_USER,
            password=GMAIL_APP_PASSWORD,
        )
        logger.info(f"Password reset email sent to {to_email}")
    except Exception as exc:
        # Never raise — endpoint must always return 200 to avoid timing attacks
        logger.error(f"Failed to send reset email to {to_email}: {exc}")
