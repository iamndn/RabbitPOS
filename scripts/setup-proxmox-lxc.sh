#!/usr/bin/env bash
# ==============================================================================
# ThoPOS (RabbitPOS) - Proxmox VE 8.x/9.x LXC Provisioning & Docker Setup Script
# ==============================================================================
# This script is intended to be executed directly on the Proxmox VE Host Node Shell.
# It creates an unprivileged Ubuntu 24.04 LTS LXC container with Docker nesting enabled,
# installs Docker Engine, Docker Compose, UFW firewall, and prepares the deployment env.
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Configuration Variables (Customize as needed)
# ------------------------------------------------------------------------------
CT_ID="${1:-1000}"                         # LXC Container ID
CT_HOSTNAME="${2:-thopos}"           # Hostname of the container
MEMORY="${3:-4096}"                       # RAM in MB (2048MB = 2GB)
SWAP="${4:-4096}"                          # SWAP in MB
CORES="${5:-2}"                           # CPU Cores allocated
DISK_SIZE="${6:-64G}"                     # Disk size (20GB)
STORAGE="${7:-local}"                 # Proxmox storage identifier for rootfs
TEMPLATE_STORAGE="${8:-local}"            # Storage location for ISO/Templates
BRIDGE="${9:-vmbr0}"                      # Network bridge
NET_CONFIG="name=eth0,bridge=${BRIDGE},ip=dhcp"

echo "======================================================================"
echo " Starting ThoPOS LXC Container Provisioning on Proxmox VE Host"
echo " Container ID       : ${CT_ID}"
echo " Hostname           : ${CT_HOSTNAME}"
echo " Cores / RAM / Swap : ${CORES} Cores / ${MEMORY}MB RAM / ${SWAP}MB Swap"
echo " Disk Size / Storage: ${DISK_SIZE} on ${STORAGE}"
echo "======================================================================"

# 1. Ensure PVE environment
if ! command -v pct &> /dev/null; then
    echo "ERROR: 'pct' command not found. This script must be executed on a Proxmox VE host node."
    exit 1
fi

# 2. Check if container ID already exists
if pct status "${CT_ID}" &> /dev/null; then
    echo "ERROR: Container ID ${CT_ID} already exists on this Proxmox host."
    echo "Please choose a different CT_ID or destroy the existing container."
    exit 1
fi

# 3. Download / Verify Ubuntu 24.04 LXC Template
echo "--> Updating Proxmox Appliance Template Database..."
pveam update || true

TEMPLATE_NAME="ubuntu-24.04-standard_24.04-1_amd64.tar.zst"
# Search for latest available Ubuntu 24.04 template in pveam
LATEST_TEMPLATE=$(pveam available --section system | grep "ubuntu-24.04" | awk '{print $2}' | tail -n 1)

if [ -n "${LATEST_TEMPLATE}" ]; then
    TEMPLATE_NAME="${LATEST_TEMPLATE}"
fi

echo "--> Verifying LXC template: ${TEMPLATE_NAME}"
if ! pveam list "${TEMPLATE_STORAGE}" | grep -q "${TEMPLATE_NAME}"; then
    echo "--> Downloading LXC template ${TEMPLATE_NAME} to ${TEMPLATE_STORAGE}..."
    pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE_NAME}"
fi

TEMPLATE_PATH="/var/lib/vz/template/cache/${TEMPLATE_NAME}"
if [ ! -f "${TEMPLATE_PATH}" ]; then
    # Fallback path check if template storage is different
    TEMPLATE_PATH=$(pveam list "${TEMPLATE_STORAGE}" | grep "ubuntu-24.04" | awk '{print $1}' | head -n 1)
fi

# 4. Create Unprivileged LXC Container with Docker Nesting & Keyctl Enabled
echo "--> Creating LXC Container ${CT_ID} (${CT_HOSTNAME})..."
pct create "${CT_ID}" "${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_NAME}" \
    --hostname "${CT_HOSTNAME}" \
    --cores "${CORES}" \
    --memory "${MEMORY}" \
    --swap "${SWAP}" \
    --storage "${STORAGE}" \
    --rootfs "${STORAGE}:${DISK_SIZE}" \
    --net0 "${NET_CONFIG}" \
    --unprivileged 1 \
    --features nesting=1,keyctl=1 \
    --onboot 1 \
    --start 1

echo "--> Waiting for LXC container ${CT_ID} to initialize network..."
sleep 8

# 5. Bootstrap Container System & Dependencies
echo "--> Bootstrapping OS packages inside container ${CT_ID}..."
pct exec "${CT_ID}" -- bash -c "
    export DEBIAN_FRONTEND=noninteractive
    echo '--> Updating APT repositories...'
    apt-get update && apt-get upgrade -y

    echo '--> Installing baseline tools (curl, git, ufw, ca-certificates, gnupg)...'
    apt-get install -y ca-certificates curl gnupg lsb-release git ufw

    echo '--> Setting up Docker Official APT Repository...'
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \$(. /etc/os-release && echo \"\$VERSION_CODENAME\") stable\" > /etc/apt/sources.list.d/docker.list
    apt-get update

    echo '--> Installing Docker Engine and Docker Compose plugin...'
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    echo '--> Enabling Docker service...'
    systemctl enable --now docker

    echo '--> Configuring UFW Firewall...'
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP'
    ufw allow 443/tcp comment 'HTTPS'
    ufw allow 81/tcp comment 'Nginx Proxy Manager Admin UI'
    ufw --force enable

    echo '--> Creating application directory /opt/rabbitpos...'
    mkdir -p /opt/rabbitpos
"

# 6. Retrieve Container IP Address
CONTAINER_IP=$(pct exec "${CT_ID}" -- ip -4 addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n 1 || echo "Unknown")

echo "======================================================================"
echo " SUCCESS: ThoPOS LXC Container ${CT_ID} is fully provisioned!"
echo "======================================================================"
echo " Container ID : ${CT_ID}"
echo " Hostname     : ${CT_HOSTNAME}"
echo " IP Address   : ${CONTAINER_IP}"
echo ""
echo " Next Steps:"
echo " 1. Access LXC container shell:"
echo "    pct enter ${CT_ID}"
echo ""
echo " 2. Navigate to /opt/rabbitpos and clone repository:"
echo "    cd /opt/rabbitpos"
echo "    git clone https://github.com/YourOrg/RabbitPOS.git ."
echo ""
echo " 3. Copy environment file and start production stack:"
echo "    cp .env.example .env"
echo "    docker compose -f docker-compose.prod.yml up -d"
echo ""
echo " 4. Access Nginx Proxy Manager Admin UI:"
echo "    http://${CONTAINER_IP}:81"
echo "======================================================================"
