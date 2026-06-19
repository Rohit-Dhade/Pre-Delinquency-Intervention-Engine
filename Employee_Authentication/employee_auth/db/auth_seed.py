"""
Seed script — populates the employees table with an admin + 14 synthetic employees
on first run. Skips entirely if the table already contains rows.
"""

import os
import logging

from employee_auth.auth.password_handler import hash_password
from employee_auth.db import auth_queries as q

logger = logging.getLogger("uvicorn.error")

# ── 15 synthetic employees (1 admin from env + 14 hard-coded) ────────────────
SYNTHETIC_EMPLOYEES = [
    # (full_name, email, role, department, plain_password)
    ("Priya Sharma", "priya.sharma@fintrust.com", "risk_analyst", "Collections", "Analyst@2026"),
    ("Rahul Verma", "rahul.verma@fintrust.com", "relationship_manager", "Retail Banking", "Manager@2026"),
    ("Anita Desai", "anita.desai@fintrust.com", "risk_analyst", "Risk Management", "Analyst@2026"),
    ("Vikram Patel", "vikram.patel@fintrust.com", "relationship_manager", "Retail Banking", "Manager@2026"),
    ("Sneha Iyer", "sneha.iyer@fintrust.com", "admin", "IT Administration", "Admin@2026"),
    ("Arjun Mehta", "arjun.mehta@fintrust.com", "risk_analyst", "Analytics", "Analyst@2026"),
    ("Deepa Nair", "deepa.nair@fintrust.com", "relationship_manager", "Retail Banking", "Manager@2026"),
    ("Karthik Reddy", "karthik.reddy@fintrust.com", "risk_analyst", "Risk Management", "Analyst@2026"),
    ("Meera Joshi", "meera.joshi@fintrust.com", "relationship_manager", "Customer Relations", "Manager@2026"),
    ("Sanjay Gupta", "sanjay.gupta@fintrust.com", "risk_analyst", "Collections", "Analyst@2026"),
    ("Kavitha Menon", "kavitha.menon@fintrust.com", "relationship_manager", "Retail Banking", "Manager@2026"),
    ("Amit Chauhan", "amit.chauhan@fintrust.com", "risk_analyst", "Analytics", "Analyst@2026"),
    ("Roshni Kulkarni", "roshni.kulkarni@fintrust.com", "relationship_manager", "Customer Relations", "Manager@2026"),
    ("Nitin Saxena", "nitin.saxena@fintrust.com", "admin", "IT Administration", "Admin@2026"),
]


async def auth_seed() -> None:
    """
    Seed the employees table if it is empty.

    1. Creates the default admin from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
    2. Inserts 14 additional synthetic employees across all three roles.

    If the table already has any rows, skips entirely.
    """
    count = await q.count_employees()
    if count > 0:
        logger.info(f"Employees table already has {count} rows — skipping seed")
        return

    # ── 1. Seed admin from environment ───────────────────────────────────────
    admin_email = os.getenv("ADMIN_EMAIL", "admin@fintrust.com")
    admin_password = os.getenv("ADMIN_PASSWORD", "Admin@2026")

    await q.create_employee(
        employee_id="EMP_001",
        full_name="System Admin",
        email=admin_email,
        password_hash=hash_password(admin_password),
        role="admin",
        department="IT Administration",
        created_by=None,  # First admin — no creator
    )

    logger.warning(
        "╔══════════════════════════════════════════════════════════════════╗\n"
        "║  DEFAULT ADMIN SEEDED                                          ║\n"
        "║  Email   : %-50s ║\n"
        "║  Password: (from ADMIN_PASSWORD env var)                       ║\n"
        "║  ⚠  Change password immediately after first login.             ║\n"
        "╚══════════════════════════════════════════════════════════════════╝",
        admin_email,
    )

    # ── 2. Seed 14 synthetic employees ───────────────────────────────────────
    for idx, (name, email, role, dept, pwd) in enumerate(SYNTHETIC_EMPLOYEES, start=2):
        emp_id = f"EMP_{idx:03d}"
        await q.create_employee(
            employee_id=emp_id,
            full_name=name,
            email=email,
            password_hash=hash_password(pwd),
            role=role,
            department=dept,
            created_by="EMP_001",  # Created by seed admin
        )

    logger.info(
        f"Seeded 15 employees (1 admin from env + 14 synthetic) into employees table"
    )
