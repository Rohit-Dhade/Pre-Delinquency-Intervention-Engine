"""
Password hashing (bcrypt) and validation policy.
Never log passwords. Never return hashes in responses.
"""

import re
import warnings

# Suppress passlib deprecation warning for 'crypt' module (slated for removal in Python 3.13)
warnings.filterwarnings("ignore", category=DeprecationWarning, module="passlib")

from passlib.context import CryptContext
from fastapi import HTTPException, status

# ── Bcrypt context ───────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ── Password policy ─────────────────────────────────────────────────────────
_PASSWORD_RULES = [
    (r".{8,}", "Password must be at least 8 characters long"),
    (r"[A-Z]", "Password must contain at least 1 uppercase letter"),
    (r"[0-9]", "Password must contain at least 1 number"),
    (r'[!@#$%^&*()_+\-=\[\]{};":\\|,.<>/?]', "Password must contain at least 1 special character"),
]


def validate_password_policy(password: str) -> None:
    """
    Enforce password strength policy.
    Raises HTTP 422 with a clear message if any rule fails.
    """
    for pattern, message in _PASSWORD_RULES:
        if not re.search(pattern, password):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=message,
            )
