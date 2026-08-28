#!/usr/bin/env bash
# ==============================================================================
# Script: backup.sh
# Description: Production-grade automated backup for RabbitPOS (PostgreSQL + Media + Checksum + Encryption)
# Cron Schedule: 0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
# ==============================================================================

set -eo pipefail

PROJECT_DIR="/opt/RabbitPOS"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${BACKUP_LOG_FILE:-/var/log/rabbitpos_backup.log}"
DO_VERIFY=false

for arg in "$@"; do
    if [ "$arg" = "--verify" ]; then
        DO_VERIFY=true
    fi
done

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    if [ -w "$(dirname "$LOG_FILE" 2>/dev/null)" ] || [ -w "$LOG_FILE" ]; then
        echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
    fi
}

log "=============================================================================="
log "Starting RabbitPOS automated backup routine (Format V2)..."

# 1. Load environment variables if present
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-rabbitpos}"
ENC_KEY="${BACKUP_ENCRYPTION_KEY:-$APP_ENCRYPTION_KEY}"

# 2. Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# 3. Execute PostgreSQL Dump via Docker
DB_BACKUP_FILE="${BACKUP_DIR}/backup_db_${TIMESTAMP}.sql.gz"
log "1. Dumping PostgreSQL database (${DB_NAME})..."

if ! docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DB_BACKUP_FILE"; then
    log "❌ ERROR: Database backup dump failed!"
    exit 1
fi

if [ ! -s "$DB_BACKUP_FILE" ]; then
    log "❌ ERROR: Created database backup is empty!"
    rm -f "$DB_BACKUP_FILE"
    exit 1
fi

DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
log "✅ Database backup saved: $DB_BACKUP_FILE ($DB_SIZE)"

# 4. Generate SHA-256 Checksum for Data Integrity Verification
CHECKSUM_FILE="${DB_BACKUP_FILE}.sha256"
if command -v sha256sum >/dev/null 2>&1; then
    (cd "$BACKUP_DIR" && sha256sum "$(basename "$DB_BACKUP_FILE")" > "$(basename "$CHECKSUM_FILE")")
    log "✅ Generated SHA-256 checksum: $CHECKSUM_FILE"
fi

# 5. Optional Encryption if Encryption Key is Configured
if [ -n "$ENC_KEY" ]; then
    ENC_BACKUP_FILE="${DB_BACKUP_FILE}.enc"
    log "2. Encrypting database backup archive (AES-256-CBC PBKDF2)..."
    export BACKUP_PASS="$ENC_KEY"
    if openssl enc -aes-256-cbc -salt -pbkdf2 -in "$DB_BACKUP_FILE" -out "$ENC_BACKUP_FILE" -pass env:BACKUP_PASS; then
        (cd "$BACKUP_DIR" && sha256sum "$(basename "$ENC_BACKUP_FILE")" > "$(basename "$ENC_BACKUP_FILE").sha256")
        log "✅ Encrypted backup saved: $ENC_BACKUP_FILE ($(du -h "$ENC_BACKUP_FILE" | cut -f1))"
    else
        log "⚠️ Warning: Encryption failed, keeping unencrypted backup archive."
    fi
    unset BACKUP_PASS
fi

# 6. Backup Uploads Media Files (if uploads exist)
UPLOADS_DIR="${PROJECT_DIR}/backend/uploads"
if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    UPLOADS_BACKUP_FILE="${BACKUP_DIR}/backup_uploads_${TIMESTAMP}.tar.gz"
    log "3. Archiving uploaded media files..."
    if tar -czf "$UPLOADS_BACKUP_FILE" -C "${PROJECT_DIR}/backend" uploads; then
        (cd "$BACKUP_DIR" && sha256sum "$(basename "$UPLOADS_BACKUP_FILE")" > "$(basename "$UPLOADS_BACKUP_FILE").sha256" 2>/dev/null || true)
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
        log "✅ Uploads backup saved: $UPLOADS_BACKUP_FILE ($UPLOADS_SIZE)"
    else
        log "⚠️ Warning: Uploads media archive failed (continuing...)"
    fi
fi

# 7. Restore Verification to Temporary Database (if requested)
if [ "$DO_VERIFY" = true ]; then
    TEST_DB="rabbitpos_verify_${TIMESTAMP}"
    log "4. Verifying restore into temporary database (${TEST_DB})..."
    if docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>&1; then
        if gunzip -c "$DB_BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$TEST_DB" >/dev/null 2>&1; then
            log "✅ Restore verification passed: Database restored successfully without errors."
        else
            log "❌ ERROR: Restore verification failed during SQL import!"
        fi
        docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" >/dev/null 2>&1 || true
    else
        log "ℹ️ Skipping temporary database creation check (Docker Postgres not accessible or insufficient permissions)."
    fi
fi

# 8. Retention policy: Remove backups older than ${RETENTION_DAYS} days
log "5. Applying ${RETENTION_DAYS}-day retention cleanup..."
DELETED_DB=$(find "$BACKUP_DIR" -type f \( -name "backup_*.sql.gz*" -o -name "backup_*.enc*" \) -mtime +${RETENTION_DAYS} -print -delete | wc -l)
DELETED_UPLOADS=$(find "$BACKUP_DIR" -type f -name "backup_uploads_*.tar.gz*" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
log "Cleaned up $DELETED_DB old DB archive(s) and $DELETED_UPLOADS old media archive(s)."

log "RabbitPOS backup routine completed successfully. ✅"
log "=============================================================================="
