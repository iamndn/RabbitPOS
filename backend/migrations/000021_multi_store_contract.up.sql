-- 000021_multi_store_contract.up.sql
-- Contract phase for multi-store upgrade (Decision D-3, D-4, D-6).
-- Executed after the old binary has been fully retired and Phase 2 has completed its soak period.

-- 1. Remove transitional default (DEFAULT 1): inserts without a store now fail.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories', 'products', 'toppings', 'promotions', 'funds',
                             'orders', 'transactions', 'transaction_categories', 'ingredients']
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id DROP DEFAULT', t);
    END LOOP;
END $$;

-- 2. DB-level cross-store reference integrity indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_funds_store_id ON funds (store_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_store_id ON categories (store_id, id);

-- 3. Normalize legacy user roles: legacy 'admin' becomes 'super_admin'
UPDATE users SET role = 'super_admin' WHERE role = 'admin';

-- 4. Delete migrated per-store rows from the global settings table (keep smtp_* and identity fallbacks)
DELETE FROM settings
WHERE key NOT LIKE 'smtp\_%'
  AND key NOT IN (
      'store_name', 'store_address', 'store_phone', 'store_logo_url',
      'currency', 'currency_code', 'currency_symbol', 'currency_position',
      'vietqr_bank_id', 'vietqr_account_no', 'vietqr_account_name'
  );
