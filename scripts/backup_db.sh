#!/usr/bin/env bash
# ==============================================================================
# Script: backup_db.sh
# Description: Automated PostgreSQL Database Backup Script for ThoPOS LXC
# Suitable for daily cronjob execution e.g. 0 2 * * * /opt/rabbitpos/scripts/backup_db.sh
# ==============================================================================

set -eo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/thopos}"
DB_CONTAINER="${DB_CONTAINER:-thopos-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-rabbitpos}"
RETENTION_DAYS=7

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/thopos_db_backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting ThoPOS Database Backup..."

# Create backup directory if missing
mkdir -p "${BACKUP_DIR}"

# Execute pg_dump from container or host
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    echo "Running pg_dump inside Docker container '${DB_CONTAINER}'..."
    docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
else
    echo "Running local pg_dump..."
    pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"
fi

# Verify backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date)] ✅ Database backup completed successfully: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Retention Policy Cleanup: Remove backups older than 7 days
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -type f -name "thopos_db_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

echo "[$(date)] Backup maintenance routine complete."
