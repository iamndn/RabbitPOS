#!/usr/bin/env bash
# ==============================================================================
# Script: setup-proxmox-backup.sh
# Description: Set up automated periodic backups on the Proxmox VE Host for RabbitPOS
# Note: This script is intended to be executed on the PROXMOX VE HOST (or via SSH)
# ==============================================================================

set -euo pipefail

CT_ID="${1:-1000}"                          # Default LXC Container ID
STORAGE="${2:-local}"                       # Backup destination storage in Proxmox
SCHEDULE="${3:-0 2 * * *}"                  # 02:00 AM daily
KEEP_LAST="${4:-7}"                         # Keep last 7 backups

echo "=============================================================================="
echo " Proxmox VE Automated Backup Setup for RabbitPOS (CT ${CT_ID})"
echo "=============================================================================="

# Check if running on Proxmox VE host
if ! command -v pvesm &> /dev/null || ! command -v vzdump &> /dev/null; then
    echo "⚠️  NOTE: This script is designed to run directly on the Proxmox VE Host Node Shell."
    echo "If you are inside the LXC container, run this command on the Proxmox Host:"
    echo ""
    echo "  vzdump ${CT_ID} --mode snapshot --compress zstd --storage ${STORAGE} --prune-backups keep-last=${KEEP_LAST}"
    echo ""
    exit 0
fi

# Verify container exists on host
if ! pct status "${CT_ID}" &> /dev/null; then
    echo "❌ ERROR: LXC Container ID ${CT_ID} does not exist on this Proxmox node."
    exit 1
fi

echo "--> Verified LXC Container ${CT_ID} is present."

# Configure /etc/pve/vzdump.cron or crontab on Host
CRON_JOB="${SCHEDULE} root vzdump ${CT_ID} --mode snapshot --compress zstd --storage ${STORAGE} --prune-backups keep-last=${KEEP_LAST} --quiet 1"

if grep -q "vzdump ${CT_ID}" /etc/crontab 2>/dev/null; then
    echo "--> Backup cron job already exists in /etc/crontab. Updating..."
    sed -i "/vzdump ${CT_ID}/c\\${CRON_JOB}" /etc/crontab
else
    echo "--> Adding backup schedule to /etc/crontab on Proxmox Host..."
    echo "${CRON_JOB}" >> /etc/crontab
fi

echo "=============================================================================="
echo " ✅ Proxmox VE Backup Schedule Configured Successfully!"
echo "    Container ID : ${CT_ID}"
echo "    Schedule     : ${SCHEDULE} (Daily at 02:00 AM)"
echo "    Mode         : Snapshot (Zero downtime)"
echo "    Storage      : ${STORAGE}"
echo "    Retention    : Keep last ${KEEP_LAST} backups"
echo "=============================================================================="
