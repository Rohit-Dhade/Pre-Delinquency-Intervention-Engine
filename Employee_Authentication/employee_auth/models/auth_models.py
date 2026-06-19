"""
Pydantic models for the Employee Authentication system.
Shared across routers, queries, and JWT handling.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ── Request Bodies ───────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateEmployeeRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    role: str = Field(..., pattern=r"^(admin|risk_analyst|relationship_manager)$")
    department: Optional[str] = Field(None, max_length=50)
    password: str


class DeactivateRequest(BaseModel):
    employee_id: str = Field(..., pattern=r"^EMP_\d{3,}$")


class ResetRequestBody(BaseModel):
    email: EmailStr


class ResetConfirmBody(BaseModel):
    token: str
    new_password: str


# ── Response Bodies ──────────────────────────────────────────────────────────

class EmployeePublic(BaseModel):
    """Employee data safe for API responses (no password_hash)."""
    employee_id: str
    full_name: str
    email: str
    role: str
    department: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900  # 15 min in seconds
    employee: EmployeePublic


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 900


# ── Internal Models ──────────────────────────────────────────────────────────

class EmployeeInDB(BaseModel):
    """Full employee record including password_hash — internal only."""
    id: int
    employee_id: str
    full_name: str
    email: str
    password_hash: str
    role: str
    department: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    created_by: Optional[str] = None


class TokenPayload(BaseModel):
    """Decoded JWT payload."""
    sub: str                           # employee_id
    email: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    type: str                          # access | refresh | password_reset
    exp: Optional[int] = None
    iat: Optional[int] = None
    session_id: Optional[int] = None


class AuditLogEntry(BaseModel):
    id: int
    employee_id: Optional[str] = None
    action: str
    resource: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: Optional[datetime] = None
    success: bool
    metadata: Optional[dict] = None
