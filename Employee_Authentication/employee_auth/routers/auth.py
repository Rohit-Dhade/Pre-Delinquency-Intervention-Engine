"""
Authentication & Authorisation API Router.
All endpoints under /auth prefix.

Rate limits (slowapi):
  POST /auth/login           → 5 / minute / IP
  POST /auth/reset-password  → 3 / minute / IP
  All other auth endpoints   → 30 / minute / IP
"""

import hashlib
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

from employee_auth.auth.jwt_handler import (
    create_access_token,
    create_refresh_token,
    create_reset_token,
    get_current_employee,
    verify_token,
)
from employee_auth.auth.password_handler import (
    hash_password,
    validate_password_policy,
    verify_password,
)
from employee_auth.auth.permissions import require_role
from employee_auth.auth.email_sender import send_reset_email
from employee_auth.db import auth_queries as q
from employee_auth.middleware.auth_middleware import get_client_ip, get_user_agent
from employee_auth.models.auth_models import (
    AuditLogEntry,
    CreateEmployeeRequest,
    DeactivateRequest,
    EmployeeInDB,
    EmployeePublic,
    LoginRequest,
    LoginResponse,
    RefreshResponse,
    ResetConfirmBody,
    ResetRequestBody,
)

logger = logging.getLogger("uvicorn.error")

# ── Rate limiter ─────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Environment ──────────────────────────────────────────────────────────────
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
REFRESH_COOKIE_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 86400  # seconds

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sha256(value: str) -> str:
    """SHA-256 hash a string (for token storage)."""
    return hashlib.sha256(value.encode()).hexdigest()


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Set the httpOnly refresh_token cookie."""
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=(ENVIRONMENT == "production"),
        samesite="lax",
        max_age=REFRESH_COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Clear the refresh_token cookie."""
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=(ENVIRONMENT == "production"),
        samesite="lax",
        path="/",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/login
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(body: LoginRequest, request: Request, response: Response):
    """
    Authenticate with email + password.
    Returns access_token in body, refresh_token as httpOnly cookie.
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # 1. Fetch employee by email
    row = await q.get_employee_by_email(body.email)

    # 2. Not found OR inactive → 401 (same message — never reveal whether email exists)
    if not row or not row["is_active"]:
        await q.log_audit(
            employee_id=row["employee_id"] if row else None,
            action="LOGIN_FAILED",
            resource="/auth/login",
            ip_address=ip,
            user_agent=ua,
            success=False,
            metadata={"reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # 3. Verify password
    if not verify_password(body.password, row["password_hash"]):
        await q.log_audit(
            employee_id=row["employee_id"],
            action="LOGIN_FAILED",
            resource="/auth/login",
            ip_address=ip,
            user_agent=ua,
            success=False,
            metadata={"reason": "wrong_password"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    employee_data = dict(row)

    expires_at = (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).replace(tzinfo=None)
    session_id = await q.create_session(
        employee_id=employee_data["employee_id"],
        token_hash="pending",  # placeholder
        expires_at=expires_at,
        ip_address=ip,
        user_agent=ua,
    )

    # 5. Create tokens
    access_token = create_access_token(employee_data)
    refresh_token = create_refresh_token(employee_data["employee_id"], session_id)

    # 6. Update session with the real refresh token hash
    from employee_auth.db.pool import get_pool
    pool = await get_pool()
    await pool.execute(
        "UPDATE employee_sessions SET refresh_token_hash = $1 WHERE id = $2",
        _sha256(refresh_token),
        session_id,
    )

    # 7. Update last_login
    await q.update_last_login(employee_data["employee_id"])

    # 8. Audit log
    await q.log_audit(
        employee_id=employee_data["employee_id"],
        action="LOGIN_SUCCESS",
        resource="/auth/login",
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    # 9. Set refresh token as httpOnly cookie
    _set_refresh_cookie(response, refresh_token)

    # 10. Return access token + employee profile
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=900,
        employee=EmployeePublic(
            employee_id=employee_data["employee_id"],
            full_name=employee_data["full_name"],
            email=employee_data["email"],
            role=employee_data["role"],
            department=employee_data["department"],
            is_active=employee_data["is_active"],
            created_at=employee_data["created_at"],
            last_login=employee_data["last_login"],
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/logout
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/logout")
@limiter.limit("30/minute")
async def logout(
    request: Request,
    response: Response,
    employee: EmployeeInDB = Depends(get_current_employee),
):
    """Log out the current employee — revokes refresh token session."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # Read refresh token from cookie
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        token_hash = _sha256(refresh_token)
        session = await q.get_session(employee.employee_id, token_hash)
        if session:
            await q.revoke_session(session["id"])

    # Audit log
    await q.log_audit(
        employee_id=employee.employee_id,
        action="LOGOUT",
        resource="/auth/logout",
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    # Clear cookie
    _clear_refresh_cookie(response)

    return {"message": "Logged out successfully"}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/refresh
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("30/minute")
async def refresh(request: Request, response: Response):
    """
    Issue a new access token using the refresh token from the httpOnly cookie.
    Does NOT rotate the refresh token.
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # 1. Read cookie
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    # 2. Verify JWT
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    employee_id = payload.get("sub")
    token_hash = _sha256(refresh_token)

    # 3. Look up valid session
    session = await q.get_session(employee_id, token_hash)
    if not session:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked",
        )

    # 4. Fetch employee (check still active)
    row = await q.get_employee_by_id(employee_id)
    if not row or not row["is_active"]:
        _clear_refresh_cookie(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account deactivated",
        )

    # 5. Issue new access token
    employee_data = dict(row)
    access_token = create_access_token(employee_data)

    # 6. Audit log
    await q.log_audit(
        employee_id=employee_id,
        action="TOKEN_REFRESH",
        resource="/auth/refresh",
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return RefreshResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=900,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/reset-password/request
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reset-password/request")
@limiter.limit("3/minute")
async def reset_password_request(body: ResetRequestBody, request: Request):
    """
    Request a password reset link via email.
    Always returns the same response regardless of whether the email exists.
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    safe_message = "If that email exists, a reset link has been sent."

    row = await q.get_employee_by_email(body.email)

    if row and row["is_active"]:
        employee_id = row["employee_id"]

        # Create reset token
        token = create_reset_token(employee_id)
        token_hash = _sha256(token)
        expires_at = (datetime.now(timezone.utc) + timedelta(minutes=15)).replace(tzinfo=None)

        # Store hashed token
        await q.create_reset_token_record(employee_id, token_hash, expires_at)

        # Send email (async, failures are swallowed)
        await send_reset_email(
            to_email=row["email"],
            reset_token=token,
            employee_name=row["full_name"],
        )

        # Audit log
        await q.log_audit(
            employee_id=employee_id,
            action="PASSWORD_RESET_REQUEST",
            resource="/auth/reset-password/request",
            ip_address=ip,
            user_agent=ua,
            success=True,
        )

    return {"message": safe_message}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/reset-password/confirm
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/reset-password/confirm")
@limiter.limit("30/minute")
async def reset_password_confirm(body: ResetConfirmBody, request: Request):
    """Confirm a password reset using the emailed token."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # 1. Verify JWT
    payload = verify_token(body.token, "password_reset")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalid or expired",
        )

    # 2. Look up in password_reset_tokens
    token_hash = _sha256(body.token)
    reset_record = await q.get_reset_token(token_hash)
    if not reset_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalid or expired",
        )

    employee_id = payload["sub"]

    # 3. Validate new password against policy
    validate_password_policy(body.new_password)

    # 4. Hash and update
    new_hash = hash_password(body.new_password)
    await q.update_password(employee_id, new_hash)

    # 5. Mark token as used
    await q.mark_reset_token_used(reset_record["id"])

    # 6. Revoke ALL active sessions (force re-login everywhere)
    await q.revoke_all_sessions(employee_id)

    # 7. Audit log
    await q.log_audit(
        employee_id=employee_id,
        action="PASSWORD_RESET_COMPLETE",
        resource="/auth/reset-password/confirm",
        ip_address=ip,
        user_agent=ua,
        success=True,
    )

    return {"message": "Password reset successful. Please log in."}


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/create-employee   (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/create-employee", response_model=EmployeePublic)
@limiter.limit("30/minute")
async def create_employee_endpoint(
    body: CreateEmployeeRequest,
    request: Request,
    admin: EmployeeInDB = Depends(require_role("admin")),
):
    """Create a new employee account (admin only)."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # Check email uniqueness
    existing = await q.get_employee_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already in use",
        )

    # Validate password
    validate_password_policy(body.password)

    # Generate employee_id
    new_emp_id = await q.get_next_employee_id()

    # Create
    row = await q.create_employee(
        employee_id=new_emp_id,
        full_name=body.full_name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        department=body.department,
        created_by=admin.employee_id,
    )

    # Audit log
    await q.log_audit(
        employee_id=admin.employee_id,
        action="ADMIN_CREATE_EMPLOYEE",
        resource="/auth/create-employee",
        ip_address=ip,
        user_agent=ua,
        success=True,
        metadata={"new_employee_id": new_emp_id, "role": body.role},
    )

    return EmployeePublic(**dict(row))


# ═══════════════════════════════════════════════════════════════════════════════
# POST /auth/deactivate-employee   (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/deactivate-employee")
@limiter.limit("30/minute")
async def deactivate_employee_endpoint(
    body: DeactivateRequest,
    request: Request,
    admin: EmployeeInDB = Depends(require_role("admin")),
):
    """Deactivate an employee account (admin only)."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # Cannot deactivate yourself
    if body.employee_id == admin.employee_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account",
        )

    # Check employee exists
    target = await q.get_employee_by_id(body.employee_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    # Cannot deactivate the last active admin
    if target["role"] == "admin":
        admin_count = await q.count_active_admins()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active admin",
            )

    # Deactivate
    await q.deactivate_employee(body.employee_id)

    # Revoke all sessions
    await q.revoke_all_sessions(body.employee_id)

    # Audit log
    await q.log_audit(
        employee_id=admin.employee_id,
        action="ADMIN_DEACTIVATE_EMPLOYEE",
        resource="/auth/deactivate-employee",
        ip_address=ip,
        user_agent=ua,
        success=True,
        metadata={"deactivated_employee_id": body.employee_id},
    )

    return {"message": "Employee deactivated"}


# ═══════════════════════════════════════════════════════════════════════════════
# GET /auth/employees   (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/employees", response_model=list[EmployeePublic])
@limiter.limit("30/minute")
async def list_employees(
    request: Request,
    admin: EmployeeInDB = Depends(require_role("admin")),
):
    """List all employees (admin only). Password hashes are never returned."""
    rows = await q.get_all_employees()
    return [EmployeePublic(**dict(row)) for row in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /auth/audit-log   (admin only)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/audit-log")
@limiter.limit("30/minute")
async def get_audit_log_endpoint(
    request: Request,
    employee_id: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
    admin: EmployeeInDB = Depends(require_role("admin")),
):
    """Retrieve paginated audit log entries (admin only)."""
    rows = await q.get_audit_log(
        employee_id=employee_id,
        action=action,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
    )
    return [
        AuditLogEntry(
            id=row["id"],
            employee_id=row["employee_id"],
            action=row["action"],
            resource=row["resource"],
            ip_address=row["ip_address"],
            user_agent=row["user_agent"],
            timestamp=row["timestamp"],
            success=row["success"],
            metadata=json.loads(row["metadata"]) if isinstance(row["metadata"], str) else (row["metadata"] or {}),
        )
        for row in rows
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# GET /auth/me   (any authenticated employee)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/me", response_model=EmployeePublic)
@limiter.limit("30/minute")
async def get_me(
    request: Request,
    employee: EmployeeInDB = Depends(get_current_employee),
):
    """Return the current authenticated employee's profile."""
    return EmployeePublic(
        employee_id=employee.employee_id,
        full_name=employee.full_name,
        email=employee.email,
        role=employee.role,
        department=employee.department,
        is_active=employee.is_active,
        created_at=employee.created_at,
        last_login=employee.last_login,
    )
