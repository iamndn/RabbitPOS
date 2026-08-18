-- Phase 1: Rollback
ALTER TABLE users DROP COLUMN IF EXISTS needs_password_setup;
ALTER TABLE orders DROP COLUMN IF EXISTS cashier_id, DROP COLUMN IF EXISTS cashier_name;
ALTER TABLE transactions DROP COLUMN IF EXISTS cashier_id, DROP COLUMN IF EXISTS cashier_name;
DELETE FROM settings WHERE key = 'store_logo_url';
