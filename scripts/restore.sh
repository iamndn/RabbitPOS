#!/usr/bin/env bash
# ==============================================================================
# Script: restore.sh
# Description: Production-grade PostgreSQL database restore utility for RabbitPOS
# Usage: ./scripts/restore.sh [/path/to/backup.sql.gz] [--yes]
# ==============================================================================

set -eo pipefail

PROJECT_DIR="/opt/RabbitPOS"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

echo "=============================================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] RabbitPOS Database Restore Utility"
echo "=============================================================================="

# 1. Load environment variables
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
    set +a
fi

DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-rabbitpos}"

TARGET_FILE=""
AUTO_CONFIRM=false

for arg in "$@"; do
    if [ "$arg" = "-y" ] || [ "$arg" = "--yes" ]; then
        AUTO_CONFIRM=true
    elif [ -f "$arg" ]; then
        TARGET_FILE="$arg"
    fi
done

# 2. Select backup file if not provided as argument
if [ -z "$TARGET_FILE" ]; then
    echo "Available backup files in ${BACKUP_DIR}:"
    mkdir -p "$BACKUP_DIR"
    
    # Store files in array
    mapfile -t BACKUP_FILES < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "backup_*.sql.gz" -o -name "*.sql.gz" | sort -r)
    
    if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
        echo "❌ No backup archives (.sql.gz) found in ${BACKUP_DIR}." >&2
        exit 1
    fi

    for i in "${!BACKUP_FILES[@]}"; do
        FILE_PATH="${BACKUP_FILES[$i]}"
        FILE_SIZE=$(du -h "$FILE_PATH" | cut -f1)
        FILE_DATE=$(date -r "$FILE_PATH" '+%Y-%m-%d %H:%M:%S')
        printf "  [%d] %s (%s, %s)\n" "$((i + 1))" "$(basename "$FILE_PATH")" "$FILE_SIZE" "$FILE_DATE"
    done

    echo ""
    read -rp "Enter choice number [1-${#BACKUP_FILES[@]}]: " CHOICE
    
    if ! [[ "$CHOICE" =~ ^[0-9]+$ ]] || [ "$CHOICE" -lt 1 ] || [ "$CHOICE" -gt "${#BACKUP_FILES[@]}" ]; then
        echo "❌ Invalid selection. Aborting." >&2
        exit 1
    fi
    
    TARGET_FILE="${BACKUP_FILES[$((CHOICE - 1))]}"
fi

if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ ERROR: Backup file does not exist: $TARGET_FILE" >&2
    exit 1
fi

echo ""
echo "Selected Backup: $TARGET_FILE ($(du -h "$TARGET_FILE" | cut -f1))"
echo "Target Database: $DB_NAME (User: $DB_USER)"

# 3. User Confirmation Prompt
if [ "$AUTO_CONFIRM" = false ]; then
    echo ""
    echo "⚠️  WARNING: Restoring will overwrite existing data in database '${DB_NAME}'!"
    read -rp "Are you sure you want to proceed? (yes/NO): " CONFIRM
    if [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

# 4. Perform Restore
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database restoration..."

if [[ "$TARGET_FILE" == *.gz ]]; then
    gunzip -c "$TARGET_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" > /dev/null
else
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < "$TARGET_FILE" > /dev/null
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Database restore completed successfully!"
echo "=============================================================================="
