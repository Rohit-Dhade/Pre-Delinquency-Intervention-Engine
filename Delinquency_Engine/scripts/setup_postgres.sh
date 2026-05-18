#!/bin/bash
# ── PostgreSQL Setup for Pre-Delinquency Engine ──────────────────────────────
# Run with:  sudo bash scripts/setup_postgres.sh

set -euo pipefail

echo "▸ Installing PostgreSQL..."
apt-get update -qq
apt-get install -y postgresql postgresql-contrib

echo "▸ Starting PostgreSQL..."
systemctl start postgresql
systemctl enable postgresql

echo "▸ Creating user 'rohit' and database 'delinquency_db'..."
sudo -u postgres psql <<SQL
-- Create the role (if it doesn't already exist)
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rohit') THEN
        CREATE ROLE rohit WITH LOGIN PASSWORD '@sy2026' CREATEDB;
    ELSE
        ALTER ROLE rohit WITH PASSWORD '@sy2026';
    END IF;
END
\$\$;

-- Create the database
SELECT 'CREATE DATABASE delinquency_db OWNER rohit'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'delinquency_db')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE delinquency_db TO rohit;
SQL

echo "▸ Running DDL..."
PGPASSWORD='@sy2026' psql -h localhost -U rohit -d delinquency_db -f "$(dirname "$0")/ddl.sql"

echo "✔ PostgreSQL setup complete!"
echo "  Database : delinquency_db"
echo "  User     : rohit"
echo "  Host     : localhost:5432"
