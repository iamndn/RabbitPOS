-- 000021_multi_store_contract.down.sql
-- Revert contract phase back to expand phase defaults

-- 1. Restore transitional default 1 on the 9 root tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories', 'products', 'toppings', 'promotions', 'funds',
                             'orders', 'transactions', 'transaction_categories', 'ingredients']
    LOOP
        EXECUTE format('ALTER TABLE %I ALTER COLUMN store_id SET DEFAULT 1', t);
    END LOOP;
END $$;

-- 2. Drop composite uniqueness indexes
DROP INDEX IF EXISTS uq_funds_store_id;
DROP INDEX IF EXISTS uq_categories_store_id;

-- 3. Restore per-store settings from Store #1 back into global settings
INSERT INTO settings (key, value, updated_at)
SELECT key, value, updated_at FROM store_settings WHERE store_id = 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
