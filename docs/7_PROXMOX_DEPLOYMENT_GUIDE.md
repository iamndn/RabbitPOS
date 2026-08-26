# RabbitPOS - Production Proxmox VE 8.x/9.x Deployment Guide

This guide provides end-to-end instructions for deploying the **RabbitPOS** infrastructure on **Proxmox VE 8.x/9.x** using an unprivileged Ubuntu 24.04 LTS LXC container, Docker Engine, Nginx Proxy Manager (NPM), Cloudflare DNS / Zero Trust Tunnel, and Let's Encrypt SSL certificates.

---

## 1. Architecture Overview

```
                         [ Internet Traffic ]
                                  │
                                  ▼
                      [ Cloudflare Edge DNS ]
            (Proxy Mode: Orange Cloud - IP Masking / Zero Trust)
                ├── rabbitpos.ndnworks.com     (App UI & Unified /api/v1)
                └── rabbitpos-api.ndnworks.com (Direct Backend API)
                                  │
                                  ▼
              [ Proxmox VE Host (Public Router / Port Forward) ]
                          Ports 80, 443 -> LXC IP
                                  │
                                  ▼
          ┌────────────────────────────────────────────────────────┐
          │      Ubuntu 24.04 LTS Unprivileged LXC Container       │
          │          (2 Cores, 2GB RAM, 20GB Disk, Nesting=1)      │
          │                                                        │
          │   ┌────────────────────────────────────────────────┐   │
          │   │   Nginx Proxy Manager Container (Port 80/443/81)│   │
          │   └───────────────────────┬────────────────────────┘   │
          │                           │ Internal Docker Bridge     │
          │             ┌─────────────┴─────────────┐              │
          │             ▼                           ▼              │
          │   ┌───────────────────┐       ┌───────────────────┐    │
          │   │  Next.js Frontend │       │  Go Backend API   │    │
          │   │    (Port 3000)    │       │    (Port 8080)    │    │
          │   └─────────┬─────────┘       └─────────┬─────────┘    │
          │             │ (Internal Rewrites)       │              │
          │             └───────────────────────────┤              │
          │                                         │              │
          │                                         ▼              │
          │                               ┌───────────────────┐    │
          │                               │   PostgreSQL 16   │    │
          │                               │    (Port 5432)    │    │
          │                               └───────────────────┘    │
          └────────────────────────────────────────────────────────┘
```

---

## 2. Proxmox VE LXC Container Provisioning

### Step 2.1: Run the Automated LXC Setup Script
Log in to your **Proxmox VE Host Node Shell** via SSH or the PVE Web Console:

```bash
# Download setup script onto PVE host (or copy from repository scripts/setup-proxmox-lxc.sh)
chmod +x setup-proxmox-lxc.sh

# Run provisioning script (Syntax: ./setup-proxmox-lxc.sh [CT_ID] [HOSTNAME] [RAM_MB] [SWAP_MB] [CORES] [DISK_SIZE])
./setup-proxmox-lxc.sh 200 rabbitpos-lxc 2048 512 2 20G
```

### Script Actions Summary:
- **OS Template:** Downloads latest Ubuntu 24.04 LTS LXC template.
- **Resource Allocation:** 2 vCPUs, 2048MB RAM, 512MB Swap, 20GB Storage (`local-lvm`).
- **Docker Support Flags:** Unprivileged (`unprivileged=1`), Nesting (`nesting=1`), Keyctl (`keyctl=1`).
- **Auto-Installations:** Docker Engine 26+, Docker Compose Plugin, Git, Curl, UFW firewall.
- **Firewall Setup:** UFW allows SSH (22), HTTP (80), HTTPS (443), NPM Admin UI (81).

---

## 3. Production Deployment inside LXC Container

### Step 3.1: Enter Container & Clone Repository
Enter the provisioned LXC container shell from the PVE host:

```bash
pct enter 200
```

Inside the LXC container:

```bash
# Navigate to deployment directory
cd /opt
git clone https://github.com/RabbitPOS/RabbitPOS.git
cd /opt/RabbitPOS

# Copy environment variables template
cp .env.example .env
```

### Step 3.2: Configure `.env` File
Edit `.env` to set secure production passwords, secrets, and integration keys:

```bash
nano .env
```

Key environment variables:
```ini
APP_ENV=production
PORT=8080
DB_HOST=postgres
DB_PORT=5432
DB_USER=rabbitpos
DB_PASSWORD=your_secure_db_password
DB_NAME=rabbitpos
JWT_SECRET=your_super_secret_random_jwt_key_here
INITIAL_ADMIN_PASSWORD=your_initial_admin_password
NEXT_PUBLIC_API_URL=https://rabbitpos.ndnworks.com/api/v1
```

### Step 3.3: Deploy Stack via Docker Compose
Run the automated deployment script:

```bash
bash scripts/deploy.sh
```

Or run Docker Compose directly:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 4. Reverse Proxy & Domain Ingress Configuration

### Option A: Cloudflare Zero Trust Tunnel (Recommended)
If using Cloudflare Tunnel, set the `CLOUDFLARE_TUNNEL_TOKEN` in `.env` and start the `tunnel` service defined in `docker-compose.prod.yml`.
Configure public hostnames in Cloudflare Zero Trust Dashboard:
- `rabbitpos.ndnworks.com` -> `http://rabbitpos-frontend:3000`
- `rabbitpos-api.ndnworks.com` -> `http://rabbitpos-backend:8080`

### Option B: Nginx Proxy Manager (Direct Ingress)
1. Open NPM Admin GUI: `http://<LXC_IP>:81`
2. Default login: `admin@example.com` / `changeme` (Change upon first login).
3. Create Proxy Host:
   - **Domain Names:** `rabbitpos.ndnworks.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `rabbitpos-frontend`
   - **Forward Port:** `3000`
   - **SSL:** Request Let's Encrypt SSL Certificate, Force SSL, HTTP/2 Support, HSTS Enabled.

---

## 5. Automated Backups & Disaster Recovery

### Daily Automated Backup (Cron Job)
Add daily backup cron job inside the LXC container (`crontab -e`):

```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

### Manual Snapshot
```bash
bash /opt/RabbitPOS/scripts/backup.sh
```

### Restore Snapshot
```bash
bash /opt/RabbitPOS/scripts/restore.sh
```

---

## 6. Operational Health Checks & Maintenance

```bash
# Check running containers
docker compose -f docker-compose.prod.yml ps

# View backend logs
docker logs -f rabbitpos-backend

# View frontend logs
docker logs -f rabbitpos-frontend

# Health probe check
curl -f http://localhost:8080/api/v1/health
```
