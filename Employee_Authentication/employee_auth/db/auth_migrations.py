"""
Database migration for authentication tables.
Run once at startup via CREATE TABLE IF NOT EXISTS.
"""

import logging
from employee_auth.db.pool import get_pool

logger = logging.getLogger("uvicorn.error")

MIGRATION_SQL = """
-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 1: employees
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employees (
    id               SERIAL PRIMARY KEY,
    employee_id      VARCHAR(20) UNIQUE NOT NULL,
    full_name        VARCHAR(100) NOT NULL,
    email            VARCHAR(150) UNIQUE NOT NULL,
    password_hash    VARCHAR(255) NOT NULL,
    role             VARCHAR(30) NOT NULL
                     CHECK (role IN ('admin', 'risk_analyst', 'relationship_manager')),
    department       VARCHAR(50),
    is_active        BOOLEAN DEFAULT true,
    created_at       TIMESTAMP DEFAULT NOW(),
    last_login       TIMESTAMP,
    created_by       VARCHAR(20)
                     REFERENCES employees(employee_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 2: employee_sessions
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employee_sessions (
    id                 SERIAL PRIMARY KEY,
    employee_id        VARCHAR(20)
                       REFERENCES employees(employee_id),
    refresh_token_hash VARCHAR(255) NOT NULL,
    expires_at         TIMESTAMP NOT NULL,
    ip_address         VARCHAR(45),
    user_agent         VARCHAR(255),
    created_at         TIMESTAMP DEFAULT NOW(),
    revoked            BOOLEAN DEFAULT false,
    revoked_at         TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 3: employee_audit_log
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS employee_audit_log (
    id            SERIAL PRIMARY KEY,
    employee_id   VARCHAR(20)
                  REFERENCES employees(employee_id),
    action        VARCHAR(50) NOT NULL,
    resource      VARCHAR(100),
    ip_address    VARCHAR(45),
    user_agent    VARCHAR(255),
    timestamp     TIMESTAMP DEFAULT NOW(),
    success       BOOLEAN NOT NULL,
    metadata      JSONB DEFAULT '{}'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE 4: password_reset_tokens
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id            SERIAL PRIMARY KEY,
    employee_id   VARCHAR(20)
                  REFERENCES employees(employee_id),
    token_hash    VARCHAR(255) NOT NULL,
    expires_at    TIMESTAMP NOT NULL,
    used          BOOLEAN DEFAULT false,
    used_at       TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW()
);
"""


async def auth_migrate() -> None:
    """
    Run auth table migrations.
    Safe to call multiple times (IF NOT EXISTS).
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(MIGRATION_SQL)
    logger.info(
        "Auth migration completed — employees, employee_sessions, "
        "employee_audit_log, password_reset_tokens ready"
    )
