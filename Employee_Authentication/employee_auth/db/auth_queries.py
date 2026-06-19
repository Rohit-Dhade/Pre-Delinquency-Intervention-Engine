"""
All authentication SQL queries.
Uses the shared asyncpg pool — never creates a new connection.
All queries are parameterised to prevent SQL injection.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Optional

from employee_auth.db.pool import get_pool

logger = logging.getLogger("uvicorn.error")


# ═══════════════════════════════════════════════════════════════════════════════
# EMPLOYEE QUERIES
# ═══════════════════════════════════════════════════════════════════════════════

async def get_employee_by_email(email: str):
    """Fetch an employee record by email address."""
    pool = await get_pool()
    return await pool.fetchrow(
        """
        SELECT id, employee_id, full_name, email, password_hash,
               role, department, is_active, created_at, last_login, created_by
        FROM employees
        WHERE email = $1
        """,
        email,
    )


async def get_employee_by_id(employee_id: str):
    """Fetch an employee record by employee_id (e.g. EMP_001)."""
    pool = await get_pool()
    return await pool.fetchrow(
        """
        SELECT id, employee_id, full_name, email, password_hash,
               role, department, is_active, created_at, last_login, created_by
        FROM employees
        WHERE employee_id = $1
        """,
        employee_id,
    )


async def update_last_login(employee_id: str) -> None:
    """Set the last_login timestamp to now."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE employees SET last_login = NOW() WHERE employee_id = $1",
        employee_id,
    )


async def create_employee(
    employee_id: str,
    full_name: str,
    email: str,
    password_hash: str,
    role: str,
    department: Optional[str],
    created_by: Optional[str],
):
    """Insert a new employee and return the created record."""
    pool = await get_pool()
    return await pool.fetchrow(
        """
        INSERT INTO employees
            (employee_id, full_name, email, password_hash, role, department, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, employee_id, full_name, email, role, department,
                  is_active, created_at, last_login
        """,
        employee_id, full_name, email, password_hash, role, department, created_by,
    )


async def deactivate_employee(employee_id: str) -> None:
    """Set is_active = false for an employee."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE employees SET is_active = false WHERE employee_id = $1",
        employee_id,
    )


async def get_all_employees():
    """Return all employees (no password_hash)."""
    pool = await get_pool()
    return await pool.fetch(
        """
        SELECT employee_id, full_name, email, role, department,
               is_active, created_at, last_login
        FROM employees
        ORDER BY id ASC
        """
    )


async def get_next_employee_id() -> str:
    """Generate the next EMP_XXX id based on current max."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT MAX(id) AS max_id FROM employees")
    next_num = (row["max_id"] or 0) + 1
    return f"EMP_{next_num:03d}"


async def count_active_admins() -> int:
    """Count how many active admins exist."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT COUNT(*) AS cnt FROM employees WHERE role = 'admin' AND is_active = true"
    )
    return row["cnt"]


async def count_employees() -> int:
    """Count total employees (for seeding check)."""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT COUNT(*) AS cnt FROM employees")
    return row["cnt"]


# ═══════════════════════════════════════════════════════════════════════════════
# SESSION QUERIES
# ═══════════════════════════════════════════════════════════════════════════════

async def create_session(
    employee_id: str,
    token_hash: str,
    expires_at: datetime,
    ip_address: str,
    user_agent: str,
) -> int:
    """Insert a new session and return its id."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO employee_sessions
            (employee_id, refresh_token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
        """,
        employee_id, token_hash, expires_at, ip_address, user_agent,
    )
    return row["id"]


async def get_session(employee_id: str, token_hash: str):
    """Find a valid (non-revoked, non-expired) session."""
    pool = await get_pool()
    return await pool.fetchrow(
        """
        SELECT id, employee_id, expires_at, revoked
        FROM employee_sessions
        WHERE employee_id = $1
          AND refresh_token_hash = $2
          AND revoked = false
          AND expires_at > NOW()
        """,
        employee_id, token_hash,
    )


async def revoke_session(session_id: int) -> None:
    """Revoke a specific session."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE employee_sessions SET revoked = true, revoked_at = NOW() WHERE id = $1",
        session_id,
    )


async def revoke_all_sessions(employee_id: str) -> None:
    """Revoke ALL active sessions for an employee (force re-login everywhere)."""
    pool = await get_pool()
    await pool.execute(
        """
        UPDATE employee_sessions
        SET revoked = true, revoked_at = NOW()
        WHERE employee_id = $1 AND revoked = false
        """,
        employee_id,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT LOG QUERIES
# ═══════════════════════════════════════════════════════════════════════════════

async def log_audit(
    employee_id: Optional[str],
    action: str,
    resource: Optional[str],
    ip_address: str,
    user_agent: str,
    success: bool,
    metadata: Optional[dict] = None,
) -> None:
    """Write an entry to the employee_audit_log."""
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO employee_audit_log
            (employee_id, action, resource, ip_address, user_agent, success, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
        """,
        employee_id,
        action,
        resource,
        ip_address,
        user_agent,
        success,
        json.dumps(metadata or {}),
    )


async def get_audit_log(
    employee_id: Optional[str] = None,
    action: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100,
):
    """
    Fetch audit log entries with optional filters.
    Returns newest-first, capped at `limit`.
    """
    pool = await get_pool()

    conditions = []
    params = []
    idx = 1

    if employee_id:
        conditions.append(f"employee_id = ${idx}")
        params.append(employee_id)
        idx += 1
    if action:
        conditions.append(f"action = ${idx}")
        params.append(action)
        idx += 1
    if from_date:
        conditions.append(f"timestamp >= ${idx}")
        params.append(from_date)
        idx += 1
    if to_date:
        conditions.append(f"timestamp <= ${idx}")
        params.append(to_date)
        idx += 1

    where_clause = " AND ".join(conditions) if conditions else "TRUE"
    capped_limit = min(limit, 500)

    query = f"""
        SELECT id, employee_id, action, resource, ip_address,
               user_agent, timestamp, success, metadata
        FROM employee_audit_log
        WHERE {where_clause}
        ORDER BY timestamp DESC
        LIMIT {capped_limit}
    """

    return await pool.fetch(query, *params)


# ═══════════════════════════════════════════════════════════════════════════════
# PASSWORD RESET TOKEN QUERIES
# ═══════════════════════════════════════════════════════════════════════════════

async def create_reset_token_record(
    employee_id: str,
    token_hash: str,
    expires_at: datetime,
) -> None:
    """Store a hashed password-reset token."""
    pool = await get_pool()
    await pool.execute(
        """
        INSERT INTO password_reset_tokens (employee_id, token_hash, expires_at)
        VALUES ($1, $2, $3)
        """,
        employee_id, token_hash, expires_at,
    )


async def get_reset_token(token_hash: str):
    """Find a valid (unused, non-expired) reset token."""
    pool = await get_pool()
    return await pool.fetchrow(
        """
        SELECT id, employee_id, expires_at
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND used = false
          AND expires_at > NOW()
        """,
        token_hash,
    )


async def mark_reset_token_used(token_id: int) -> None:
    """Mark a reset token as consumed."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE password_reset_tokens SET used = true, used_at = NOW() WHERE id = $1",
        token_id,
    )


async def update_password(employee_id: str, new_hash: str) -> None:
    """Update the employee's password_hash."""
    pool = await get_pool()
    await pool.execute(
        "UPDATE employees SET password_hash = $1 WHERE employee_id = $2",
        new_hash, employee_id,
    )
