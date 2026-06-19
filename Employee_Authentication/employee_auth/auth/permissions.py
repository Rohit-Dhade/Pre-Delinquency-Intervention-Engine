"""
Role-based access control (RBAC) dependency for FastAPI endpoints.
"""

from functools import wraps
from fastapi import Depends, HTTPException, status

from employee_auth.auth.jwt_handler import get_current_employee
from employee_auth.models.auth_models import EmployeeInDB


# ── Role → Permission Mapping ───────────────────────────────────────────────
# Explicit list of endpoints each role can access.

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {
        # Admin endpoints
        "auth:create_employee",
        "auth:list_employees",
        "auth:deactivate_employee",
        "auth:audit_log",
        "auth:sessions",
        # ML endpoints
        "predict",
        "admin:reload_model",
        # Intervention endpoints
        "intervention:trigger",
        "intervention:outcome",
        "intervention:history",
        "intervention:stats",
    },
    "risk_analyst": {
        "predict",
        "intervention:history",
        "intervention:stats",
    },
    "relationship_manager": {
        "predict",
        "intervention:trigger",
        "intervention:outcome",
        "intervention:history",
    },
}


def require_role(*allowed_roles: str):
    """
    FastAPI dependency factory.

    Usage:
        @router.post("/admin/action",
                      dependencies=[Depends(require_role("admin"))])

    Or as a parameter:
        async def endpoint(
            employee: EmployeeInDB = Depends(require_role("admin", "risk_analyst"))
        ):

    Checks that the authenticated employee's role is in allowed_roles.
    Raises HTTP 403 if not permitted.
    """

    async def role_checker(
        employee: EmployeeInDB = Depends(get_current_employee),
    ) -> EmployeeInDB:
        if employee.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}",
            )
        return employee

    return role_checker
