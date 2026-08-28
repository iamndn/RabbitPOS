#!/usr/bin/env bash
# ==============================================================================
# Script: restore.sh
# Description: Production-grade PostgreSQL database restore utility for RabbitPOS (with Checksum & Decryption)
# Usage: ./scripts/restore.sh [/path/to/backup.sql.gz] [--yes] [--verify-only]
# ==============================================================================

set -eo pipefail

PROJECT_DIR="/opt/RabbitPOS"
BACKUP_DIR="${PROJECT_DIR}/backups"
ENV_FILE="${PROJECT_DIR}/.env"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

echo "=============================================================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] RabbitPOS Database Restore Utility (V2)"
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
ENC_KEY="${BACKUP_ENCRYPTION_KEY:-$APP_ENCRYPTION_KEY}"

TARGET_FILE=""
AUTO_CONFIRM=false
VERIFY_ONLY=false

for arg in "$@"; do
    if [ "$arg" = "-y" ] || [ "$arg" = "--yes" ]; then
        AUTO_CONFIRM=true
    elif [ "$arg" = "--verify-only" ] || [ "$arg" = "--dry-run" ]; then
        VERIFY_ONLY=true
    elif [ -f "$arg" ]; then
        TARGET_FILE="$arg"
    fi
done

# 2. Select backup file if not provided as argument
if [ -z "$TARGET_FILE" ]; then
    echo "Available backup files in ${BACKUP_DIR}:"
    mkdir -p "$BACKUP_DIR"
    
    mapfile -t BACKUP_FILES < <(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name "backup_*.sql.gz" -o -name "backup_*.enc" \) | sort -r)
    
    if [ ${#BACKUP_FILES[@]} -eq 0 ]; then
        echo "❌ No backup archives (.sql.gz / .enc) found in ${BACKUP_DIR}." >&2
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

# 3. Checksum Verification
CHECKSUM_FILE="${TARGET_FILE}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Verifying SHA-256 Checksum..."
    if (cd "$(dirname "$TARGET_FILE")" && sha256sum -c "$(basename "$CHECKSUM_FILE")" >/dev/null 2>&1); then
        echo "✅ Checksum verification passed! Backup file is authentic and intact."
    else
        echo "❌ ERROR: SHA-256 Checksum mismatch! The backup file may be corrupted or tampered with." >&2
        exit 1
    fi
else
    echo "ℹ️ Note: No .sha256 signature file found. Skipping checksum verification."
fi

# 4. Decryption if file has .enc extension
TEMP_DECRYPTED=""
if [[ "$TARGET_FILE" == *.enc ]]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Encrypted backup detected. Decrypting..."
    if [ -z "$ENC_KEY" ]; then
        read -rsp "Enter backup decryption passphrase: " ENC_KEY
        echo ""
    fi

    TEMP_DECRYPTED="/tmp/rabbitpos_restore_$(date +%s).sql.gz"
    export BACKUP_PASS="$ENC_KEY"
    if ! openssl enc -d -aes-256-cbc -salt -pbkdf2 -in "$TARGET_FILE" -out "$TEMP_DECRYPTED" -pass env:BACKUP_PASS 2>/dev/null; then
        echo "❌ ERROR: Failed to decrypt backup file. Incorrect encryption key or corrupted archive." >&2
        unset BACKUP_PASS
        exit 1
    fi
    unset BACKUP_PASS
    TARGET_FILE="$TEMP_DECRYPTED"
    echo "✅ Backup decrypted successfully."
fi

cleanup() {
    if [ -n "$TEMP_DECRYPTED" ] && [ -f "$TEMP_DECRYPTED" ]; then
        rm -f "$TEMP_DECRYPTED"
    fi
}
trap cleanup EXIT

# 5. Verify Only (Dry-run) Option
if [ "$VERIFY_ONLY" = true ]; then
    echo ""
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running restore verification in dry-run mode..."
    TEST_DB="rabbitpos_dryrun_$(date +%s)"
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>&1 || true
    if gunzip -c "$TARGET_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$TEST_DB" >/dev/null 2>&1; then
        echo "✅ Dry-run restore test successful! Backup archive is 100% valid."
    else
        echo "❌ Dry-run restore failed during SQL execution!" >&2
        docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" >/dev/null 2>&1 || true
        exit 1
    fi
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -c "DROP DATABASE ${TEST_DB};" >/dev/null 2>&1 || true
    echo "Dry-run verification completed. No changes were made to production database '${DB_NAME}'."
    exit 0
fi

# 6. User Confirmation Prompt
if [ "$AUTO_CONFIRM" = false ]; then
    echo ""
    echo "⚠️  WARNING: Restoring will completely overwrite existing data in database '${DB_NAME}'!"
    read -rp "Are you sure you want to proceed? (yes/NO): " CONFIRM
    if [ "$CONFIRM" != "yes" ] && [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
        echo "Restore cancelled by user."
        exit 0
    fi
fi

# 7. Perform Real Restore
echo ""
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database restoration into '${DB_NAME}'..."

if [[ "$TARGET_FILE" == *.gz ]]; then
    gunzip -c "$TARGET_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" > /dev/null
else
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" < "$TARGET_FILE" > /dev/null
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Database restore completed successfully!"
echo "=============================================================================="
