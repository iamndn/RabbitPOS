#!/usr/bin/env bash
# ==============================================================================
# Script: backup.sh
# Description: Production-grade automated PostgreSQL backup for RabbitPOS
# Daily cron: 0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
# ==============================================================================

set -eo pipefail

PROJECT_DIR="/opt/RabbitPOS"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql.gz"

echo "=============================================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting RabbitPOS automated database backup..."

# 1. Load environment variables if present
if [ -f "$ENV_FILE" ]; then
    # Export only valid non-comment lines
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-rabbitpos}"

# 2. Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# 3. Execute PostgreSQL Dump via Docker Compose
if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Database backup dump failed!" >&2
    exit 1
fi

# 4. Validate backup file size
if [ ! -s "$BACKUP_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Created backup file is empty!" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Database backup successfully created:"
echo "    File: $BACKUP_FILE"
echo "    Size: $FILE_SIZE"

# 5. Retention policy: Remove backups older than 14 days
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Applying ${RETENTION_DAYS}-day retention cleanup..."
DELETED_COUNT=$(find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} | wc -l)
find "$BACKUP_DIR" -type f -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaned up $DELETED_COUNT old backup archive(s)."

echo "[$(date '+%Y-%m-%d %H:%M:%S')] RabbitPOS backup routine completed."
echo "=============================================================================="
