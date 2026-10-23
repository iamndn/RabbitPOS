# RabbitPOS Multi-Store (Multi-Tenant) Upgrade Plan

> **Status:** PROPOSED. Awaiting approval. No application code has been changed.
> **Schema baseline:** `v1.19` (migration `000019`). **Target:** `000020` (expand) and `000021` (contract).
> **Language rule:** all code, comments and commit messages stay in English (`docs/3_AI_CODING_RULES.md`).
> **Scope guard (`AGENTS.md`):** multi-store adds tenant isolation only. It adds **no inventory or stock module**.
> The `retail` business type is a label and a currency/menu preset, not a stock feature.

---

## 0. Executive Summary

| Topic | Decision |
|---|---|
| Tenancy model | Shared database, shared schema, `store_id` discriminator column on root tables. |
| Data preservation | Existing data becomes Store `#1` through an expand-then-contract migration. Old and new binaries both work during rollout. |
| Roles | `super_admin` (platform owner), `store_admin` (branch manager), `staff` (cashier). The per-store role is in `user_stores`. |
| Store resolution | `X-Store-ID` header (`?store_id=` for GET downloads and QR). Access is verified on every request. The store is **not** in the JWT. |
| Isolation enforcement | Four layers: middleware, `ScopeByStore` GORM scope, fail-closed create callback, tenant-isolation tests plus a static query guard. |
| Settings | Identity, currency and VietQR move to `stores`. Other per-store keys go to `store_settings(store_id,key)`. SMTP stays global in `settings`. |
| Frontend | `StoreContext` plus a store switcher. Pages remount on switch (`key={storeId}`). Cart, offline DB, caches and exports are namespaced by store. |
| Rollout | 4 phases, each independently deployable and reversible. |

**Critical discovery: SQL migrations are not executed in production today.**
`scripts/deploy.sh` says "GORM auto-migrates on boot".
`InitDB` only calls `AutoMigrate`; no runner applies `backend/migrations/*.sql`.
Those files document the schema but are not authoritative.
Adding `store_id NOT NULL` to populated tables through AutoMigrate alone would fail or be unsafe.
So Phase 1 introduces a small, tracked, transactional migration runner that executes **before** `AutoMigrate` (see §3.4).

---

## 1. As-Is Audit (what the codebase does today)

Findings come from reading `routes.go`, `config.go`, `postgres.go`, `middleware/auth.go`, `utils/auth_utils.go`,
`models/{user,setting,order,transaction,fund,transaction_category,audit_log,idempotency}.go`, `handlers/setting.go`,
`cmd/server/main.go`, `frontend/src/lib/{api,offline/db}.ts`, and targeted greps across `backend/` and `frontend/`.
Items marked **[verify]** must be confirmed in Phase 1 before coding.

### 1.1 Global (single-tenant) assumptions

| # | Finding | Evidence | Impact |
|---|---|---|---|
| A1 | No tenant column anywhere. All handlers use unscoped `h.db.Find/First/...`. | `handlers/*.go`, e.g. `order.go:37`, `setting.go:49` | Every query site needs scoping. |
| A2 | `settings` is a global key/value table, PK `key`. Upsert uses `OnConflict{Columns: key}`. | `models/setting.go`, `handlers/setting.go:148` | Must become `(store_id,key)` for per-store keys. |
| A3 | `orders.order_code` is globally UNIQUE. Format is `ORD-YYYYMMDD-HHMMSS-NNNN`. | `models/order.go:18`, `order.go:288` | Uniqueness becomes per store. Add a store prefix for new stores. |
| A4 | `ingredients.name` is globally UNIQUE (`ingredients_name_key`; GORM `uniqueIndex`). | `models/purchase.go:20`, migration `000018` | Becomes `UNIQUE(store_id,name)`. |
| A5 | Roles are global: `admin` and `staff`. All admin routes sit in one `adminOnly` group using `RequireRole(models.RoleAdmin)`. | `routes.go:117`, `models/user.go` | Replace with store-aware RBAC. |
| A6 | JWT carries `user_id`, `username`, `role`, `token_version` and no store. Role in context comes from the **token**, not the DB. | `auth_utils.go`, `middleware/auth.go:79` | Role must be re-derived from the DB per request. |
| A7 | `users.role` is a plain `VARCHAR(20)` (`'admin','staff'` in a comment, no CHECK). | migration `000004` | New role values can be introduced without a schema change. |
| A8 | There is **no user CRUD API**. Users are only seeded (`seedUsers`: NDN, NHUNG as `admin`). | `routes.go`, `postgres.go:152` | The "assign staff or managers" UI needs new user and membership APIs. |
| A9 | Seeds run on global emptiness checks (`seedFunds`, `seedSettings`, `seedTransactionCategories` use `Count()==0`). | `postgres.go:200-462` | Must become per-store seed functions called on store creation. |
| A10 | Backend TTL caches use global keys (`funds:list`, `settings:all`, `settings:store`) and `InvalidatePrefix("settings:")`. | `setting.go:19-20`, `order.go:649`, `auto_tagging.go:148` | Cross-store cache poisoning unless keys are prefixed `s{id}:`. |
| A11 | `IdempotencyRecord.Key` is a global primary key. The cached response replays regardless of caller. | `models/idempotency.go`, `order.go:228` | Needs `store_id` and a match check so a replay cannot cross stores. |
| A12 | `startDailyReportScheduler` is one global loop: one report time, one enabled flag, one sheets sync, one auto-tag run. | `cmd/server/main.go:51-115` | Must iterate active stores with per-store config and timezone. |
| A13 | Email and Sheets services read the global `settings` (`report_recipient_emails`, `enable_daily_email_report`, `daily_report_time`, `google_sheets_*`, `auto_tagging_config`). | `services/email.go:65-96`, `auto_tagging.go:88-148` | Per-store keys move to `store_settings`. SMTP stays global. |
| A14 | `backup.go` (export, preview, restore) operates on the whole database, and `importer.go` writes global catalogs. | `routes.go:217-223` | Backup becomes platform-wide and super_admin only. Import becomes store-scoped. |
| A15 | `/uploads` is one flat directory, plus a hard-wired `/logo.png` and `/favicon.ico`. | `routes.go:33-35` | Store logos need per-store paths. `/logo.png` becomes a platform fallback. |

### 1.2 Existing defects found while auditing (fix inside this effort)

| # | Defect | Evidence |
|---|---|---|
| D1 | Settings key mismatch: `seedSettings` writes `currency_code` and `currency_position`, but the POS whitelist `StoreSettingsKeys` exposes `currency` and omits `currency_position`. | `postgres.go:248-250` vs `models/setting.go:30` |
| D2 | VietQR fallback account name is hardcoded: `accountName := "THO JUICE AND COFFEE"`. | `order.go:863` |
| D3 | Production seed contains a real address, phone and bank account number as defaults. | `postgres.go:245-253` |
| D4 | Order handler error strings embed `Quỹ thanh toán ID %d`. Fund lookups use `tx.First(&fund, req.FundID)`, so a cross-store `fund_id` would be accepted without scoping. | `order.go:273` |

### 1.3 Frontend assumptions

| # | Finding | Evidence |
|---|---|---|
| F1 | `fetchApi` caches GETs in `clientCache` keyed by **endpoint only**. | `lib/api.ts:72,111` |
| F2 | JWT is read from `localStorage` in `fetchApi` and also in raw `fetch` calls that bypass it. | `api.ts:80,178`, `settings/page.tsx:229,296,333` |
| F3 | The POS cart is persisted under the single key `rabbitpos_active_cart`. It is written by `app/page.tsx` and by the re-order flow in `transactions/page.tsx:983`. | grep of `localStorage` |
| F4 | The offline PWA engine uses one IndexedDB, `RabbitPOS_Offline_DB` v1, with stores `catalog_products`, `categories`, `toppings`, `promotions`, `store_settings`, `cart_state`, `sync_metadata` and `offline_orders`. Records are keyed by global `id`. | `lib/offline/db.ts:6-18` |
| F5 | Queued offline orders already exist on user devices. They must sync into Store #1 after the upgrade. | `lib/offline/orders.ts`, `sync.ts` |
| F6 | `products/page.tsx` stores filters in `sessionStorage['rabbitpos_filter_products']`. | grep |
| F7 | `layout.tsx` metadata and `public/manifest.json` are static. SSR cannot know the active store. | `layout.tsx:21-58` |
| F8 | Old PWA clients may be served from the service-worker cache and will not send `X-Store-ID`. | PWA install banner, offline engine |

### 1.4 Verified findings (Phase 1 - resolved)
- **VariantGroup**: only `product_id` FK (child of Product, no store column needed). `product_variants.sku` is indexed, not unique.
- **`clientCache.invalidate(pattern)`**: substring (`includes`) match. Keys `${storeId}:${endpoint}` are safe; invalidating over-matches across stores (harmless, only extra refetches).
- **`LanguageContext.t(key, params)`**: already supports `{param}` interpolation. No change needed.
- **Docker**: build stage does `COPY . .` + `go build`; runtime image holds only the binary, so `//go:embed` (`backend/migrations/embed.go`) is required. `.dockerignore` does not exclude `migrations`.
- **`testutils`**: PostgreSQL via `TEST_DATABASE_URL` (falls back to localhost:5432, skips if unreachable). `AutoMigrateAll`/`CleanTables` now include store tables and re-create Store 1.
- **Constraint names (local DB)**: GORM-style, e.g. `idx_ingredients_name`, `idx_orders_order_code` (unique), `fk_orders_fund`, `fk_products_category`. Production (Supabase) names were NOT inspected; the migration was only validated against a GORM-built legacy schema. Verify with `\d orders` / `\d ingredients` on a prod copy before release.
- **Deviation**: all ids are `BIGINT` (not INTEGER as drafted in section 3).
- **Deviation**: composite performance indexes live in Go (`ensureStoreIndexes`), not in the SQL file.

### 1.5 Locked decisions (user-approved)
1. NDN and NHUNG become `super_admin`; legacy `users.role='admin'` is treated as `super_admin` in code (D-4) until migration 000021.
2. New-store funds: "Tiền mặt" (`cash`) and "Chuyển khoản" (`bank`).
3. Ingredients/recipes per store; cloning resets purchase prices to 0.
4. SMTP global in `settings`; recipient emails, daily-report flag/time per store in `store_settings`.
5. Store 1 keeps `ORD-YYYYMMDD-HHMMSS-NNNN`; new stores use `ORD-<CODE>-...`; unique `(store_id, order_code)` (Phase 2).
6. Platform brand `RabbitPOS`. 7. One Google Sheet per store. 8. Deactivate only (`ON DELETE RESTRICT`). 9. `stores.timezone` default `Asia/Ho_Chi_Minh`.
10. Post-login: last-active store from `localStorage['rabbitpos_active_store_id']`, else `default_store_id`, else first store; no blocking picker (Phase 3).

### 1.6 Phase 1 implementation notes
- Flags: `ENABLE_MULTI_STORE` (default false) gates `POST /stores` because legacy endpoints are still unscoped until Phase 2; `STORE_STRICT_CREATE` enables the fail-closed create callback; `INITIAL_STORE_NAME` / `INITIAL_STORE_CODE` seed Store 1 on fresh DBs.
- `store_id` model tags keep `default:1` transitionally (so unmodified handlers write to Store 1); migration 000021 drops it.
- Members removal path: `DELETE /api/v1/stores/:id/members/:user_id`.
- New error codes: `STORE_NOT_FOUND`, `STORE_CODE_TAKEN`, `STORE_CODE_INVALID`, `STORE_LAST_ACTIVE`, `STORE_ROLE_INSUFFICIENT`, `MULTI_STORE_DISABLED`, `USER_EXISTS`, `USER_NOT_FOUND`, `MEMBER_NOT_FOUND`.
- Test safety: `database/postgres_test.go` and `services/importer_test.go` call `InitDB(LoadConfig())` and would hit the DB in `.env` (Supabase). Always filter with `-run` and set `TEST_DATABASE_URL` to a throwaway database.

---

## 2. Design Decisions

| ID | Decision | Rationale | Alternative rejected |
|---|---|---|---|
| D-1 | Shared schema with `store_id` on root aggregates. Child tables are scoped through their parent. | One DB to back up and operate (single LXC). Cheapest migration. | Schema per tenant, DB per tenant: heavy for a few stores. |
| D-2 | `stores` columns are the source of truth for identity, currency and VietQR. Other per-store keys live in `store_settings`. SMTP credentials stay global in `settings`. | Typed, queryable core fields. The key/value table stays flexible for the rest. | Everything in `store_settings`: loses constraints and typing. |
| D-3 | **Expand, then contract.** `000020` is additive. `000021` removes defaults and legacy values after the old binary is gone. | Old and new binaries coexist during rollout. Rollback is safe. | One breaking migration. |
| D-4 | Legacy `users.role='admin'` is kept and treated as `super_admin` in code. The new `super_admin` value is used for new owners. `000021` normalizes. | An old binary (or a rollback) still recognizes admins. Renaming now would lock them out. | Rewriting `admin` to `super_admin` in `000020`. |
| D-5 | Store is **not** a JWT claim. It is verified per request against `user_stores` (60s cached). | Switching store needs no re-login. Membership changes take effect fast. Tokens stay valid. | Store-bound JWT. |
| D-6 | `store_id` keeps `DEFAULT 1` only during the transition. `000021` drops it. | Old binary inserts keep working. A permanent default would silently misfile rows. | Permanent `DEFAULT 1`. |
| D-7 | Backend caches are keyed `s{storeID}:...`. The frontend `clientCache` key is `{storeID}:{endpoint}`. | Prevents cache poisoning across stores. | Clear all caches on every request. |
| D-8 | Switching store remounts the page tree (`<div key={storeId}>`). | Guarantees no stale state across large pages (`app/page.tsx` is ~67 KB). | Manually re-fetching in every effect. |
| D-9 | Stores are **deactivated, never hard-deleted**. FKs use `ON DELETE RESTRICT`. | Financial history must survive. | Hard delete with cascade. |
| D-10 | Backup export and restore are platform-wide and super_admin only. | Restoring one tenant into a shared DB is unsafe. | Per-store restore (deferred). |

---

## 3. Area A: Database and Migration

### 3.1 Table classification

| Class | Tables | Treatment |
|---|---|---|
| **Root, scoped (`store_id NOT NULL`)** | `categories`, `products`, `toppings`, `promotions`, `funds`, `orders`, `transactions`, `transaction_categories`, `ingredients` | Add column, backfill `1`, FK, composite indexes. |
| **Child, scoped via parent** | `product_variants` (to `products`), `variant_groups` **[verify]**, `order_items` (to `orders`), `purchase_items` (to `transactions`), `recipe_items` (to variant/topping and `ingredients`), `fund_reconciliations` (to `funds`) | No column. Handlers verify parent ownership (see §4.4). |
| **Optional store reference** | `audit_logs`, `idempotency_records` | Nullable `store_id`. Audit is backfilled to `1` except auth and user events. |
| **Global** | `users`, `revoked_tokens`, `settings` (SMTP only after migration) | Unchanged. |
| **New** | `stores`, `user_stores`, `store_settings`, `schema_migrations` | Created by `000020` and the runner. |

### 3.2 ER diagram

```mermaid
erDiagram
    stores ||--o{ user_stores : "has members"
    users  ||--o{ user_stores : "belongs to"
    stores ||--o{ store_settings : configures
    stores ||--o{ categories : owns
    stores ||--o{ products : owns
    stores ||--o{ toppings : owns
    stores ||--o{ promotions : owns
    stores ||--o{ funds : owns
    stores ||--o{ orders : owns
    stores ||--o{ transactions : owns
    stores ||--o{ transaction_categories : owns
    stores ||--o{ ingredients : owns
    categories ||--o{ products : groups
    products ||--o{ product_variants : has
    orders ||--o{ order_items : contains
    funds ||--o{ transactions : records
    funds ||--o{ fund_reconciliations : audits
    transactions ||--o{ purchase_items : itemizes
    ingredients ||--o{ purchase_items : bought_as
    ingredients ||--o{ recipe_items : used_in
    stores {
        int id PK
        varchar code UK "slug"
        varchar name
        varchar business_type "fnb|cafe|retail|bakery|other"
        text logo_url
        text address
        varchar phone
        varchar currency_code
        varchar currency_symbol
        varchar currency_position "prefix|suffix"
        varchar vietqr_bank_id
        varchar vietqr_account_no
        varchar vietqr_account_name
        varchar timezone
        bool is_active
    }
    user_stores {
        int user_id PK_FK
        int store_id PK_FK
        varchar role "store_admin|staff"
        bool is_default
    }
    store_settings {
        int store_id PK_FK
        varchar key PK
        text value
    }
```

### 3.3 Role model

| Role | Where stored | Capabilities |
|---|---|---|
| `super_admin` | `users.role` (legacy `admin` is treated identically until `000021`) | All stores. Create, edit, deactivate stores. Manage users and memberships. Cross-store analytics. Platform backup and restore. SMTP. |
| `store_admin` | `user_stores.role` | In assigned stores only: catalog, promotions, funds, transactions, analytics, purchases, store settings (profile, VietQR, Sheets, report, auto-tag), import. |
| `staff` | `user_stores.role` | In assigned stores only: POS, create order, order history, read catalog, active promotions, toppings, funds balance, shift summary, store branding. |

Effective authority per request = `max(global role, membership role)`.
Ordering is `staff < store_admin < super_admin`.
The mapping to today's routes is in §4.5.

### 3.4 Migration mechanism (new)

1. `backend/migrations/embed.go`: `package migrations`, `//go:embed *.sql`, exposing `FS`.
   Embed cannot reach upward, so it lives in the migrations directory.
2. `internal/database/migrate.go`: `RunSQLMigrations(db, fs, onlyFrom int)`.
   - Creates `schema_migrations(version INT PK, name TEXT, applied_at TIMESTAMPTZ)`.
   - Applies pending files **in a single transaction per file**, in order, and records the version.
   - **Baseline rule:** if legacy tables exist (`orders` present) but `schema_migrations` is empty, mark `1..19` as applied **without executing them** (AutoMigrate already built that schema) and run only `>= 20`.
   - On a fresh DB (no `orders` table) skip all SQL. `AutoMigrate` builds the schema from the updated models, then `EnsureDefaultStore` runs.
3. `InitDB` order becomes: connect, **`RunSQLMigrations`**, `AutoMigrate` (with new models), `EnsureDefaultStore`, seeds.
4. `EnsureDefaultStore` creates Store `#1` on fresh DBs from env (`INITIAL_STORE_NAME`, `INITIAL_STORE_CODE`; defaults `My Store`, `main`). It never uses a brand literal.

> [!WARNING]
> **GORM re-creates indexes from struct tags.** The tags `uniqueIndex` on `Order.OrderCode` and `Ingredient.Name` would recreate the old global unique indexes on the next boot.
> The tags must change in the same release as `000020`:
> `uniqueIndex:uq_orders_store_order_code,priority:2` plus `StoreID ... priority:1`, and likewise for ingredients.

### 3.5 Migration blueprint: `000020_multi_store_foundation.up.sql`

Runs inside the runner's transaction (no `BEGIN/COMMIT` in the file, no `CONCURRENTLY`).
It is sized for one café-scale database. For multi-million-row tables, split the backfill into batches.

```sql
-- ============================================================
-- STEP 1: stores, store_settings, Store #1 from existing settings
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
    id                  SERIAL PRIMARY KEY,
    code                VARCHAR(50)  NOT NULL,
    name                VARCHAR(150) NOT NULL,
    business_type       VARCHAR(30)  NOT NULL DEFAULT 'fnb',
    logo_url            TEXT         NOT NULL DEFAULT '',
    address             TEXT         NOT NULL DEFAULT '',
    phone               VARCHAR(30)  NOT NULL DEFAULT '',
    currency_code       VARCHAR(10)  NOT NULL DEFAULT 'VND',
    currency_symbol     VARCHAR(10)  NOT NULL DEFAULT 'đ',
    currency_position   VARCHAR(10)  NOT NULL DEFAULT 'suffix',
    vietqr_bank_id      VARCHAR(30)  NOT NULL DEFAULT '',
    vietqr_account_no   VARCHAR(50)  NOT NULL DEFAULT '',
    vietqr_account_name VARCHAR(150) NOT NULL DEFAULT '',
    timezone            VARCHAR(50)  NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_stores_code CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
    CONSTRAINT chk_stores_business_type
        CHECK (business_type IN ('fnb','cafe','retail','bakery','other')),
    CONSTRAINT chk_stores_currency_position
        CHECK (currency_position IN ('prefix','suffix'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_code ON stores (lower(code));

-- Store #1: populated from the existing settings rows (fallbacks protect partial data).
-- 'currency' vs 'currency_code' both checked because seed and whitelist disagree (defect D1).
INSERT INTO stores (id, code, name, business_type, logo_url, address, phone,
                    currency_code, currency_symbol, currency_position,
                    vietqr_bank_id, vietqr_account_no, vietqr_account_name)
SELECT 1,
       'tho-juice-coffee',
       COALESCE(NULLIF((SELECT value FROM settings WHERE key='store_name'),''), 'Thỏ Juice & Coffee'),
       'cafe',
       COALESCE((SELECT value FROM settings WHERE key='store_logo_url'),''),
       COALESCE((SELECT value FROM settings WHERE key='store_address'),''),
       COALESCE((SELECT value FROM settings WHERE key='store_phone'),''),
       COALESCE(NULLIF((SELECT value FROM settings WHERE key='currency_code'),''),
                NULLIF((SELECT value FROM settings WHERE key='currency'),''), 'VND'),
       COALESCE(NULLIF((SELECT value FROM settings WHERE key='currency_symbol'),''), 'đ'),
       COALESCE(NULLIF((SELECT value FROM settings WHERE key='currency_position'),''), 'suffix'),
       COALESCE((SELECT value FROM settings WHERE key='vietqr_bank_id'),''),
       COALESCE((SELECT value FROM settings WHERE key='vietqr_account_no'),''),
       COALESCE((SELECT value FROM settings WHERE key='vietqr_account_name'),'')
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE id = 1);

SELECT setval(pg_get_serial_sequence('stores','id'),
              GREATEST(1, (SELECT MAX(id) FROM stores)));

CREATE TABLE IF NOT EXISTS store_settings (
    store_id   INTEGER      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      TEXT         NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, key)
);

-- Copy per-store keys; originals are KEPT in settings for rollback (removed in 000021).
-- SMTP credentials remain global.
INSERT INTO store_settings (store_id, key, value, updated_at)
SELECT 1, key, value, updated_at
FROM settings
WHERE key NOT LIKE 'smtp\_%'
  AND key NOT IN ('store_name','store_address','store_phone','store_logo_url',
                  'currency','currency_code','currency_symbol','currency_position',
                  'vietqr_bank_id','vietqr_account_no','vietqr_account_name')
ON CONFLICT (store_id, key) DO NOTHING;

-- ============================================================
-- STEP 2: add store_id (nullable) -> backfill -> default -> NOT NULL -> FK
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','toppings','promotions','funds',
                           'orders','transactions','transaction_categories','ingredients']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS store_id INTEGER', t);
    EXECUTE format('UPDATE %I SET store_id = 1 WHERE store_id IS NULL', t);
    -- Transitional default so the OLD binary (no store_id in INSERTs) keeps working.
    EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET DEFAULT 1', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET NOT NULL', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_store') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (store_id)
                      REFERENCES stores(id) ON DELETE RESTRICT', t, 'fk_' || t || '_store');
    END IF;
  END LOOP;
END $$;

-- Optional store reference (nullable, no default).
ALTER TABLE audit_logs         ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id);
UPDATE audit_logs SET store_id = 1
 WHERE store_id IS NULL AND resource NOT IN ('auth','user','users','store','stores');
UPDATE idempotency_records SET store_id = 1 WHERE store_id IS NULL;

-- Per-store uniqueness (replace the global ones; names covered for both SQL and GORM origins).
ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_name_key;
DROP INDEX IF EXISTS idx_ingredients_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_store_name ON ingredients (store_id, name);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_code_key;
DROP INDEX IF EXISTS idx_orders_order_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_store_order_code ON orders (store_id, order_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders (order_code);   -- lookup/search

-- Tenant-aware composite indexes (hot paths: POS, ledger, analytics).
CREATE INDEX IF NOT EXISTS idx_orders_store_created        ON orders (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created ON orders (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_store_created            ON transactions (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_store_fund_created       ON transactions (store_id, fund_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_store_category     ON products (store_id, category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_categories_store_order      ON categories (store_id, display_order);
CREATE INDEX IF NOT EXISTS idx_toppings_store_active       ON toppings (store_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_promotions_store_active     ON promotions (store_id, is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_funds_store_active          ON funds (store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_txcat_store_type            ON transaction_categories (store_id, type);
CREATE INDEX IF NOT EXISTS idx_ingredients_store_category  ON ingredients (store_id, category);
CREATE INDEX IF NOT EXISTS idx_audit_store_created         ON audit_logs (store_id, created_at DESC);

-- ============================================================
-- STEP 3: user_stores and membership backfill
-- ============================================================
CREATE TABLE IF NOT EXISTS user_stores (
    user_id    INTEGER     NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    store_id   INTEGER     NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'staff',
    is_default BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, store_id),
    CONSTRAINT chk_user_stores_role CHECK (role IN ('store_admin','staff'))
);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON user_stores (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_stores_one_default
    ON user_stores (user_id) WHERE is_default;

-- users.role is NOT rewritten (decision D-4). Legacy 'admin' => store_admin membership
-- (and treated as super_admin by the new code); 'staff' => staff membership.
INSERT INTO user_stores (user_id, store_id, role, is_default)
SELECT id, 1,
       CASE WHEN role IN ('admin','super_admin') THEN 'store_admin' ELSE 'staff' END,
       TRUE
FROM users
ON CONFLICT (user_id, store_id) DO NOTHING;
```

**`000020_multi_store_foundation.down.sql`** (safe **only before a second store holds data**; otherwise restore the pre-deploy dump):

```sql
DROP TABLE IF EXISTS user_stores;
DROP TABLE IF EXISTS store_settings;

DROP INDEX IF EXISTS uq_orders_store_order_code, uq_ingredients_store_name,
     idx_orders_store_created, idx_orders_store_status_created, idx_tx_store_created,
     idx_tx_store_fund_created, idx_products_store_category, idx_categories_store_order,
     idx_toppings_store_active, idx_promotions_store_active, idx_funds_store_active,
     idx_txcat_store_type, idx_ingredients_store_category, idx_audit_store_created;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_code_key;
ALTER TABLE orders ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);
ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_key UNIQUE (name);

ALTER TABLE audit_logs          DROP COLUMN IF EXISTS store_id;
ALTER TABLE idempotency_records DROP COLUMN IF EXISTS store_id;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','toppings','promotions','funds',
                           'orders','transactions','transaction_categories','ingredients']
  LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS store_id', t);
  END LOOP;
END $$;
DROP TABLE IF EXISTS stores;
```

### 3.6 Contract migration `000021_multi_store_contract` (end of Phase 2, after the old binary is retired)

```sql
-- 1. Remove the transitional default: inserts without a store now FAIL instead of landing in Store 1.
ALTER TABLE categories ALTER COLUMN store_id DROP DEFAULT;  -- repeat for all 9 root tables
-- 2. Cross-store reference protection at the DB level.
CREATE UNIQUE INDEX uq_funds_store_id      ON funds (store_id, id);
CREATE UNIQUE INDEX uq_categories_store_id ON categories (store_id, id);
-- composite FKs added NOT VALID, then VALIDATE (orders/transactions -> funds, products -> categories)
-- 3. Normalize roles: UPDATE users SET role='super_admin' WHERE role='admin';
-- 4. Delete the migrated per-store rows from the global settings table (keep smtp_*).
```

### 3.7 Zero-downtime analysis

| Concern | Handling |
|---|---|
| Locks | `ADD COLUMN` without default is metadata-only. `SET DEFAULT` is metadata-only. Backfill and `SET NOT NULL` scan once. Volume is one café, so this is sub-second to seconds. For large tables, batch the `UPDATE` by id range. |
| Old binary during and after migration | Inserts omit `store_id`, so `DEFAULT 1` fills it. `users.role` is unchanged. `settings` rows are retained. Old code keeps working. |
| New binary before `000021` | Writes `store_id` explicitly. Reads still work. |
| Restart | Compose rebuild causes a brief container restart (seconds). `deploy.sh` already takes a pre-deploy `pg_dump`. |
| Rollback | Phase 1 and 2: redeploy old image (still compatible). Down migration only before a second store has data. |

**Post-migration verification SQL** (run and record in the PR):

```sql
SELECT (SELECT count(*) FROM orders) = (SELECT count(*) FROM orders WHERE store_id = 1) AS orders_ok;
SELECT (SELECT count(*) FROM transactions) = (SELECT count(*) FROM transactions WHERE store_id = 1) AS tx_ok;
SELECT sum(current_balance) FROM funds;                     -- must equal the pre-migration value
SELECT count(*) FROM users u LEFT JOIN user_stores us ON us.user_id=u.id WHERE us.user_id IS NULL; -- 0
SELECT key FROM settings EXCEPT SELECT key FROM store_settings WHERE store_id=1;  -- only store_*/currency_*/vietqr_*/smtp_*
```

---

## 4. Area B: Backend Design

### 4.1 Store context middleware: `internal/middleware/store.go`

`StoreContext(db *gorm.DB, c *cache.TTLCache, requireHeader bool)` runs **after** `AuthMiddleware`:

1. **Resolve** `X-Store-ID`. Fall back to `?store_id=` for `GET` only (exports and QR).
   If absent and `requireHeader=false` (transition flag `STORE_HEADER_REQUIRED=false`), use the user's default membership.
   This keeps stale cached PWA clients (F8) working against Store 1.
   The flag flips to `true` in Phase 3.
2. **Load store** (cached 60s as `s{id}:meta`). Inactive: `403 STORE_INACTIVE` (super_admin may still pass for reactivation).
3. **Authorize.** `super_admin` or legacy `admin` passes with `store_role=super_admin`.
   Others need a `user_stores` row; otherwise `403 STORE_FORBIDDEN`.
   The same message is returned for a non-existent store, to avoid enumeration.
4. **Inject** `store_id` (`uint`), `store_role` (`models.StoreRole`) and `store` (`*models.Store`) into `*gin.Context`.
5. **Re-derive the user's role from the DB.** `AuthMiddleware` already loads the user, so it must set `user_role` from `user.Role`, not from the token (A6).

Also in this file:
- `RequireStoreRole(min models.StoreRole)` (ordering `staff < store_admin < super_admin`).
- `RequireSuperAdmin()` for platform routes.
- `GetStoreID(c) (uint, bool)`; handlers use `mustStoreID(c)` and abort with `STORE_REQUIRED` if missing.

New error codes (to be added to `docs/API_ERROR_CODES_SPECIFICATION.md`):

| Code | HTTP |
|---|---|
| `STORE_REQUIRED` | 400 |
| `STORE_NOT_FOUND` | 404 |
| `STORE_FORBIDDEN` | 403 |
| `STORE_INACTIVE` | 403 |
| `STORE_CODE_TAKEN` | 409 |
| `STORE_ROLE_INSUFFICIENT` | 403 |

### 4.2 GORM scope helper: `internal/database/store_scope.go`

```go
// ScopeByStore restricts a query to one tenant. clause.CurrentTable avoids
// ambiguous-column errors in joins.
func ScopeByStore(storeID uint) func(*gorm.DB) *gorm.DB {
    return func(db *gorm.DB) *gorm.DB {
        return db.Where(clause.Eq{
            Column: clause.Column{Table: clause.CurrentTable, Name: "store_id"},
            Value:  storeID,
        })
    }
}
```

Usage: `h.db.Scopes(database.ScopeByStore(sid)).Find(&rows)`.
Inside transactions: `tx.Scopes(...)`.

**Defense in depth:**
1. **Fail-closed create callback.** Register a GORM `Create` callback: if the model has a `StoreID` field equal to `0`, abort with an error. A forgotten assignment cannot silently write to a wrong or default store.
2. **Ownership guard for `:id` endpoints and child tables.** `AssertOwned(tx, &model, id, storeID)` for roots. Parent-join helpers for children (variant to product, fund to reconciliation, ingredient, topping and variant to recipe).
3. **Static query guard (CI).** A Go test walks `internal/handlers` and `internal/services` and fails on any `.Raw(`, `.Table(`, `.Exec(` or `Model(&models.X{})` on a root table without a `store_id` / `ScopeByStore` marker, with an explicit allowlist (auth, health, backup).
4. **Optional later hardening (not in this plan):** Postgres RLS via `SET LOCAL app.store_id`. It needs care with the PgBouncer or `PreferSimpleProtocol` setup already supported in `InitDB`.

Models gain `StoreID uint \`gorm:"not null;index" json:"store_id"\``, either per struct or via an embedded `StoreScoped` mixin.

### 4.3 Store management APIs: `internal/handlers/store.go`

| Method and path | Role | Behavior |
|---|---|---|
| `GET /api/v1/stores` | any authenticated | Stores accessible to the caller, with effective `role` and `is_default`. super_admin sees all (including inactive, flagged). No `X-Store-ID` needed. |
| `POST /api/v1/stores` | super_admin | Create a store in **one DB transaction**: store row, default funds, default `transaction_categories`, default `store_settings`, creator membership. Optional menu clone. |
| `PUT /api/v1/stores/:id` | super_admin | Update `code`, `name`, `business_type`, `is_active` and profile fields. Cannot deactivate the last active store. |
| `GET/PUT/DELETE /api/v1/stores/:id/members` | super_admin | List, set role, remove memberships. Bumps the user's cache entry. |
| `POST /api/v1/users` | super_admin | Create a user with a temp password (`needs_password_setup=true`, reuses the existing setup flow) and initial memberships. |
| `GET /api/v1/analytics/overview-all-stores` | super_admin | Per-store revenue, orders, AOV, gross profit and net profit for a date range, in one `GROUP BY store_id` query. Currency differences are reported per store, not summed. |

`POST /stores` payload:

```json
{
  "code": "bakery-hn",
  "name": "Thỏ Bakery",
  "business_type": "bakery",
  "address": "", "phone": "",
  "currency_code": "VND", "currency_symbol": "đ", "currency_position": "suffix",
  "vietqr_bank_id": "", "vietqr_account_no": "", "vietqr_account_name": "",
  "timezone": "Asia/Ho_Chi_Minh",
  "clone_from_store_id": 1,
  "clone_options": {
    "categories": true, "products": true, "variants": true, "toppings": true,
    "promotions": false, "recipes": false
  },
  "member_user_ids": [{ "user_id": 2, "role": "store_admin" }]
}
```

Seeding on create (`SeedStoreDefaults(tx, storeID)`, replacing A9):
- Funds: **"Cash Drawer"** (`cash`) and **"Bank Transfer"** (`bank`), editable (see Q2).
- Default `transaction_categories` copied from a code-defined template (the six defaults in `seedTransactionCategories`).
- `store_settings` defaults: `auto_show_receipt_after_checkout`, `google_sheets_*` idle values, `enable_daily_email_report=false`, `daily_report_time=22:30`.

**Menu clone** (`CloneMenu(tx, srcID, dstID, opts)`): all rows get new IDs and a remap table (`old to new`).

| Option | Copies | Rules |
|---|---|---|
| `categories` | `categories` | New IDs. Image URLs are shared (files are not duplicated). |
| `products`, `variants` | `products` plus `product_variants` | `category_id` remapped. COGS and retail prices copied. Tags and `is_tag_locked` copied. |
| `toppings` | `toppings` | `category_id` remapped, or NULL (global) preserved. |
| `promotions` | `promotions` | `target_ids` and `gift_product_variant_id` remapped. `usage_count` reset to 0. Default **off**. |
| `recipes` | `ingredients` plus `recipe_items` | Ingredients copied **with purchase prices reset to 0** (prices are store-specific). Conversion defaults kept. Default **off**. |

Funds, orders, transactions and settings are **never** cloned.

### 4.4 Handler-by-handler scoping (IDOR checklist)

| Handler | Query sites to scope | Special cases |
|---|---|---|
| `category.go` | list, create, update, delete, reorder | `reorder` must reject IDs from another store. |
| `product.go` | list, get, create, update, delete | `category_id` in payload must belong to the store. Cache keys `s{id}:products:*`. |
| `variant.go` | add, update, delete (`:id` only) | Verify `variant -> product.store_id`. |
| `topping.go` | list, list-all, CRUD, reorder | Optional `category_id` must belong to the store. |
| `promotion.go` | list, active, CRUD, reorder | `target_ids` and `gift_product_variant_id` verified against the store. |
| `fund.go` | list, balance, reconcile (all variants), history, **`GetPeriodSummary` raw SQL**, shift summary | Reconciliation rows verified through `funds.store_id`. |
| `order.go` | list, get, **create**, cancel, delete, VietQR | `req.FundID` verified in-store (D4). Promotion, variants and toppings in-store. `order_code` uses a store prefix. Idempotency lookup requires matching `store_id`. VietQR reads store bank config (D2). |
| `transaction.go` | list, create, update, delete, category breakdown | `fund_id` in-store. `purchase_items` ingredients in-store. Linked order refunds in-store. |
| `transaction_category.go` | CRUD, reorder, set-default | `is_default` uniqueness is per store and type. |
| `purchase.go` | ingredients, history, cost-comparison, apply-cost, recipes | Recipe targets (variant or topping) and ingredients verified in-store. `apply-cost` writes only in-store menu rows. |
| `analytics.go` (45 KB) | every aggregate, many raw SQL | Add `store_id = ?` to every statement. Cash-flow, hourly distribution, rankings and top products included. Add the all-stores endpoint. |
| `setting.go` | get, store settings, update, SMTP test | Reads `stores` plus `store_settings`. Response keys stay **backward compatible** (`store_name`, `currency_symbol`, ...). `PUT /settings` splits writes: identity, currency and VietQR to `stores`; other keys to `store_settings`; `smtp_*` super_admin only (global `settings`). The response fixes D1. |
| `auto_tagging.go` (+ service) | config, preview, apply, toggle-lock | Config key `auto_tagging_config` per store. `RunNightlyJob` iterates stores. |
| `sheets_sync.go` (+ service) | test, sync-now, status | Per-store spreadsheet, service-account JSON (encrypted, per store). Exports only that store's rows. |
| `importer.go` (+ service) | template, import | Writes into the active store only. |
| `backup.go` | export, preview, restore | super_admin, platform-wide. Includes the new tables. Restore clears **all** caches. |
| `upload.go` | upload | Saves to `uploads/stores/{id}/...`. Legacy files stay where they are. |
| `auth.go` | login, me, logout, setup-password | Login and `/auth/me` return `stores[]` and `default_store_id`. |

### 4.5 Route restructure (`internal/routes/routes.go`)

```
v1
├── public:     /health, /auth/login, /auth/setup-password
├── authenticated (AuthMiddleware)
│   ├── platform (no store header)
│   │   ├── GET  /auth/me, POST /auth/logout, GET /stores
│   │   └── super_admin: POST/PUT /stores, members, POST /users,
│   │                    GET /analytics/overview-all-stores, /backup/*, SMTP settings
│   └── storeScoped (StoreContext)
│       ├── staff+:       today's "Staff & Admin Accessible" block (POS, reads, active promotions, vietqr, store settings, upload)
│       └── store_admin+: today's `adminOnly` block, with RequireStoreRole(StoreAdmin)
```

Mapping from today: `RequireRole(RoleAdmin)` to `RequireStoreRole(StoreAdmin)` for store-scoped admin routes.
`/backup/*` and the all-stores analytics move to `RequireSuperAdmin()`.

### 4.6 Services and scheduler

- `EmailService`: SMTP config is global (`GetSMTP()`). Report functions take `storeID`.
  Recipients, enable flag and time are read from `store_settings`.
  `data.StoreName` comes from `stores.name` (removes the `email.go:269` literal).
  `smtp_from_name` default drops the brand (`config.go:119`, `email.go:59`, `docker-compose.prod.yml:65`): `"RabbitPOS"` (platform name).
  Email subject and body show the store name.
- `startDailyReportScheduler`: each tick loads active stores. For each, it evaluates the store's local time in `stores.timezone`.
  `lastFired` is keyed by `storeID:date`.
  It runs email, sheets sync and auto-tag per store in goroutines, with a bounded worker count.
- `SheetsSyncService.SyncAllToGoogleSheets(storeID)` and `IsSyncEnabled(storeID)`.
- `AutoTaggingService`: `GetConfig/SaveConfig/Preview/Apply/RunForStore(storeID)`.

### 4.7 Order code and idempotency

- New format for every store except Store #1 (kept as-is): `ORD-<STORECODE>-YYYYMMDD-HHMMSS-NNNN`.
  Uniqueness is `(store_id, order_code)`.
- `IdempotencyRecord` gets `StoreID`. A hit whose `store_id` differs from the request store returns `409 ORDER_IDEMPOTENT_CONFLICT`.
  It never replays another store's response body.

---

## 5. Area C: Frontend Design

### 5.1 Store state (`src/lib/store.ts` and `src/lib/StoreContext.tsx`)

- `lib/store.ts` (non-React, usable from `api.ts` and the offline layer):
  `getActiveStoreId()`, `setActiveStoreId()`, key `rabbitpos_active_store_id`.
- `StoreContext`: `{ activeStore, storesList, switchStore(id), refreshStores(), isSuperAdmin, storeRole }`.
  - Loads `storesList` from `/auth/me` (and `/stores` on refresh).
  - Validates the persisted id against the list; falls back to `default_store_id`, then the first store.
  - On switch: persist the id, clear `clientCache`, update `document.title`.
  - Logout clears the key.
- Provider order in `layout.tsx`: `LanguageProvider > StoreProvider > AppShell`.

### 5.2 API client (`src/lib/api.ts`)

- Always add `X-Store-ID` (except `/auth/login`, `/auth/setup-password`, `/stores`-list-only calls).
- `clientCache` key = `${storeId}:${endpoint}` (fixes F1). Mutation invalidation keeps its semantics **[verify]**.
- Introduce an exported `authHeaders()` (token and store) and replace the raw `fetch` calls in `api.ts:178` and `settings/page.tsx:229,296,333` (F2).
- Downloads and `window.open` URLs append `?store_id=`.
- Remount on switch: in `AppShell`, wrap `{children}` as `<div key={activeStore.id}>` (D-8).

### 5.3 Cart isolation

| Key | Today | After |
|---|---|---|
| POS cart | `rabbitpos_active_cart` | `rabbitpos_active_cart_${storeId}` |
| Products filter | `sessionStorage['rabbitpos_filter_products']` | `rabbitpos_filter_products_${storeId}` |

Touch points: `app/page.tsx` (lines 550, 560, 586, 598, 876, 958), `transactions/page.tsx:983` (re-order writes the cart; it must write the key of the **order's store**, which is the active store).
One-time legacy migration: if `rabbitpos_active_cart` exists, move it to `..._1` and delete the old key.

### 5.4 Offline PWA engine

- DB name per store: `RabbitPOS_Offline_DB_s{id}`. **Store #1 keeps the legacy name `RabbitPOS_Offline_DB`** so queued offline orders (F5) are preserved with no data move.
  `getOfflineDB(storeId)` caches one connection per store.
- Each `offline_orders` record carries `store_id`. `sync.ts` flushes every store DB the user can access, with the matching `X-Store-ID`. An order made in Store B is never posted to Store A after a switch.
- Idempotency keys are unchanged. The `rabbitpos_device_id` and sync-lock keys stay global.
- Store-level IndexedDB contents (catalog, toppings, promotions, settings) are re-fetched per store.

### 5.5 UI

**Store switcher** (`components/StoreSwitcher.tsx`, rendered in `AppShell.tsx` header):
- `ModernSelect` visual style: logo or initials badge, name, business-type chip, active indicator.
- Hidden when the user has exactly one store (shows a static badge).
- Mobile: full-width sheet in the drawer. Desktop: header dropdown.
- Switching shows a brief skeleton and remounts the page.

**`/stores` (super_admin)** (`app/stores/page.tsx`):
- KPI row: total stores, active stores, members.
- Table or cards: name, code, type, currency, status toggle, member count, edit action.
- `StoreFormModal`: all store fields plus the creation choice
  *"Copy menu & toppings from an existing store"* (source dropdown plus option checkboxes) or *"Start with blank menu"*.
- `MemberManagerModal`: add existing users, create user (temp password), set `store_admin`/`staff`, remove.
- Optional "All stores overview" tab consuming `overview-all-stores`.

**Role-aware navigation** in `AppShell`: staff see POS and orders only. `store_admin` see the current admin set. `super_admin` additionally sees `Stores`.

**i18n**: new `stores.*` and `storeSwitcher.*` keys in **both** `vi.json` and `en.json`.

### 5.6 Currency
`formatCurrency` (`lib/utils.ts`) reads `activeStore.currency_*` instead of the settings fetch. Exports and receipts use the same source.

---

## 6. Dynamic Branding Audit

| Location | Hardcoded value | Replacement |
|---|---|---|
| `components/AppShell.tsx:46` | `useState('Thỏ Juice & Coffee')` | `activeStore.name`, with a neutral platform fallback. |
| `app/login/page.tsx:36` | default store name | Pre-auth, no store known. Show the platform brand (`RabbitPOS`), or the **last-used store** branding cached in `localStorage` (`rabbitpos_last_store_brand`). |
| `components/pos/ReceiptModal.tsx:73` | `settings?.store_name \|\| 'Thỏ Juice & Coffee'` | `activeStore.name/address/phone/logo`, no brand fallback. Receipt shows the **store's** VietQR and currency. |
| `lib/exportExcel.ts:38,226,415` | same fallback (×3) | `store.name`. File name includes `store.code`. `workbook.creator = 'RabbitPOS'` is platform-level and stays. |
| `app/settings/page.tsx:76,85,91` | default form state: name, `THO JUICE AND COFFEE`, `smtp_from_name` | Empty defaults. Form hydrates from the active store. SMTP section only for super_admin. |
| `components/common/InstallPWABanner.tsx:56,81` | `ThoPOS` aria-label and alt | `RabbitPOS` (platform). |
| `app/layout.tsx:21-58` | title, OpenGraph, siteName, descriptions with `Thỏ Juice & Coffee` / `ThoPOS` | Platform metadata (`RabbitPOS`). `StoreContext` sets `document.title = "<store> · RabbitPOS"` at runtime (F7). |
| `public/manifest.json:2-4` | `name`, `short_name: ThoPOS`, `description` | Platform-neutral `RabbitPOS`. A per-store PWA icon is out of scope (manifest is static). |
| `lib/i18n/locales/{vi,en}.json` lines 126, 185 (vi), 456, 541, 587, 591 | subtitles with the brand, placeholder `THO JUICE AND COFFEE` | Neutral text, or `{storeName}` interpolation in page subtitles. Placeholders become generic examples. **[verify]** `t()` interpolation (§1.4). |
| `backend/internal/handlers/order.go:863` | `"THO JUICE AND COFFEE"` | `store.vietqr_account_name`, error `VIETQR_NOT_CONFIGURED` if empty. |
| `backend/internal/services/email.go:59,269` | `Thỏ Juice & Coffee - RabbitPOS`, `data.StoreName` | `"RabbitPOS"` sender default. `stores.name` in the body. |
| `backend/internal/config/config.go:119`, `docker-compose.prod.yml:65` | `SMTP_FROM_NAME` default | `RabbitPOS`. |
| `backend/internal/database/postgres.go:245-253` | seeded address, phone, bank account (D3) | Removed. Store data comes from `EnsureDefaultStore` env or the migration. |
| Test fixtures (`run_offline_tests.js`, `run_hardening_tests.js`, `offline_db.test.ts`, `auth_security_test.go`) | `Thỏ Juice & Coffee` / `Thỏ Juice Test` | Left as is (fixtures, not product copy). Adapted only where tests exercise settings shape. |

Infrastructure domains (`rabbitpos.ndnworks.com` in `api.ts`) are deployment config and out of scope.

---

## 7. File-by-File Impact

### 7.1 Backend

| File | Action |
|---|---|
| `backend/migrations/000020_multi_store_foundation.{up,down}.sql` | **Create** |
| `backend/migrations/000021_multi_store_contract.{up,down}.sql` | **Create** (Phase 2) |
| `backend/migrations/embed.go` | **Create** (`go:embed`) |
| `internal/database/migrate.go` | **Create**: runner, baseline rule |
| `internal/database/store_scope.go` | **Create**: `ScopeByStore`, create callback, `AssertOwned` |
| `internal/database/postgres.go` | **Modify**: call runner, new models in AutoMigrate, `EnsureDefaultStore`, per-store seeds, drop brand seeds |
| `internal/models/store.go` | **Create**: `Store`, `UserStore`, `StoreSetting`, `StoreRole`, DTOs |
| `internal/models/{category,product,topping,promotion,fund,order,transaction,transaction_category,purchase}.go` | **Modify**: `StoreID`, composite unique tags |
| `internal/models/{audit_log,idempotency}.go` | **Modify**: nullable `StoreID` |
| `internal/models/user.go` | **Modify**: `RoleSuperAdmin`, legacy `admin` alias helper, DTOs with `stores[]` |
| `internal/models/setting.go` | **Modify**: global vs per-store key sets, fix D1 |
| `internal/middleware/store.go` | **Create** |
| `internal/middleware/auth.go` | **Modify**: role from DB |
| `internal/handlers/store.go`, `user.go` (new), `store_clone.go` | **Create** |
| `internal/handlers/{category,product,variant,topping,promotion,fund,order,transaction,transaction_category,purchase,analytics,setting,auto_tagging,sheets_sync,importer,upload,auth,backup}.go` | **Modify** (see §4.4) |
| `internal/services/{email,sheets_sync,auto_tagging,importer,audit}.go` | **Modify**: take `storeID` |
| `internal/routes/routes.go` | **Modify**: platform vs store-scoped groups, store-keyed caches |
| `cmd/server/main.go` | **Modify**: multi-store scheduler |
| `internal/config/config.go` | **Modify**: `INITIAL_STORE_*`, `STORE_HEADER_REQUIRED`, brand-neutral SMTP default |
| `internal/handlers/*_test.go`, `testutils/test_helper.go` | **Modify and extend**: two-store fixtures, isolation suite |
| `docker-compose*.yml`, `.env.example` | **Modify**: new env vars |

### 7.2 Frontend

| File | Action |
|---|---|
| `src/lib/store.ts`, `src/lib/StoreContext.tsx`, `src/types/store.ts` | **Create** |
| `src/components/StoreSwitcher.tsx` | **Create** |
| `src/app/stores/page.tsx`, `src/components/stores/{StoreFormModal,MemberManagerModal,CloneOptions}.tsx` | **Create** |
| `src/lib/api.ts` | **Modify**: header, cache key, `authHeaders()` |
| `src/lib/auth.ts` | **Modify**: persisted user includes stores, clear active store on logout |
| `src/lib/cache.ts` | **Modify**: store-aware clear |
| `src/lib/offline/{db,catalog,orders,sync}.ts` | **Modify**: per-store DB, `store_id` on queued orders, multi-DB flush |
| `src/lib/utils.ts`, `src/lib/exportExcel.ts`, `src/lib/exportCsv.ts` | **Modify**: store currency and name |
| `src/app/layout.tsx`, `public/manifest.json` | **Modify**: platform metadata |
| `src/components/AppShell.tsx` | **Modify**: switcher, role-aware nav, remount key |
| `src/app/page.tsx`, `src/app/transactions/page.tsx` | **Modify**: cart keys |
| `src/components/pos/{ReceiptModal,CartDrawer,VietQRModal,CheckoutModal}.tsx` | **Modify**: store branding and currency, verify storage use |
| `src/app/{login,settings,products,promotions,funds,dashboard,purchases}/page.tsx` | **Modify**: branding, raw fetch removal, filter keys, store-profile editing |
| `src/components/common/InstallPWABanner.tsx` | **Modify** |
| `src/lib/i18n/locales/{vi,en}.json` (+ `LanguageContext.tsx` if interpolation is missing) | **Modify** |
| `src/tests/*` | **Modify and extend**: store namespacing, offline per-store |

### 7.3 Documentation

`docs/4_DATABASE_SCHEMA.md`, `docs/5_API_ROUTES.md`, `docs/6_FRONTEND_COMPONENTS.md`, `docs/PERMISSION_MATRIX.md`,
`docs/API_ERROR_CODES_SPECIFICATION.md`, `docs/DATABASE_INVENTORY_AND_SCHEMA_AUDIT.md`, `docs/ADR_INDEX.md`
(new ADR: *Multi-Store Tenancy*), `README.md`, `.env.example`.

---

## 8. Four-Phase Roadmap

Every phase ends with a green build, tests and a deployable state. Commands follow `AGENTS.md`.

### Phase 1: Database, Migration Runner, Store CRUD Backend (additive only)
**Tasks**
1. Resolve the **[verify]** items in §1.4 and record results here.
2. Create `migrate.go`, `embed.go`, `000020` up and down. Add the `schema_migrations` baseline rule and its unit tests (legacy DB, fresh DB, re-run idempotency).
3. Add models `Store`, `UserStore`, `StoreSetting`, `StoreID` on root models, and the tag changes for composite uniques (§3.4 warning). Update `AutoMigrate` and `EnsureDefaultStore`.
4. Implement `ScopeByStore`, the create callback and `AssertOwned` (unused by handlers yet).
5. Implement `GET/POST/PUT /stores`, `POST /users` and member endpoints, with `SeedStoreDefaults` and `CloneMenu` (transactional).
6. Existing endpoints stay **unscoped and unchanged**. Store #1 is the only tenant, so behavior is identical.

**Exit criteria**
- The migration runs on a **restored copy of the production dump**. The §3.7 verification SQL passes. Fund balances are unchanged.
- Old image against the migrated DB: POS sale, ledger and report all work.
- Tests pass: migration, seeding, clone (ID remapping, promotions, recipes), store CRUD.

**Verify:** `GOFLAGS='-mod=readonly' GOPROXY=off GOSUMDB=off go build -o /dev/null ./cmd/server` and `... go test -v ./internal/database` and `./internal/handlers -run "TestStore"`.
**Rollback:** redeploy the old image. Optionally run the down migration (no second store yet).

### Phase 2: Handler Scoping and RBAC
**Tasks**
1. Add `StoreContext`, `RequireStoreRole`, `RequireSuperAdmin`. Role from DB in `AuthMiddleware`. Transition flag `STORE_HEADER_REQUIRED=false`.
2. Restructure routes (§4.5). Prefix cache keys `s{id}:`.
3. Scope every handler and service per §4.4. Fix D2 and D4. Add `store_id` to idempotency and order-code changes.
4. Split `settings` handling (stores plus `store_settings`, global SMTP). Keep response keys compatible.
5. Multi-store scheduler, email, sheets and auto-tag services.
6. Add the **tenant-isolation suite**: two stores with overlapping data. For every `:id` endpoint, assert cross-store access returns `404` or `403` and mutates nothing. Add the static query-guard test.
7. Ship `000021` (contract) only after the old binary is gone **and** Phase 2 has been live for the agreed soak period.

**Exit criteria**
- Isolation suite and guard test are green. The existing handler tests pass (single-store behavior unchanged).
- Manual check with two stores: no data bleed in lists, analytics, exports, QR.
- A request without the header still works for Store #1 (transition flag on).

**Verify:** `go build` as above, `go test -v ./internal/handlers`, `./internal/middleware`, `./internal/services`.
**Rollback:** redeploy the Phase 1 image. Data stays consistent (additive schema).

### Phase 3: Frontend StoreContext, Switcher, Cart and Offline Isolation
**Tasks**
1. `store.ts`, `StoreContext`, provider wiring, `api.ts` header, cache key, `authHeaders()`, raw-fetch removal.
2. `StoreSwitcher` in `AppShell`, role-aware nav, remount-on-switch.
3. Cart and filter key namespacing plus the legacy migration. Re-order flow fix.
4. Offline DB per store, `store_id` on queued orders, multi-DB sync. Test upgrade with pending Store #1 offline orders.
5. Currency and receipt sourced from `activeStore`.
6. Flip `STORE_HEADER_REQUIRED=true` once the frontend is deployed and PWA caches have refreshed (document how to force the update).

**Exit criteria**
- Switching stores never shows another store's cart, catalog, funds or orders (manual plus unit tests).
- Queued offline orders created before the upgrade sync into Store #1.
- `npx --no-install tsc --noEmit` is clean. Existing `src/tests` pass.

**Rollback:** redeploy the previous frontend. The backend remains compatible while the header flag is `false`.

### Phase 4: Store Admin UI, Menu Cloning and Dynamic Branding
**Tasks**
1. `/stores` page, `StoreFormModal` with the clone option, `MemberManagerModal`, optional all-stores overview.
2. Complete the branding replacements in §6 (frontend and backend), neutral manifest and metadata.
3. Settings page: per-store profile, VietQR, Sheets and report config. SMTP only for super_admin.
4. i18n: all new keys in **both** locale files. Interpolation for page subtitles.
5. Docs and ADR updates (§7.3). Final grep gate: no `Thỏ`, `ThoPOS` or `THO JUICE` outside the migration fallback and test fixtures.

**Exit criteria**
- Create a store with "copy menu" and with "blank menu". Staff member sees only their store. A deactivated store blocks access.
- Receipts, exports and emails show the correct store name and currency.

**Rollback:** hide the `/stores` route behind `featureFlags.ts` and redeploy the previous frontend.

---

## 9. Test Strategy

| Layer | Tests |
|---|---|
| Migration | Legacy-DB baseline, fresh DB, idempotent re-run, row-count and balance parity, role and settings mapping. |
| Isolation | Two-store fixtures. Cross-store `:id` read, update and delete. Cross-store `fund_id`, `category_id`, `promotion`, `variant`, `ingredient` in payloads. |
| RBAC | `staff`, `store_admin`, `super_admin` across platform and store routes. Membership revoked mid-session. Inactive store. |
| Idempotency | Same key from a different store returns 409. |
| Cache | Same endpoint, two stores, no cross-hit. |
| Scheduler | Per-store time, timezone, de-duplication. |
| Frontend | Cart and filter key namespacing, `api.ts` header and cache key, offline per-store DB, legacy migration. |
| Static guard | CI test failing on unscoped raw SQL. |

---

## 10. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| A missed query site leaks data across stores | **High** | Create callback, ownership guard, static query guard, isolation suite. Review `analytics.go` and `fund.go` raw SQL line by line. |
| AutoMigrate re-creates old unique indexes | High | Change struct tags in the same release (§3.4). Test with a legacy snapshot. |
| Migration on production data | High | Rehearse on a restored dump. Pre-deploy `pg_dump` (already in `deploy.sh`). Verification SQL. |
| Old PWA clients without `X-Store-ID` | Medium | Transition flag and default-store fallback until Phase 3 is live. |
| Lost queued offline orders | Medium | Legacy DB name reserved for Store #1. `store_id` tagging. Upgrade test. |
| Admin lockout from role renaming | Medium | Decision D-4: no rewrite until `000021`. |
| `DEFAULT 1` misfiling rows | Medium | Dropped in `000021`. Create callback rejects zero. |
| Scheduler load with many stores | Low | Bounded worker pool. |

---

## 11. Open Questions (need your decision)

1. **Existing admins.** Should NDN and NHUNG (currently `admin`) become `super_admin`? The plan keeps their full access either way.
2. **Default fund names** for new stores: English "Cash Drawer" and "Bank Transfer" (as requested), or Vietnamese "Tiền mặt" and "Chuyển khoản" like Store #1?
3. **Ingredients and recipes:** per store (planned) or a shared catalog across stores? Per store keeps cost and price history clean.
4. **SMTP:** one global mail account (planned), or per-store sender credentials?
5. **Order code prefix** for new stores (`ORD-<CODE>-...`). Acceptable, or keep the current format for all stores?
6. **Platform brand:** confirm `RabbitPOS` as the neutral name for login, PWA manifest and metadata.
7. **Google Sheets:** one spreadsheet per store (planned)?
8. **Store deactivation only, no hard delete** (D-9). Confirm.
9. **Timezone per store** (`stores.timezone`, an addition to your field list). Keep?
10. **Login behavior** for multi-store users: land in the default store (planned), or always show a store picker?

---

## 12. Approval Gate

No implementation starts until this plan is approved.
On approval, Phase 1 begins with the **[verify]** items (§1.4) and the restored-dump migration rehearsal.
