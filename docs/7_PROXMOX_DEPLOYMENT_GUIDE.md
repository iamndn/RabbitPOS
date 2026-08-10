# RabbitPOS (RabbitPOS) - Production Proxmox VE 8.x/9.x Deployment Guide

This guide provides end-to-end instructions for deploying the **RabbitPOS (RabbitPOS)** infrastructure on **Proxmox VE 8.x/9.x** using an unprivileged Ubuntu 24.04 LTS LXC container, Docker Engine, Nginx Proxy Manager (NPM), Cloudflare DNS, and Let's Encrypt SSL certificates.

---

## 1. Architecture Overview

```
                        [ Internet Traffic ]
                                 │
                                 ▼
                     [ Cloudflare Edge DNS ]
           (Proxy Mode: Orange Cloud - Orange IP Masking)
               ├── rabbitpos.ndnworks.com     (App UI)
               └── api.rabbitpos.ndnworks.com (Backend API)
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
         │   └───────────────────┘       └─────────┬─────────┘    │
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
Log in to your **Proxmox VE Host Node Shell** via SSH or the PVE Web Console, download or copy [scripts/setup-proxmox-lxc.sh](file:///d:/Projects/RabbitPOS/scripts/setup-proxmox-lxc.sh), and make it executable:

```bash
# Download setup script onto PVE host
curl -fsSL https://raw.githubusercontent.com/YourOrg/RabbitPOS/main/scripts/setup-proxmox-lxc.sh -o setup-proxmox-lxc.sh
chmod +x setup-proxmox-lxc.sh

# Run provisioning script (Syntax: ./setup-proxmox-lxc.sh [CT_ID] [HOSTNAME] [RAM_MB] [SWAP_MB] [CORES] [DISK_SIZE])
./setup-proxmox-lxc.sh 100 rabbitpos-lxc 2048 512 2 20G
```

### Script Execution Summary:
- **OS Template:** Downloads Ubuntu 24.04 LTS LXC template.
- **Resource Allocation:** 2 vCPUs, 2048MB RAM, 512MB Swap, 20GB Storage (`local-lvm`).
- **Docker Support Flags:** Unprivileged (`unprivileged=1`), Nesting (`nesting=1`), Keyctl (`keyctl=1`).
- **Auto-Installations:** Docker Engine, Docker Compose Plugin, Git, Curl, UFW firewall.
- **Firewall Setup:** UFW allows SSH (22), HTTP (80), HTTPS (443), NPM Admin UI (81).

---

## 3. Production Deployment inside LXC Container

### Step 3.1: Enter Container & Clone Repository
Enter the provisioned LXC container shell from the PVE host:

```bash
pct enter 100
```

Inside the LXC container:

```bash
# Navigate to deployment directory
cd /opt/rabbitpos

# Clone repository
git clone https://github.com/YourOrg/RabbitPOS.git .

# Copy environment variables template
cp .env.example .env
```

### Step 3.2: Configure `.env` File
Edit `.env` to set secure production passwords:

```bash
nano .env
```

Ensure the following variables are configured:

```ini
# PostgreSQL Production Settings
POSTGRES_USER=rabbitpos_user
POSTGRES_PASSWORD=YOUR_STRONG_DB_PASSWORD_HERE
POSTGRES_DB=rabbitpos_prod
POSTGRES_PORT=5432

# Backend API Settings
BACKEND_PORT=8080
APP_ENV=production
CORS_ALLOWED_ORIGINS=https://rabbitpos.ndnworks.com,http://rabbitpos.ndnworks.com

# Frontend Settings
FRONTEND_PORT=3000
NEXT_PUBLIC_API_URL=https://api.rabbitpos.ndnworks.com/api/v1
```

### Step 3.3: Launch Production Docker Stack
Start the production stack (Nginx Proxy Manager, PostgreSQL, Go Backend, Next.js Frontend):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Verify that all containers are healthy and running:

```bash
docker compose -f docker-compose.prod.yml ps
```

---

## 4. Cloudflare DNS & Reverse Proxy Setup

### Step 4.1: Cloudflare DNS Records Setup
Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to domain `ndnworks.com` -> **DNS** -> **Records**.

Add the following DNS records:

| Type | Name | IPv4 Address / Target | Proxy Status | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `rabbitpos` | `<YOUR_PROXMOX_PUBLIC_IP>` | **Proxied** (Orange Cloud) | Auto |
| **A** | `api.rabbitpos` | `<YOUR_PROXMOX_PUBLIC_IP>` | **Proxied** (Orange Cloud) | Auto |

> [!TIP]
> **Cloudflare SSL/TLS Encryption Mode:**
> Go to **SSL/TLS** -> **Overview** in Cloudflare and set the encryption mode to **Full** or **Full (Strict)**.

---

## 5. Nginx Proxy Manager (NPM) & SSL Certificate Setup

### Step 5.1: Access NPM Admin Dashboard
1. Open your web browser and navigate to `http://<LXC_CONTAINER_IP>:81`.
2. Initial default credentials:
   - **Email:** `admin@example.com`
   - **Password:** `changeme`
3. Promptly update the administrator email, name, and default password upon first login.

---

### Step 5.2: Configure Proxy Host for Frontend (`rabbitpos.ndnworks.com`)
1. Click **Hosts** -> **Proxy Hosts** -> **Add Proxy Host**.
2. **Details Tab:**
   - **Domain Names:** `rabbitpos.ndnworks.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `frontend` (or internal LXC IP e.g. `127.0.0.1`)
   - **Forward Port:** `3000`
   - **Block Common Exploits:** Checked
   - **Websockets Support:** Checked
3. **SSL Tab:**
   - **SSL Certificate:** Select *Request a new SSL Certificate*.
   - **Force SSL:** Checked
   - **HTTP/2 Support:** Checked
   - **Email Address for Let's Encrypt:** `admin@ndnworks.com`
   - **I Agree to the Let's Encrypt Terms of Service:** Checked
4. Click **Save**.

---

### Step 5.3: Configure Proxy Host for Backend API (`api.rabbitpos.ndnworks.com`)
1. Click **Hosts** -> **Proxy Hosts** -> **Add Proxy Host**.
2. **Details Tab:**
   - **Domain Names:** `api.rabbitpos.ndnworks.com`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `backend` (or internal LXC IP e.g. `127.0.0.1`)
   - **Forward Port:** `8080`
   - **Block Common Exploits:** Checked
   - **Websockets Support:** Checked
3. **SSL Tab:**
   - **SSL Certificate:** Select *Request a new SSL Certificate*.
   - **Force SSL:** Checked
   - **HTTP/2 Support:** Checked
   - **Email Address for Let's Encrypt:** `admin@ndnworks.com`
   - **I Agree to the Let's Encrypt Terms of Service:** Checked
4. Click **Save**.

---

## 6. Port Forwarding Rules (Router / Proxmox Gateway)

Ensure your external router or firewall forwards incoming public web traffic to the LXC container:

| Protocol | External Port | Internal LXC IP | Internal Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **TCP** | `80` | `<LXC_CONTAINER_IP>` | `80` | HTTP traffic for SSL verification & redirection |
| **TCP** | `443` | `<LXC_CONTAINER_IP>` | `443` | HTTPS secure web traffic |

---

## 7. Verification & Health Checks

Verify your production endpoints in browser or terminal:

1. **Frontend Web Interface:**
   - URL: `https://rabbitpos.ndnworks.com`
   - Expect: Next.js POS Landing Page with status badge showing **Online**.

2. **Backend API Health Check Endpoint:**
   - URL: `https://api.rabbitpos.ndnworks.com/api/v1/health`
   - Expect JSON response:
     ```json
     {
       "status": "success",
       "data": {
         "app": "RabbitPOS API",
         "version": "1.0.0",
         "db_connected": true
       },
       "message": "Service is healthy"
     }
     ```

3. **Backend API Categories Endpoint:**
   - URL: `https://api.rabbitpos.ndnworks.com/api/v1/categories`
   - Expect JSON response:
     ```json
     {
       "status": "success",
       "data": [],
       "message": "Categories retrieved successfully"
     }
     ```
