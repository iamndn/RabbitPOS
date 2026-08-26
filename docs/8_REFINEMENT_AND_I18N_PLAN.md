# RabbitPOS — Refinement, i18n & Performance Implementation Report

> Scope: Internationalization (i18n) · Image Management · Caching & Performance · Operational Features  
> Environments: Production `rabbitpos.ndnworks.com` / LAN `10.0.0.10`

---

## 1. Internationalization (i18n) Architecture

### 1.1 Implementation Architecture
- **Language Provider (`LanguageContext`):** Implemented in `frontend/src/lib/i18n/` with persistent `localStorage` locale preference (`rabbitpos_lang`).
- **Translation Dictionaries:** Fully synchronized JSON files:
  - `frontend/src/lib/i18n/locales/vi.json` (Vietnamese - Default)
  - `frontend/src/lib/i18n/locales/en.json` (English)
- **Runtime Locale Switcher:** Integrated into the User Profile Dropdown in `AppShell.tsx` for seamless 1-click language toggling across all screens without page reload.
- **Coverage:** 100% of UI elements localized across POS, Menu, Purchases, Ledger, Funds, BI Analytics, Settings, and Receipts.

---

## 2. Image Management & Asset Optimization

### 2.1 Backend Upload & Static Serving
- **Endpoint:** `POST /api/v1/upload` (Protected with JWT Auth).
- **Validation:** 5MB file size limit with MIME-type verification (JPEG, PNG, WebP, GIF).
- **Storage:** Persisted in Docker named volume `backend_uploads` mounted at `/app/uploads` and statically served at `/uploads/*` and `/logo.png`.

### 2.2 Frontend Asset Rendering
- Image lazy loading and asynchronous decoding enabled across `ProductGrid`, `ProductCard`, and Category Tabs.
- Graceful fallback to category icon placeholders when images are not assigned.

---

## 3. Caching & Performance Architecture

### 3.1 Backend In-Memory TTL Cache
- Thread-safe generic `TTLCache` (`backend/internal/cache/ttl_cache.go`) deployed on read-heavy entities:
  - Categories: 5-minute TTL
  - Products & Variants: 3-minute TTL
  - Funds & Balances: 1-minute TTL
  - Settings: 10-minute TTL
  - Toppings: 5-minute TTL
- Immediate cache eviction triggered on write/mutation handlers.

### 3.2 Client-Side SWR Memory Cache
- `frontend/src/lib/cache.ts`: Client memory cache preventing redundant network requests when switching between tabs.
- Active cache invalidation upon create/update/delete operations.
- Debounced search inputs (250ms) across POS drink search and order history.

### 3.3 Database Optimization & Connection Pooling
- PostgreSQL connection pool tuned: `MaxOpenConns=30`, `MaxIdleConns=15`, `MaxLifetime=10m`, `MaxIdleTime=3m`.
- Composite indexes applied on `orders`, `order_items`, `transactions`, `products`, and `toppings`.
- Push-down aggregation SQL (`GROUP BY`) for periodic fund audits replacing N+1 sequential queries.

---

## 4. Operational & Reporting Features

### 4.1 Thermal Receipt Printing
- `ReceiptModal.tsx` formatted for 58mm and 80mm ESC/POS thermal printers.
- Includes store branding, order code, date/time, cashier name, item details, sugar/ice customizations, toppings breakdown, order notes, fee/discount summary, and total amount.

### 4.2 Excel & CSV Data Export
- Modular client-side export utilities in `lib/exportExcel.ts` and `lib/exportCsv.ts`.
- Full export support for Financial Cash Ledger, Order History, and Top-Selling Product Rankings.

### 4.3 Email Report Dispatcher
- Goroutine cron job dispatching daily financial summary emails at 23:00.
- On-demand dispatch button in Dashboard and cashier shift settlement email in Funds screen.