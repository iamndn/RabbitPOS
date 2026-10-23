-- 000020_multi_store_foundation.up.sql
-- Multi-store foundation (EXPAND phase). Additive only: old binaries keep working.
-- Executed by internal/database/migrate.go inside ONE transaction (no BEGIN/COMMIT here).
-- Id columns are BIGINT to match GORM-created ids (uint -> bigint) in this database.
-- Non-structural performance indexes are created idempotently from Go (ensureStoreIndexes).

-- ============================================================
-- STEP 1: stores + store_settings, Store #1 from existing settings
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
    id                  BIGSERIAL PRIMARY KEY,
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

-- Store #1 is built from the existing settings rows. Both 'currency_code' and 'currency'
-- are checked because the seed and the POS whitelist disagree on the key name.
INSERT INTO stores (id, code, name, business_type, logo_url, address, phone,
                    currency_code, currency_symbol, currency_position,
                    vietqr_bank_id, vietqr_account_no, vietqr_account_name)
SELECT 1,
       'tho-juice-coffee',
       COALESCE(NULLIF((SELECT value FROM settings WHERE key = 'store_name'), ''), 'Thỏ Juice & Coffee'),
       'cafe',
       COALESCE((SELECT value FROM settings WHERE key = 'store_logo_url'), ''),
       COALESCE((SELECT value FROM settings WHERE key = 'store_address'), ''),
       COALESCE((SELECT value FROM settings WHERE key = 'store_phone'), ''),
       COALESCE(NULLIF((SELECT value FROM settings WHERE key = 'currency_code'), ''),
                NULLIF((SELECT value FROM settings WHERE key = 'currency'), ''), 'VND'),
       COALESCE(NULLIF((SELECT value FROM settings WHERE key = 'currency_symbol'), ''), 'đ'),
       CASE WHEN (SELECT value FROM settings WHERE key = 'currency_position') = 'prefix'
            THEN 'prefix' ELSE 'suffix' END,
       COALESCE((SELECT value FROM settings WHERE key = 'vietqr_bank_id'), ''),
       COALESCE((SELECT value FROM settings WHERE key = 'vietqr_account_no'), ''),
       COALESCE((SELECT value FROM settings WHERE key = 'vietqr_account_name'), '')
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE id = 1);

SELECT setval(pg_get_serial_sequence('stores', 'id'), GREATEST(1, (SELECT MAX(id) FROM stores)));

CREATE TABLE IF NOT EXISTS store_settings (
    store_id   BIGINT       NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    key        VARCHAR(100) NOT NULL,
    value      TEXT         NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, key)
);

-- Copy per-store keys to Store #1. The originals stay in settings (rollback safety, removed in 000021).
-- smtp_* credentials remain global.
INSERT INTO store_settings (store_id, key, value, updated_at)
SELECT 1, key, value, updated_at
FROM settings
WHERE key NOT LIKE 'smtp\_%'
  AND key NOT IN ('store_name', 'store_address', 'store_phone', 'store_logo_url',
                  'currency', 'currency_code', 'currency_symbol', 'currency_position',
                  'vietqr_bank_id', 'vietqr_account_no', 'vietqr_account_name')
ON CONFLICT (store_id, key) DO NOTHING;

-- ============================================================
-- STEP 2: store_id on the 9 root tables (nullable -> backfill -> default -> NOT NULL -> FK)
-- ============================================================
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories', 'products', 'toppings', 'promotions', 'funds',
                             'orders', 'transactions', 'transaction_categories', 'ingredients']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS store_id BIGINT', t);
        EXECUTE format('UPDATE %I SET store_id = 1 WHERE store_id IS NULL', t);
        -- Transitional default: an OLD binary (no store_id in its INSERTs) keeps working.
        -- Removed by 000021 once every code path writes store_id explicitly.
        EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET DEFAULT 1', t);
        EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET NOT NULL', t);
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_store') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT',
                           t, 'fk_' || t || '_store');
        END IF;
    END LOOP;
END $$;

-- Optional store reference (nullable, no default). FK names match ensureStoreForeignKeys() in Go.
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS store_id BIGINT;
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS store_id BIGINT;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_audit_logs_store') THEN
        ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_store
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_idempotency_records_store') THEN
        ALTER TABLE idempotency_records ADD CONSTRAINT fk_idempotency_records_store
            FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;
    END IF;
END $$;
UPDATE audit_logs SET store_id = 1
 WHERE store_id IS NULL AND resource NOT IN ('auth', 'user', 'users', 'store', 'stores');
UPDATE idempotency_records SET store_id = 1 WHERE store_id IS NULL;

-- Per-store uniqueness replaces the global unique constraints.
-- Dynamically detect and drop any single-column unique constraint or unique index on
-- ingredients(name) and orders(order_code) regardless of GORM or manual naming conventions.
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop single-column unique constraints on ingredients(name)
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE cls.relname = 'ingredients'
          AND con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND att.attname = 'name'
    ) LOOP
        EXECUTE format('ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- 2. Drop single-column unique indexes on ingredients(name) that are not constraint-backed
    FOR r IN (
        SELECT idx.relname AS indexname
        FROM pg_index i
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = i.indkey[0]
        WHERE tbl.relname = 'ingredients'
          AND i.indisunique
          AND i.indnatts = 1
          AND att.attname = 'name'
          AND idx.relname NOT IN ('uq_ingredients_store_name')
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;

    -- 3. Drop single-column unique constraints on orders(order_code)
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class cls ON cls.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE cls.relname = 'orders'
          AND con.contype = 'u'
          AND array_length(con.conkey, 1) = 1
          AND att.attname = 'order_code'
    ) LOOP
        EXECUTE format('ALTER TABLE orders DROP CONSTRAINT IF EXISTS %I', r.conname);
    END LOOP;

    -- 4. Drop single-column unique indexes on orders(order_code) that are not constraint-backed
    FOR r IN (
        SELECT idx.relname AS indexname
        FROM pg_index i
        JOIN pg_class tbl ON tbl.oid = i.indrelid
        JOIN pg_class idx ON idx.oid = i.indexrelid
        JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = i.indkey[0]
        WHERE tbl.relname = 'orders'
          AND i.indisunique
          AND i.indnatts = 1
          AND att.attname = 'order_code'
          AND idx.relname NOT IN ('uq_orders_store_order_code')
    ) LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

ALTER TABLE ingredients DROP CONSTRAINT IF EXISTS ingredients_name_key;
DROP INDEX IF EXISTS idx_ingredients_name;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_store_name ON ingredients (store_id, name);

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_code_key;
DROP INDEX IF EXISTS idx_orders_order_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_store_order_code ON orders (store_id, order_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders (order_code);

-- ============================================================
-- STEP 3: user_stores + membership backfill
-- ============================================================
CREATE TABLE IF NOT EXISTS user_stores (
    user_id    BIGINT      NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    store_id   BIGINT      NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'staff',
    is_default BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, store_id),
    CONSTRAINT chk_user_stores_role CHECK (role IN ('store_admin', 'staff'))
);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON user_stores (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_stores_one_default
    ON user_stores (user_id) WHERE is_default;

-- users.role is intentionally NOT rewritten (decision D-4): legacy 'admin' is treated as
-- super_admin by the application, and an older binary still recognizes it.
INSERT INTO user_stores (user_id, store_id, role, is_default)
SELECT id, 1,
       CASE WHEN role IN ('admin', 'super_admin') THEN 'store_admin' ELSE 'staff' END,
       TRUE
FROM users
ON CONFLICT (user_id, store_id) DO NOTHING;
