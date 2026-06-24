#!/usr/bin/env bash
# =============================================================================
# Elixir & Oak — Disaster Recovery Restore Script
# Usage:  sudo bash restore.sh <backup_file>
# Example: sudo bash restore.sh /var/backups/elixir-oak/postgres/elixir_oak_20260624_030000.dump.gz
# =============================================================================
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <postgres_dump.gz_path>"
  echo "Example: $0 /var/backups/elixir-oak/postgres/elixir_oak_20260624_030000.dump.gz"
  exit 1
fi

BACKUP_FILE="$1"
DB_NAME="elixir_oak"
DB_USER="postgres"
DB_HOST="127.0.0.1"
DB_PORT="5432"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "=== Elixir & Oak Restore Procedure ==="
echo "Backup file: ${BACKUP_FILE}"
echo ""

# ---- 1. Stop application ----
echo "[1/4] Stopping application..."
pm2 stop elixir-oak-api 2>/dev/null || echo "  (PM2 not stopping — continuing)"

# ---- 2. Drop and recreate database ----
echo "[2/4] Dropping and recreating database..."
PGPASSWORD="${POSTGRES_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres <<SQL
  SELECT pg_terminate_backend(pg_stat_activity.pid)
  FROM pg_stat_activity
  WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid();
  DROP DATABASE IF EXISTS ${DB_NAME};
  CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
SQL
echo "  Database recreated."

# ---- 3. Restore from backup ----
echo "[3/4] Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -v 2>&1 | tail -20
echo "  Restore complete."

# ---- 4. Restart application ----
echo "[4/4] Restarting application..."
pm2 start elixir-oak-api 2>/dev/null || pm2 start /var/www/elixir-oak/backend/deploy/ecosystem.config.js --env production
echo "  Application restarted."

echo ""
echo "=== Restore completed ==="
echo "Verify at: curl https://api.elixirandoak.com/api/v1/health"
