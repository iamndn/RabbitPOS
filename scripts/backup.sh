#!/usr/bin/env bash
# ==============================================================================
# Script: backup.sh
# Description: Production-grade automated backup for RabbitPOS (PostgreSQL + Media)
# Cron Schedule: 0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
# ==============================================================================

set -eo pipefail

PROJECT_DIR="/opt/RabbitPOS"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

echo "=============================================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting RabbitPOS automated backup routine..."

# 1. Load environment variables if present
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-rabbitpos}"

# 2. Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# 3. Execute PostgreSQL Dump via Docker
DB_BACKUP_FILE="${BACKUP_DIR}/backup_db_${TIMESTAMP}.sql.gz"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 1. Dumping PostgreSQL database (${DB_NAME})..."

if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DB_BACKUP_FILE"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Database backup dump failed!" >&2
    exit 1
fi

if [ ! -s "$DB_BACKUP_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Created database backup is empty!" >&2
    rm -f "$DB_BACKUP_FILE"
    exit 1
fi

DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Database backup saved: $DB_BACKUP_FILE ($DB_SIZE)"

# 4. Backup Uploads Media Files (if uploads exist)
UPLOADS_DIR="${PROJECT_DIR}/backend/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    UPLOADS_BACKUP_FILE="${BACKUP_DIR}/backup_uploads_${TIMESTAMP}.tar.gz"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 2. Archiving uploaded media files..."
    if tar -czf "$UPLOADS_BACKUP_FILE" -C "${PROJECT_DIR}/backend" uploads; then
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Uploads backup saved: $UPLOADS_BACKUP_FILE ($UPLOADS_SIZE)"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ Warning: Uploads media archive failed (continuing...)"
    fi
fi

# 5. Retention policy: Remove backups older than ${RETENTION_DAYS} days
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 3. Applying ${RETENTION_DAYS}-day retention cleanup..."
DELETED_DB=$(find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
DELETED_UPLOADS=$(find "$BACKUP_DIR" -type f -name "backup_*.tar.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned up $DELETED_DB old DB backup(s) and $DELETED_UPLOADS old media archive(s)."

echo "[$(date '+%Y-%m-%d %H:%M:%S')] RabbitPOS backup routine completed successfully. ✅"
echo "=============================================================================="
