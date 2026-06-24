#!/usr/bin/env bash
# =============================================================================
# Elixir & Oak — Daily Backup Script
# Creates PostgreSQL dump + copies Redis RDB to backup directory.
# Retention: 30 days
# Schedule:  daily via cron at 03:00
# =============================================================================
set -euo pipefail

BACKUP_DIR="/var/backups/elixir-oak"
DB_NAME="elixir_oak"
DB_USER="postgres"
DB_HOST="127.0.0.1"
DB_PORT="5432"
REDIS_DATA_DIR="/var/lib/redis"
REDIS_RDB="dump.rdb"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/elixir-oak/backup.log"

mkdir -p "${BACKUP_DIR}/{postgres,redis,daily}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log "=== Backup started ==="

# ---- 1. PostgreSQL dump ----
log "Dumping PostgreSQL database ${DB_NAME}..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -f "${BACKUP_DIR}/postgres/${DB_NAME}_${TIMESTAMP}.dump" \
  -v 2>>"${LOG_FILE}"

# Compress
gzip -f "${BACKUP_DIR}/postgres/${DB_NAME}_${TIMESTAMP}.dump"
log "PostgreSQL dump complete (${DB_NAME}_${TIMESTAMP}.dump.gz)"

# ---- 2. Redis RDB copy ----
log "Copying Redis RDB snapshot..."
if [ -f "${REDIS_DATA_DIR}/${REDIS_RDB}" ]; then
  cp "${REDIS_DATA_DIR}/${REDIS_RDB}" "${BACKUP_DIR}/redis/redis_${TIMESTAMP}.rdb"
  log "Redis RDB copied."
else
  log "WARNING: Redis RDB not found at ${REDIS_DATA_DIR}/${REDIS_RDB}"
fi

# ---- 3. Create daily symlink ----
ln -sf "${BACKUP_DIR}/postgres/${DB_NAME}_${TIMESTAMP}.dump.gz" "${BACKUP_DIR}/daily/latest.dump.gz"
log "Daily symlink updated."

# ---- 4. Cleanup old backups (> 30 days) ----
log "Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}/postgres" -name "*.dump.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}/redis" -name "*.rdb" -mtime +${RETENTION_DAYS} -delete
log "Cleanup complete."

# ---- 5. Backup size report ----
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
log "Backup directory total size: ${TOTAL_SIZE}"

log "=== Backup completed successfully ==="
