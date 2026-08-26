# 🐰 RabbitPOS - Mobile-First Point of Sale & Management System

> Modern, lightweight, high-performance Point of Sale (POS) and Financial Management System tailored for **Tho Juice & Coffee**. Built with Go 1.22+ (Clean Architecture), PostgreSQL 16, Next.js 14 (App Router), TypeScript, Tailwind CSS, and optimized for LXC Container deployment on Proxmox VE 8.x/9.x.

---

## 🌟 Key Features

### 📱 1. Mobile-First POS Order Entry
- **Touch-Friendly Product Grid:** Filter by categories (Coffee, Fruit Juices, Tea & Milk Tea) with debounced real-time search.
- **Variant Selector Modal:** Customize size (Size M/L), 5 standardized sugar & ice levels (0%, 30%, 50%, 70%, 100%), and dynamic toppings with snapshot preservation.
- **Slide-Over Cart Drawer:**
  - Item quantity steppers and inline unit price overrides for flexible cashier pricing.
  - Active promotion selector (fixed amount, percentage discount, gift items) with auto-validation.
  - Fee and discount controls: Manual discount, Partner platform discount, Shipping fee, and Holiday/Night Surcharge.
  - Order notes input with persistent `localStorage` synchronization and full state reset on completion.
- **Napas 247 Dynamic VietQR:** Dynamic QR generation (`img.vietqr.io`) linked to MBBank account for contactless scanning.
- **Thermal Receipt Printing:** Standardized thermal receipt modal with full line-item breakdown, toppings, sugar/ice notes, and discounts.

### 📦 2. Catalog, Toppings & Menu Management
- **Hierarchical Catalog:** Categories, Products, and Product Variants with distinct cost of goods (`cogs_price`) and retail prices (`retail_price`).
- **Dynamic Topping Management:** Add/edit toppings, toggle availability 1-click, configure category or global scope, and reorder items.
- **Category & Promotion Reordering:** Customize display order across categories, toppings, promotions, and transaction categories.
- **Automated Product Tagging Engine:** Configure rules to auto-tag products (`best_seller`, `new`, `signature`) based on sales velocity and revenue with rule preview, manual lock/unlock, and 1-click apply.

### 🥗 3. Inventory Purchases, Ingredients & Recipe BOM Management
- **Raw Ingredient Master Data:** Track raw fruits, dairy, syrups, packaging, and supplies with yield rates (e.g., orange/carrot juice extraction yield) and unit tracking.
- **Purchase Invoices & Expense Linking:** Log ingredient purchases directly linked to financial cash outflows, updating latest and weighted-average purchase prices.
- **Bill of Materials (BOM) Recipes:** Define ingredient quantities per product variant and topping.
- **COGS Comparison & 1-Click Menu Price Sync:** Real-time calculation of theoretical recipe cost vs. current menu COGS with single or bulk 1-click update to menu pricing.

### 💰 4. Financial Ledger & Cash Flow (Sổ Thu Chi)
- **Automated Sales Inflows:** Every completed POS order automatically creates an `inflow` transaction linked to the designated fund and order code.
- **Dynamic Transaction Categories:** Create custom income/expense categories with system category protection (`is_system`).
- **Manual Inflow/Outflow Management:** Record operational expenses (utilities, supplies, rent) with atomic fund balance updates.
- **Order History & 1-Click Re-Order:** Filter order history, view detailed receipts, cancel orders with optional automated fund refunds, and re-populate the POS cart with 1 click.
- **Data Export:** Export financial ledger, order history, and product rankings to Excel (`.xlsx`) or CSV format.

### 🏦 5. Funds Overview & Reconciliation (Kiểm Kê Quỹ)
- **Multi-Fund Repositories:** Separate tracking for Cash Drawer (Tiền mặt) and MBBank/VietQR accounts.
- **Reconciliation Audit Dialog:** Input physical cash/bank count, calculate surplus/deficit variance, and log reconciliation variance records.
- **Periodic Balance Summary:** Audit opening balance, total inflows, total outflows, closing balance, net variance, and growth rates across time periods.
- **Cashier Shift Report:** Quick summary of cash collected during cashier shifts.

### 📊 6. Executive BI Analytics & Reporting
- **Dual-Tab Interface:**
  - **Revenue Analytics:** Gross sales, net revenue, discounts, shipping fees, surcharges, order volume, Average Order Value (AOV), and time-series trends.
  - **Profit & Loss (P&L):** Net revenue, Cost of Goods Sold (COGS), Gross Profit & Margin %, Operating Expenses, Net Profit & Margin %.
- **Hourly Sales Distribution:** Analyze peak shopping hours to optimize staffing and preparation.
- **Top-Selling Menu Performance:** Ranked table by volume, revenue, and gross profit margin with multi-column sorting, filtering, and export.
- **Modern Date Range Picker:** Quick presets (*Today*, *Yesterday*, *This Week*, *This Month*, *This Year*, or *Custom Range*).

### 🔄 7. Integrations & Automation
- **Google Sheets Bi-Modal Synchronization:** 2-way sync of orders, transactions, and inventory directly to Google Sheets using Google Cloud Service Account credentials.
- **Automated & On-Demand Email Reports:** Daily scheduled financial summaries (23:00) dispatched via SMTP with HTML email templates to administrator inboxes.
- **Web Backup & Restore:** 1-click database export and restore directly from the System Settings web UI.
- **Data Migration & Importer:** Migrate catalog and order history from Excel templates and external POS systems (e.g. Sổ Bán Hàng).

### 🔐 8. Authentication, RBAC & Security
- **Role-Based Access Control (RBAC):**
  - **Cashier / Staff Role:** Restricted strictly to POS Order Entry (`/`), shift summary, and profile settings.
  - **Admin Role:** Full administrative access to POS, Catalog, Purchases & Recipes, Ledger, Funds, Analytics, and System Settings.
- **First-Time Password Setup:** Mandatory password change flow on initial login for seeded staff accounts.
- **Security:** `bcrypt` password hashing, signed `JWT` authentication (Bearer token & HTTP-only cookies), and Gzip response compression.
- **Bilingual Interface (i18n):** Complete Vietnamese (`vi`) and English (`en`) localization with instant runtime switching.

---

## 🛠️ Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend API** | Go 1.22+ (Gin Web Framework) | Clean Architecture, RESTful API, In-memory TTL Cache, Gzip Middleware |
| **ORM & Database** | GORM, PostgreSQL 16 | Connection pooling, SQL migrations (`000001` - `000018`), Composite Indexes |
| **Frontend UI** | Next.js 14 (App Router), TypeScript | Tailwind CSS, Lucide Icons, SWR-like Client Cache, Custom i18n |
| **Integrations** | Google Sheets API v4, SMTP TLS | Background synchronization goroutines, Daily cron job dispatcher |
| **Reverse Proxy & Ingress** | Nginx Proxy Manager, Cloudflare Tunnel | Zero-Trust secure tunnels, SSL / TLS termination |
| **Infrastructure** | Docker, Docker Compose, Proxmox VE | Ubuntu 24.04 LTS LXC Container |

---

## 🔑 Default User Accounts

The database is initialized with the following accounts:

| Role | Username | Temporary Password | Required Actions | Access Rights |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | Can change in Settings | Full System Access |
| **Admin / Manager** | `NDN` | `ndn` | Mandatory password reset on 1st login | Full System Access |
| **Admin / Manager** | `NHUNG` | `nhung` | Mandatory password reset on 1st login | Full System Access |
| **Admin / Manager** | `DAT` | `dat` | Mandatory password reset on 1st login | Full System Access |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/)
- [Go 1.22+](https://golang.org/) (for local Go execution)
- [Node.js 18+ & npm](https://nodejs.org/) (for local Next.js execution)

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/RabbitPOS/RabbitPOS.git
cd RabbitPOS
cp .env.example .env
```

### 2. Start PostgreSQL Database
```bash
docker-compose up -d postgres
```

### 3. Start Backend Server (Go)
```bash
cd backend
go run cmd/server/main.go
```
*Backend API will run at `http://localhost:8080` (API base: `http://localhost:8080/api/v1`).*

### 4. Start Frontend Application (Next.js)
```bash
cd frontend
npm install
npm run dev
```
*Frontend application will run at `http://localhost:3000`.*

---

## 🐳 Full Stack via Docker Compose

To launch the complete production stack (PostgreSQL, Go Backend, Next.js Frontend, Nginx Proxy Manager, Cloudflare Tunnel):

```bash
# 1. Prepare production environment file
cp .env.example .env

# 2. Build and run containers
docker-compose -f docker-compose.prod.yml up -d --build
```

Access Points:
- **Frontend POS Web App:** `http://localhost:3000` (or `https://rabbitpos.ndnworks.com`)
- **Backend API:** `http://localhost:8080/api/v1` (or `https://rabbitpos-api.ndnworks.com/api/v1`)
- **Nginx Proxy Manager Admin:** `http://<HOST_IP>:81` (Default: `admin@example.com` / `changeme`)

---

## 🌐 Production Deployment on Proxmox VE (LXC Container)

RabbitPOS includes automated deployment and backup scripts located in `scripts/`.

### 1. Automated LXC Container Provisioning
Run on your Proxmox VE Node Shell:
```bash
bash scripts/setup-proxmox-lxc.sh
```

### 2. Automated Application Deployment
Inside the LXC container (`/opt/RabbitPOS`):
```bash
bash scripts/deploy.sh
```

### 3. Automated Database & Media Backup (Cron Job)
Configure daily automated backups at 03:00 AM (`crontab -e`):
```bash
0 3 * * * /opt/RabbitPOS/scripts/backup.sh >> /var/log/rabbitpos_backup.log 2>&1
```

To restore from a backup snapshot:
```bash
bash scripts/restore.sh
```

---

## 📁 Repository Structure

```
RabbitPOS/
├── backend/                        # Go Clean Architecture Backend
│   ├── cmd/server/main.go          # Application Entrypoint & Router Setup
│   ├── internal/
│   │   ├── cache/                  # In-Memory Thread-Safe TTL Cache
│   │   ├── config/                 # Environment & Configuration Loader
│   │   ├── database/               # PostgreSQL GORM Init, Pool & AutoMigrate
│   │   ├── handlers/               # REST API HTTP Route Handlers
│   │   ├── middleware/             # JWT Auth, RBAC, Gzip Compression, CORS
│   │   ├── models/                 # Domain Structs, DTOs & Request/Response Types
│   │   ├── routes/                 # Gin Engine Routes & Route Grouping
│   │   ├── services/               # Core Services (AutoTagging, Email, Importer, SheetsSync)
│   │   └── utils/                  # Bcrypt, JWT Tokens & Helper Utilities
│   ├── migrations/                 # SQL Schema Migrations (000001 - 000018)
│   ├── seeds/                      # SQL Seed Data (Catalog, Funds, Users, Categories)
│   └── uploads/                    # Uploaded Images & Store Logos
├── frontend/                       # Next.js 14 App Router Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            # POS Main Order Entry Screen
│   │   │   ├── login/              # Login & Password Setup Screen
│   │   │   ├── products/           # Catalog, Toppings & Auto-Tagging Management
│   │   │   ├── purchases/          # Ingredients, Purchase Invoices & Recipe BOM
│   │   │   ├── promotions/         # Promotions & Discount Engine Management
│   │   │   ├── transactions/       # Financial Ledger & Order History
│   │   │   ├── funds/              # Funds Overview, Shift Summary & Reconciliation
│   │   │   ├── dashboard/          # BI Executive Analytics (Revenue, P&L, Rankings)
│   │   │   └── settings/           # Store Settings, Email, Google Sheets, Backup/Restore
│   │   ├── components/             # Modular React UI Components
│   │   │   ├── AppShell.tsx        # Responsive Shell with User Profile Dropdown
│   │   │   ├── common/             # ModernDateRangePicker, Modals, Shared UI
│   │   │   ├── pos/                # VariantSelector, CartDrawer, Checkout, Receipt
│   │   │   ├── products/           # ProductForm, ToppingForm, AutoTagConfigModal
│   │   │   ├── transactions/       # TransactionCategoryModal, AddTransactionDialog
│   │   │   └── dashboard/          # Analytics Charts, AllProductsRankingModal
│   │   ├── lib/                    # API Client, Auth Guard, Cache, Excel/CSV Exporter
│   │   └── types/                  # Strict TypeScript Interfaces
├── scripts/                        # DevOps & Operational Scripts
│   ├── setup-proxmox-lxc.sh        # Automated Proxmox LXC Provisioning
│   ├── deploy.sh                   # Production Deployment & Service Reload
│   ├── backup.sh                   # Automated PostgreSQL & Media Backup
│   ├── restore.sh                  # Interactive Database Restore Script
│   └── migrate_from_sobanhang.py   # Historical Sổ Bán Hàng Excel Data Migration
├── docs/                           # Comprehensive Project Documentation
├── docker-compose.yml              # Local Development Docker Stack
└── docker-compose.prod.yml         # Production Stack (with NPM & Cloudflare)
```

---

## 📄 License

Developed for **Tho Juice & Coffee** under the MIT License.
