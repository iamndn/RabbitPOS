# Infrastructure & Deployment Plan (Proxmox Self-Host)

## 1. General Information
- **Project Name:** RabbitPOS (Tho Juice and Coffee)
- **Environment:** Proxmox VE (Virtual Environment).
- **Root Domain:** `ndnworks.com`
- **Target Subdomains:**
  - App UI & Unified API: `rabbitpos.ndnworks.com` (proxies `/api/v1` to Go backend)
  - Dedicated API (Optional): `rabbitpos-api.ndnworks.com`


## 2. Server Architecture (LXC Container)
We prioritize **Ubuntu 22.04/24.04 LXC (Linux Container)** on Proxmox to optimize hardware resources (RAM/CPU) compared to traditional VMs.
- **Initial Resource Allocation:** 2 Cores, 4GB RAM, 20GB Storage (Scalable on demand).
- **Runtime Environment:** Docker Engine & Docker Compose. The Frontend, Backend, and Database will be containerized.

## 3. Network & Security Architecture
- **Reverse Proxy:** Use Nginx Proxy Manager (NPM) or Traefik (via Docker) to route traffic from the domain to the correct internal container ports.
- **SSL/HTTPS:** Automatic certificate provisioning via Let's Encrypt inside the Reverse Proxy.
- **DNS & Cloudflare:** DNS records of `ndnworks.com` managed by Cloudflare. Enable Proxy mode (Orange Cloud) for DDoS protection, IP masking, and edge HTTPS caching.