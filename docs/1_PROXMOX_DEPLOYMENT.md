# Infrastructure & Deployment Plan (Proxmox Self-Host)

## 1. General Information
- **Project Name:** RabbitPOS (Tho Juice & Coffee)
- **Environment:** Proxmox VE 8.x / 9.x (Virtual Environment)
- **Root Domain:** `ndnworks.com`
- **Target Subdomains:**
  - App UI (Unified Frontend & API Proxy): `rabbitpos.ndnworks.com`
  - Backend Direct API (Optional): `rabbitpos-api.ndnworks.com`

---

## 2. Server Architecture (LXC Container)
We prioritize **Ubuntu 24.04 LTS LXC (Linux Container)** on Proxmox to optimize hardware resources (RAM/CPU/Disk) compared to traditional VMs.
- **Resource Allocation:** 2 Cores, 2048MB RAM, 512MB Swap, 20GB Storage (`local-lvm`, expandable).
- **LXC Container Options:** `unprivileged=1`, `nesting=1`, `keyctl=1` (required for running Docker inside LXC).
- **Runtime Environment:** Docker Engine 26+, Docker Compose v2 plugin.

---

## 3. Network & Ingress Architecture

### Cloudflare Zero Trust Tunnel
Cloudflare Tunnel (`cloudflared`) establishes an outbound encrypted TLS tunnel directly to Cloudflare's global edge without opening inbound ports on the router/firewall.

- **Tunnel Container:** `rabbitpos-tunnel` (`cloudflare/cloudflared:latest`)
- **Docker Network:** `rabbitpos-network` (bridge)
- **Hostname Routing Matrix:**

| Public Hostname | Service Protocol | Internal Target Host & Port | Description |
| :--- | :--- | :--- | :--- |
| `rabbitpos.ndnworks.com` | HTTP | `http://rabbitpos-frontend:3000` | Next.js 14 Web Application |
| `rabbitpos-api.ndnworks.com` | HTTP | `http://rabbitpos-backend:8080` | Go Gin RESTful Backend API |

### Fallback Reverse Proxy (Nginx Proxy Manager)
- **Container:** `rabbitpos-npm` (`jc21/nginx-proxy-manager:latest`)
- **Ports:** 80 (HTTP), 443 (HTTPS), 81 (Admin Web GUI)
- **Purpose:** Local network access, direct SSL termination, and fallback reverse proxying.

---

## 4. Container Services Topology

```
[ Proxmox LXC Container (CT 200 / rabbitpos-lxc) ]
├── rabbitpos-postgres   : PostgreSQL 16 Alpine (Port 5432)
├── rabbitpos-backend    : Go 1.22+ Gin API (Port 8080)
├── rabbitpos-frontend   : Next.js 14 App Router (Port 3000)
├── rabbitpos-npm        : Nginx Proxy Manager (Port 80, 443, 81)
└── rabbitpos-tunnel     : Cloudflare Tunnel Agent (Outbound only)
```

---

## 5. Automated Database Backup & Disaster Recovery

### Daily Automated Backup (Cron Job)
RabbitPOS includes a production-grade automated database and media backup script with a **14-day retention policy**.

To configure automated backups every night at 3:00 AM, add the following cron job inside the LXC container (`crontab -e`):
```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

### Manual Backup On-Demand
To take an immediate full snapshot (PostgreSQL database dump + uploads directory):
```bash
/opt/RabbitPOS/scripts/backup.sh
```
Backup archives are saved to:
- Database: `/opt/RabbitPOS/backups/backup_db_YYYYMMDD_HHMMSS.sql.gz`
- Media Assets: `/opt/RabbitPOS/backups/backup_uploads_YYYYMMDD_HHMMSS.tar.gz`

### Database Restoration Procedure
To restore an existing database snapshot:
```bash
# Interactive selection:
/opt/RabbitPOS/scripts/restore.sh

# Direct file restore with auto-confirmation:
/opt/RabbitPOS/scripts/restore.sh /opt/RabbitPOS/backups/backup_db_20260821_003357.sql.gz -y
```

---

## 6. One-Command Setup & Deployment Scripts
- **`scripts/setup-proxmox-lxc.sh`**: Provision unprivileged Ubuntu 24.04 LXC container with Docker nesting and UFW on Proxmox VE host.
- **`scripts/deploy.sh`**: Pull latest code, build Docker images, execute migrations, verify health endpoints, and perform zero-downtime container replacement.