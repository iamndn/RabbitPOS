ALTER TABLE products ADD COLUMN IF NOT EXISTS tag_locked BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_products_tag_locked ON products(tag_locked);

INSERT INTO settings (key, value, updated_at)
VALUES 
    ('auto_tagging_enabled', 'false', CURRENT_TIMESTAMP),
    ('auto_tagging_config', '{"enabled":false,"time_window_days":14,"best_seller_top_n":5,"best_seller_min_qty":10,"new_product_days":14,"high_profit_margin_min":60.0,"high_profit_min_qty":5,"prioritize_best_seller_over_new":true}', CURRENT_TIMESTAMP)
ON CONFLICT (key) DO NOTHING;
