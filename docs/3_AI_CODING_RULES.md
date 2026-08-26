# AI Coding Standards & Project Rules

**CRITICAL RULE:** English is the ONLY allowed language for this project codebase. All code, comments, commit messages, and variable names MUST be written in English.

---

## 1. Tech Stack Overview
- **Backend:** Go 1.22+ with Gin web framework. High-performance, memory-efficient, clean layered architecture.
- **Database & ORM:** PostgreSQL 16 with GORM. Versioned migrations via raw SQL in `backend/migrations/`.
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide React icons.
- **Caching:** Thread-safe In-Memory TTL Cache on backend (`internal/cache`), Client-side memory cache with mutation invalidation (`lib/cache.ts`).
- **Deployment:** Docker Compose, Proxmox VE (Ubuntu 24.04 LXC), Cloudflare Zero Trust Tunnel.

---

## 2. Backend Standards (Go)
- **Layered Architecture:**
  - `cmd/server/main.go`: Server entrypoint, configuration loading, service instantiation, background goroutines.
  - `internal/config/`: Viper/environment variable loader.
  - `internal/database/`: PostgreSQL connection, connection pool setup (`MaxOpenConns`, `MaxIdleConns`), auto-migration, and seed execution.
  - `internal/models/`: GORM entities, Request/Response DTOs, Enums.
  - `internal/services/`: Isolated business domain services (Email, Google Sheets Sync, Auto-Tagging, Importer).
  - `internal/handlers/`: HTTP request validation, DTO transformation, controller logic.
  - `internal/routes/`: Route grouping, middleware registration, RBAC policy enforcement.
  - `internal/cache/`: In-memory thread-safe TTL cache.
- **Standard Response Envelope:**
  ```json
  {
    "status": "success|error",
    "data": { ... },
    "message": "Human readable status or error description"
  }
  ```
- **Database Transactions:** Every multi-step mutation (order creation, fund reconciliation, manual transaction edit/delete) must run inside `db.Transaction(func(tx *gorm.DB) error { ... })` to preserve ACID guarantees.
- **Error Handling:** Explicit error handling without panic. Sanitized user-facing error messages; internal technical errors logged to stderr.

---

## 3. Frontend Standards (Next.js & TypeScript)
- **Mobile-First Design:** POS item grid, product modals, cart drawer, and checkout components must be flawlessly usable on touchscreens and mobile portrait viewports.
- **Strict TypeScript:** No `any` types where avoidable. Define explicit DTO interfaces in `types/` or `lib/`.
- **State Management & Caching:**
  - SWR-like in-memory cache for static/low-mutation entities (`categories`, `funds`, `settings`, `toppings`).
  - Active cache invalidation upon create/update/delete mutations.
  - Debounce search inputs (250ms) to prevent unnecessary re-renders and network traffic.
- **Internationalization (i18n):**
  - All user-facing strings must use translation keys from `vi.json` and `en.json` via `LanguageContext` (`useLanguage`).
- **Component Separation:** Keep components focused and modular under `components/pos/`, `components/products/`, `components/transactions/`, `components/dashboard/`, `components/common/`.

---

## 4. AI Development Workflow
When instructed to build a new feature:
1. **Schema First:** Check if DB schema changes are required. If so, create paired SQL migration files (`NNNNNN_name.up.sql` and `NNNNNN_name.down.sql`).
2. **Backend Domain & Services:** Define structs in `internal/models/`, implement service/handler logic, and register routes in `internal/routes/`.
3. **Frontend Implementation:** Define TypeScript types, add i18n keys to both `vi.json` and `en.json`, create/update UI components, and integrate API.
4. **Documentation:** Update relevant `.md` files in `docs/` and `README.md`.