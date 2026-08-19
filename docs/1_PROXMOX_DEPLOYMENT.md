# Infrastructure & Deployment Plan (Proxmox Self-Host)

## 1. General Information
- **Project Name:** RabbitPOS (Tho Juice and Coffee)
- **Environment:** Proxmox VE (Virtual Environment).
- **Root Domain:** `ndnworks.com`
- **Target Subdomains:**
  - App UI (Frontend): `rabbitpos.ndnworks.com`
  - Backend API: `rabbitpos-api.ndnworks.com`

## 2. Server Architecture (LXC Container)
We prioritize **Ubuntu 22.04/24.04 LTS LXC (Linux Container)** on Proxmox to optimize hardware resources (RAM/CPU) compared to traditional VMs.
- **Initial Resource Allocation:** 2 Cores, 4GB RAM, 20GB Storage (Scalable on demand).
- **Runtime Environment:** Docker Engine & Docker Compose plugin.

## 3. Network & Ingress Architecture (Cloudflare Zero Trust Tunnel)
Cloudflare Tunnel (`cloudflared`) establishes secure outbound encrypted tunnels directly to Cloudflare's global edge without opening inbound router ports (Port 80/443 forwarding is not required).

- **Cloudflare Tunnel ID:** `1400d433-eaaf-4593-b991-4c8bbf25f4c9`
- **Tunnel Container:** `rabbitpos-tunnel` (`cloudflare/cloudflared:latest`)
- **Docker Network:** `rabbitpos-network` (bridge)

### Hostname Routing Matrix:

| Public Hostname | Service Protocol | Internal Target Host & Port | Description |
| :--- | :--- | :--- | :--- |
| `rabbitpos.ndnworks.com` | HTTP | `http://rabbitpos-frontend:3000` | Next.js 14 Web Application |
| `rabbitpos-api.ndnworks.com` | HTTP | `http://rabbitpos-backend:8080` | Go Gin RESTful Backend API |

### Fallback Reverse Proxy (Optional):
- **Nginx Proxy Manager (NPM):** Running on container `rabbitpos-npm` (Port 80/443/81) for local direct reverse proxying or LAN access fallback.

---

## 4. Automated Database Backup & Disaster Recovery

### Daily Automated Backup (Cron Job)
RabbitPOS includes a production-grade automated database backup script with a **14-day retention policy**.

To configure automated backups every night at 3:00 AM, add the following cron job to the host system (`crontab -e`):
```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

### Manual Backup On-Demand
To take an immediate database backup before major updates:
```bash
/opt/RabbitPOS/scripts/backup.sh
```
Backup archives are stored at `/opt/RabbitPOS/backups/backup_YYYYMMDD_HHMMSS.sql.gz`.

### Database Restoration Procedure
To restore a database snapshot:
```bash
# Interactive selection:
/opt/RabbitPOS/scripts/restore.sh

# Direct file restore with auto-confirmation:
/opt/RabbitPOS/scripts/restore.sh /opt/RabbitPOS/backups/backup_20260819_073824.sql.gz --yes
```