# 🐰 RabbitPOS - Mobile-First Point of Sale & Management System

> Modern, lightweight, high-performance Point of Sale (POS) and Financial Management System tailored for **Tho Juice & Coffee**. Built with Go (Clean Architecture), PostgreSQL, Next.js 14, Tailwind CSS, and optimized for LXC Container deployment on Proxmox VE 8.x/9.x.

---

## 🌟 Key Features

### 📱 1. Mobile-First POS Order Entry
- **Touch-Friendly Product Grid:** Filter by categories (Coffee, Fruit Juices, Tea & Milk Tea) and real-time drink search.
- **Variant Selector Modal:** Customize size (Size M/L), sugar & ice levels (0%, 30%, 50%, 70%, 100%), and extra toppings (Boba, Cream Cheese).
- **Slide-Over Cart Sheet:** Item quantity steppers, item modifiers, discount input, subtotal, and total calculation.
- **Napas 247 VietQR Integration:** Dynamic VietQR generation (`img.vietqr.io`) for direct MBBank QR payment scanning.

### 📦 2. Catalog & Menu Management
- Manage Categories, Products, and Product Variants with distinct cost of goods (`cogs_price`) and retail prices (`retail_price`).
- Real-time gross profit margin calculator per drink variant.

### 💰 3. Financial Ledger & Cash Flow (Sổ Thu Chi)
- **Automated Sales Inflows:** Every completed POS order automatically logs an `inflow` transaction linked to the selected payment fund and order code.
- **Manual Outflow Expense Logging:** Log ingredient purchases (milk, ice, coffee beans) or utility bills (electricity, water, internet).
- **KPI Overview:** Real-time tracking of Total Inflows, Total Outflows, and Net Cash Flow.

### 🏦 4. Funds Overview & Reconciliation (Kiểm Kê Quỹ)
- Multi-fund repository tracking (e.g., **Cash Drawer** and **MBBank Account**).
- **Reconciliation Audit Dialog:** Input physical cash/bank count, calculate surplus/deficit variance, and log reconciliation variance records.

### 📊 5. Executive Analytics & Reporting
- Filter by date shortcuts (*Today*, *Yesterday*, *This Week*, *This Month*, or *Custom Date Range*).
- **Business KPIs:** Total Revenue, Gross Profit, Net Profit, Order Count, Average Order Value (AOV), and Total Expenses.
- **Top-Selling Drinks Widget:** Ranks best-performing drink variants by sales volume, revenue, and profit margin %.
- **Daily Cash Flow Widget:** Date-by-date breakdown of inflows vs. outflows.

### 🔐 6. Auth, RBAC & Security
- **Role-Based Access Control (RBAC):**
  - **Staff Role:** Access restricted strictly to POS Order Entry (`/`).
  - **Admin Role:** Full administrative access to POS, Catalog, Financial Ledger, Funds Reconciliation, and Analytics.
- **Security:** Passwords hashed with `bcrypt`, sessions secured with signed `JWT` tokens (Bearer Header / HTTP-only Cookies).

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend API** | Go 1.22+, Gin Web Framework, GORM, `golang-jwt/jwt/v5`, `bcrypt` |
| **Database** | PostgreSQL 16 (Auto-migrations & raw SQL seeds) |
| **Frontend UI** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons |
| **Reverse Proxy** | Nginx Proxy Manager (NPM), Cloudflare DNS / SSL |
| **Deployment** | Docker, Docker Compose, Proxmox VE 8.x/9.x (Ubuntu 24.04 LXC Container) |

---

## 🔑 Default User Accounts

After starting the system, the database is auto-seeded with the following accounts:

| Role | Username | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Full access (POS, Catalog, Ledger, Funds, Analytics) |
| **Staff / Cashier** | `staff` | `staff123` | Restricted access (POS Order Entry only) |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Go 1.22+](https://golang.org/) (optional for local Go build)
- [Node.js 18+ & npm](https://nodejs.org/) (optional for local Next.js build)

### Step 1: Clone the Repository
```bash
git clone https://github.com/RabbitPOS/RabbitPOS.git
cd RabbitPOS
```

### Step 2: Start PostgreSQL with Docker Compose
```bash
docker-compose up -d postgres
```

### Step 3: Run Backend (Go)
```bash
cd backend
go run cmd/server/main.go
```
*The backend API server will start at `http://localhost:8080`.*

### Step 4: Run Frontend (Next.js)
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
*The frontend application will start at `http://localhost:3000`.*

---

## 🐳 Running Full Stack via Docker Compose

To launch PostgreSQL, Go Backend, and Next.js Frontend together in Docker:

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Build and start containers
docker-compose up -d --build
```

Access points:
- **Frontend POS App:** `http://localhost:3000`
- **Backend API:** `http://localhost:8080/api/v1`

---

## 🌐 Production Deployment on Proxmox VE (LXC Container)

RabbitPOS includes a fully automated 1-command provisioning script for **Proxmox VE 8.x / 9.x**.

### Step 1: Provision LXC Container on Proxmox Node
Run the provisioning script on your Proxmox VE host shell:

```bash
bash scripts/setup-proxmox-lxc.sh
```

**Script Actions:**
1. Downloads Ubuntu 24.04 LTS container template.
2. Creates unprivileged LXC container (CT ID `200`) with Docker nesting (`keyctl=1,nesting=1`).
3. Provisions 2 vCPUs, 2048MB RAM, 20GB Storage.
4. Auto-installs Docker Engine, Docker Compose plugin, Git, UFW firewall.
5. Clones repository and launches `docker-compose.prod.yml` (PostgreSQL, Go Backend, Next.js, Nginx Proxy Manager).

- Access **NPM Admin Console:** `http://<LXC_IP>:81` (Default: `admin@example.com` / `changeme`).
- Proxy Host 1 (Unified): `rabbitpos.ndnworks.com` -> `http://127.0.0.1:3000` (Next.js Frontend & API Proxy).
- Proxy Host 2 (Optional API): `rabbitpos-api.ndnworks.com` -> `http://127.0.0.1:8080` (Go Backend).


---

## 💾 Automated Database Backups

The project includes an automated database backup script `scripts/backup_db.sh` using `pg_dump` with timestamped gzip output and 7-day retention policy.

### Setup Daily Cronjob on LXC Container:
```bash
# Edit crontab inside LXC container
crontab -e

# Add daily backup entry at 02:00 AM
0 2 * * * /opt/rabbitpos/scripts/backup_db.sh >> /var/log/db_backup.log 2>&1
```

---

## 📁 Repository Structure

```
RabbitPOS/
├── backend/                    # Go Clean Architecture Backend
│   ├── cmd/server/main.go      # Application entrypoint
│   ├── internal/
│   │   ├── config/             # Environment & configuration loader
│   │   ├── database/           # GORM PostgreSQL init & auto-migrations
│   │   ├── handlers/           # REST HTTP route handlers
│   │   ├── middleware/         # JWT authentication & RBAC middleware
│   │   ├── models/             # GORM domain models & DTOs
│   │   ├── routes/             # Gin engine & route definitions
│   │   └── utils/              # Bcrypt & JWT signing utilities
│   ├── migrations/             # SQL schema migrations (000001 - 000004)
│   └── seeds/                  # SQL seed data (Catalog, Funds, Users)
├── frontend/                   # Next.js 14 Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # POS Order Entry screen
│   │   │   ├── login/          # Auth Login screen
│   │   │   ├── products/       # Menu Catalog Management
│   │   │   ├── transactions/   # Financial Ledger (Sổ Thu Chi)
│   │   │   ├── funds/          # Funds Overview & Reconciliation
│   │   │   └── dashboard/      # Executive Analytics & Reporting
│   │   ├── components/         # Reusable UI components & AppShell
│   │   └── lib/                # API fetcher & Auth state manager
├── scripts/
│   ├── setup-proxmox-lxc.sh    # Proxmox LXC automated setup script
│   └── backup_db.sh            # Daily PostgreSQL backup script
├── docs/                       # Architecture & API documentation
├── docker-compose.yml          # Local development stack
└── docker-compose.prod.yml     # Production stack (includes NPM)
```

---

## 📄 License

Developed for **Tho Juice & Coffee** under the MIT License.
