DROP INDEX IF EXISTS idx_products_tag_locked;
ALTER TABLE products DROP COLUMN IF EXISTS tag_locked;
DELETE FROM settings WHERE key IN ('auto_tagging_enabled', 'auto_tagging_config');
