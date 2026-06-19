"""
JWT creation and verification for access, refresh, and password-reset tokens.
Uses the same JWT_SECRET as the Node.js Intervention Engine.
"""

import os
import logging
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from employee_auth.db.pool import get_pool
from employee_auth.models.auth_models import EmployeeInDB, TokenPayload

logger = logging.getLogger("uvicorn.error")

# ── Config ───────────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
RESET_TOKEN_EXPIRE_MINUTES = 15

# FastAPI OAuth2 scheme — extracts Bearer token from Authorization header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Token Creation ───────────────────────────────────────────────────────────

def create_access_token(employee_data: dict) -> str:
    """
    Create a short-lived access token (15 min).

    Payload: sub, email, role, full_name, iat, exp, type="access"
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": employee_data["employee_id"],
        "email": employee_data["email"],
        "role": employee_data["role"],
        "full_name": employee_data["full_name"],
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(employee_id: str, session_id: int) -> str:
    """
    Create a long-lived refresh token (7 days).

    Payload: sub, type="refresh", session_id, iat, exp
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": employee_id,
        "type": "refresh",
        "session_id": session_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_reset_token(employee_id: str) -> str:
    """
    Create a password-reset token (15 min).

    Payload: sub, type="password_reset", exp
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": employee_id,
        "type": "password_reset",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ── Token Verification ──────────────────────────────────────────────────────

def verify_token(token: str, expected_type: str) -> dict | None:
    """
    Decode and validate a JWT.
    Returns the payload dict or None if invalid/expired/wrong type.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != expected_type:
            return None
        return payload
    except JWTError:
        return None


# ── FastAPI Dependency — Current Authenticated Employee ──────────────────────

async def get_current_employee(
    token: str = Depends(oauth2_scheme),
) -> EmployeeInDB:
    """
    FastAPI dependency that:
      1. Extracts Bearer token from the Authorization header
      2. Verifies it is a valid access token
      3. Fetches the employee from the database
      4. Confirms the account is active
      5. Returns EmployeeInDB

    Raises HTTP 401 if any step fails.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token, "access")
    if payload is None:
        raise credentials_exception

    employee_id = payload.get("sub")
    if not employee_id:
        raise credentials_exception

    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, employee_id, full_name, email, password_hash,
               role, department, is_active, created_at, last_login, created_by
        FROM employees
        WHERE employee_id = $1
        """,
        employee_id,
    )

    if not row:
        raise credentials_exception

    employee = EmployeeInDB(**dict(row))

    if not employee.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return employee
