# RabbitPOS — Phase 6 Architecture Update
**i18n · Image Management · Auth/CORS Hardening · Operational Enhancements**
Domains: `rabbitpos.ndnworks.com` (Frontend) / `api.rabbitpos.ndnworks.com` (Backend) / LAN `10.0.0.10`

---

## 1. Schema & Database Additions

### 1.1 Catalog Domain — Image Metadata
**Categories** (add fields)
- image_url (nullable), thumbnail_url (nullable), image_alt_text (nullable)

**Products** (modify existing field usage)
- image_url (existing, now standardized as "original/full" asset path)
- thumbnail_url (new — optimized WebP variant for grid display)
- image_alt_text (new, i18n-friendly plain string)

**Media_Assets** (new table — central registry, decouples storage backend from entity tables)
- id (PK), owner_type (enum: "product", "category"), owner_id, storage_provider (enum: "local", "s3", "minio"), original_path, thumbnail_path, mime_type, file_size_bytes, width, height, uploaded_by, created_at

### 1.2 Internationalization
**Translations** (new table — only if DB-driven dynamic content needed beyond static UI dictionaries; product names/descriptions are candidate use case)
- id (PK), entity_type (enum: "product", "category"), entity_id, locale (enum: "vi", "en"), field_name (e.g. "name", "description"), translated_value

*Note:* Static UI strings (buttons, labels, nav) stay in Next.js JSON dictionaries — no DB table needed for those. `Translations` table is only for admin-editable business content (product/category names) if Vietnamese/English catalog copy must differ.

### 1.3 Auth Hardening
**Users** (add fields)
- refresh_token_hash (nullable), refresh_token_expires_at (nullable), last_login_at (nullable)

### 1.4 Operational Enhancements
**Print_Jobs** (new table — receipt/kitchen ticket audit trail)
- id (PK), order_id (FK -> Orders), ticket_type (enum: "receipt", "kitchen"), status (enum: "queued", "printed", "failed"), printed_at, created_at

**Backup_Logs** (new table)
- id (PK), backup_file, size_bytes, status (enum: "success", "failed"), started_at, completed_at, retention_expires_at

---

## 2. New & Updated API Endpoints

Base path: `/api/v1` — envelope unchanged: `{ "status", "data", "message" }`

### 2.1 Image Upload & Media
- `POST /media/upload` — Upload image (multipart), server generates thumbnail + WebP variant, returns Media_Assets record.
- `DELETE /media/:id` — Remove media asset and associated storage files.
- `GET /media/:id` — Fetch media metadata (for admin preview).
- `PUT /products/:id/image` — Attach/replace a product's image_url + thumbnail_url (references media asset).
- `PUT /categories/:id/image` — Attach/replace a category's image_url + thumbnail_url.

### 2.2 Internationalization
- `GET /i18n/dictionary/:locale` — (Optional) Serve server-managed translation dictionary if not fully static in frontend build.
- `GET /products?locale=vi|en` — Extend existing product list to resolve localized name/description via Translations table (fallback to base field if no translation exists).
- `PUT /products/:id/translations` — Upsert localized name/description for a product.
- `PUT /categories/:id/translations` — Upsert localized name for a category.

### 2.3 Auth Hardening
- `POST /auth/refresh` — Exchange valid refresh token for a new access token (rotates refresh token).
- `POST /auth/login` — (updated) Sets both access token (short-lived, ~1h) and refresh token (HTTP-only cookie, long-lived).
- `GET /auth/me` — (unchanged) Returns 401 on expired token, triggering frontend auto-redirect/refresh flow.

### 2.4 Operational Enhancements
- `POST /orders/:id/print-receipt` — Generate/queue a customer receipt ticket (returns print-ready payload or PDF).
- `POST /orders/:id/print-kitchen-ticket` — Generate/queue a kitchen prep ticket.
- `GET /reports/transactions/export` — Export financial transactions as CSV/XLSX (filter by date range, fund).
- `GET /reports/sales/export` — Export sales ledger as CSV/XLSX.
- `GET /reports/cogs/export` — Export inventory/COGS breakdown as CSV/XLSX.
- `GET /system/health-detailed` — Extended health check (DB latency, disk space, last backup status) for alerting.
- `GET /system/backups` — List recent backup job records and statuses.

---

## 3. Frontend Component & State Architecture

### 3.1 Internationalization
- `I18nProvider` (root-level, wraps `RootLayout`) — supplies locale context; recommend `next-intl` for combined SSR/CSR support and route-based locale segments (`/vi/pos`, `/en/pos`) or cookie-based locale without route prefix (simpler for POS single-tenant use case — **recommend cookie-based, no URL prefix**, to avoid disrupting existing route structure).
- `LocaleToggle` component — added to `AppShell` header (flag/text switcher, e.g. "VI | EN"), persists choice to cookie + triggers re-render of server components.
- `useTranslations()` hook (via next-intl) — consumed in all screen-level components (PosLayout, ProductManagementLayout, Dashboard, etc.) replacing hardcoded English strings.
- Dictionary structure: `/locales/vi/common.json`, `/locales/vi/pos.json`, `/locales/en/common.json`, `/locales/en/pos.json` — namespaced by feature area to keep bundles small.
- Default locale: Vietnamese (`vi`), fallback: English (`en`).

### 3.2 Image Upload & Optimization
- `ImageUploadDialog` (shared component, used in `ProductFormDialog` and new `CategoryFormDialog`)
  - `DropzonePreview` — drag/drop or tap-to-select, live preview
  - Client-side pre-processing: resize to max dimension + convert to WebP **before** upload (reduces bandwidth on mobile admin use)
  - Progress indicator + error state (file too large, invalid type)
- `MediaThumbnail` — reusable image component with lazy-loading, fallback placeholder icon (reuses existing `Coffee` icon pattern already in ProductGrid/ProductCard for missing images)
- Backend static serving: local Docker volume mounted at `/media`, served via reverse proxy path (e.g., `rabbitpos.ndnworks.com/media/*`) with long-lived `Cache-Control` headers; MinIO/S3 remains a drop-in future replacement via `storage_provider` field — no frontend change needed if API returns a resolvable URL regardless of backend.

### 3.3 Auth Persistence & API Base URL Resolution
- `ApiClientProvider` (update) — dynamic base URL resolution priority:
  1. `NEXT_PUBLIC_API_URL` if explicitly set at build time (production default: `https://api.rabbitpos.ndnworks.com/api/v1`)
  2. Runtime fallback: derive from `window.location.hostname` — if hostname is a LAN IP (e.g. `10.0.0.10`), construct `http://{hostname}:8080/api/v1`; otherwise use the configured production URL.
  - This removes the need to rebuild the frontend image every time the access origin changes between LAN IP and domain.
- `AuthGuard` (update) — on `401` response from any API call, clear local session and redirect to `/login`; attempt silent `POST /auth/refresh` once before redirecting, to avoid disrupting active POS sessions on token expiry mid-shift.
- Token storage: continue HTTP-only cookie for refresh token (not accessible to JS, XSS-safe); short-lived access token can remain in memory/localStorage as currently implemented.

### 3.4 Operational Enhancements
- `ReceiptPrintModal` — renders print-optimized layout (CSS `@media print`), triggered post-checkout; supports both browser print-to-PDF and ESC/POS raw command generation (backend-assisted, since ESC/POS requires byte-level printer commands not feasible purely client-side).
- `KitchenTicketModal` — simplified variant (items + notes only, no pricing) for back-of-house printing.
- `CartPersistenceProvider` — wraps POS cart state; on every cart mutation, mirrors state to `localStorage` (PWA-lite resiliency); on `PosLayout` mount, checks for and offers to restore an interrupted cart session.
- `ReportExportButton` (shared) — used in `TransactionLedger`, `DashboardPage`; triggers CSV/XLSX download via the new `/reports/*/export` endpoints.
- `SystemHealthBanner` (admin-only, in `AppShell` or `DashboardLayout`) — surfaces backup/health alert status from `/system/health-detailed`.

---

## 4. Phase 6 Execution Roadmap — Refinement, Polish & Launch Checklist

### 4.1 Sub-Phase 6A: Auth & CORS Hardening (Foundation — do first, unblocks reliable testing of everything else)
- Implement dynamic API base URL resolution in `ApiClientProvider`.
- Implement refresh token flow (`Users` schema update, `/auth/refresh` endpoint, `AuthGuard` silent-refresh logic).
- Expand `CORS_ALLOWED_ORIGINS` handling to support both LAN IP and production domain without manual `.env` edits per environment (e.g., document a standard multi-origin `.env` template).
- **Exit criteria:** Login/session persists correctly across LAN IP and domain access; no CORS errors in either environment; expired tokens trigger silent refresh, not abrupt logout.

### 4.2 Sub-Phase 6B: Internationalization
- Integrate `next-intl`, set up `I18nProvider`, cookie-based locale persistence, dictionary files for `vi`/`en`.
- Add `LocaleToggle` to `AppShell`.
- Migrate all screen components' hardcoded strings to translation keys.
- (If needed) Implement `Translations` table + endpoints for product/category localized content.
- **Exit criteria:** Full UI (POS, Catalog, Funds, Transactions, Dashboard) renders correctly in both Vietnamese (default) and English with no missing-key fallbacks.

### 4.3 Sub-Phase 6C: Image Upload & Optimization
- Add `Media_Assets` table, `/media/*` endpoints, local volume static serving with cache headers.
- Build `ImageUploadDialog`, client-side resize/WebP pipeline, integrate into `ProductFormDialog` + new `CategoryFormDialog`.
- **Exit criteria:** Admin can upload/replace product and category images from mobile or desktop; images render optimized (WebP, correctly sized) in POS grid without layout shift.

### 4.4 Sub-Phase 6D: Operational Enhancements
- Implement receipt/kitchen ticket generation (`Print_Jobs` table, print endpoints, `ReceiptPrintModal`/`KitchenTicketModal`).
- Implement cart `localStorage` persistence (`CartPersistenceProvider`).
- Implement CSV/XLSX export endpoints and `ReportExportButton`.
- Implement `Backup_Logs` table, cron-driven backup job (extends existing `scripts/backup_db.sh`), and `/system/health-detailed` + `/system/backups` endpoints with `SystemHealthBanner`.
- **Exit criteria:** Staff can print a receipt after checkout; an accidental page refresh mid-order does not lose cart contents; admin can export any ledger/report to CSV/XLSX; backup job runs on schedule and failures surface as a visible alert.

### 4.5 Sub-Phase 6E: Final Polish & Launch Checklist
- Cross-device QA: verify on actual LAN IP and production domain, on mobile POS devices and desktop admin.
- Verify all Phase 6 features respect existing RBAC (staff vs. admin route/API restrictions).
- Regression test Phases 1–5 features (catalog, orders, funds, ledger, analytics) still function after auth/CORS and i18n refactors.
- Confirm `.env.example` and deployment docs (`docs/7_PROXMOX_DEPLOYMENT_GUIDE.md`) updated with new required env vars (media storage path, refresh token secret, etc.).
- **Exit criteria:** RabbitPOS is bilingual, image-complete, resilient to token expiry and network hiccups, printable, exportable, and backed up — ready for full production handoff to Tho Juice & Coffee staff.