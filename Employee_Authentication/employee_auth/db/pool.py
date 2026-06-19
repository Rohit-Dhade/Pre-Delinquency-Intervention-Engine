"""
Async PostgreSQL connection pool using asyncpg.
Shared by all auth modules — never create a second pool.
"""

import os
import logging
import asyncpg

logger = logging.getLogger("uvicorn.error")

_pool: asyncpg.Pool | None = None


async def init_pool() -> asyncpg.Pool:
    """Create the asyncpg connection pool (call once at startup)."""
    global _pool
    if _pool is not None:
        return _pool

    database_url = os.getenv("DATABASE_URL")

    if database_url:
        # asyncpg expects postgresql:// scheme
        dsn = database_url.replace("postgres://", "postgresql://")
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
    else:
        _pool = await asyncpg.create_pool(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            user=os.getenv("POSTGRES_USER", "rohit"),
            password=os.getenv("POSTGRES_PASSWORD", "@sy2026"),
            database=os.getenv("POSTGRES_DB", "delinquency_db"),
            min_size=2,
            max_size=10,
            command_timeout=30,
        )

    logger.info("Auth DB pool initialised (asyncpg)")
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Return the existing pool (init_pool must be called first)."""
    global _pool
    if _pool is None:
        raise RuntimeError(
            "Database pool not initialised — call init_pool() at startup"
        )
    return _pool


async def close_pool() -> None:
    """Close the pool gracefully (call on shutdown)."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Auth DB pool closed")
