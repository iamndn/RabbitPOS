-- 000020_multi_store_foundation.down.sql
-- WARNING: lossy once a second store holds data. Restore the pre-deploy dump instead in that case.
-- Store #1 data is preserved: the original rows were never removed from settings.

DROP TABLE IF EXISTS user_stores;
DROP TABLE IF EXISTS store_settings;

DROP INDEX IF EXISTS uq_orders_store_order_code, uq_ingredients_store_name, idx_orders_order_code;

-- Restore the global uniqueness (fails if two stores now share an order code or ingredient name).
ALTER TABLE orders ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);
ALTER TABLE ingredients ADD CONSTRAINT ingredients_name_key UNIQUE (name);

-- Dropping a column also drops the composite indexes that include it.
ALTER TABLE audit_logs DROP COLUMN IF EXISTS store_id;
ALTER TABLE idempotency_records DROP COLUMN IF EXISTS store_id;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['categories', 'products', 'toppings', 'promotions', 'funds',
                             'orders', 'transactions', 'transaction_categories', 'ingredients']
    LOOP
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS store_id', t);
    END LOOP;
END $$;

DROP TABLE IF EXISTS stores;
