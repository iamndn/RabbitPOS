-- Migration: 000024_topping_categories_many_to_many.up.sql
-- Description: Create topping_categories join table to allow toppings to be linked to multiple categories

CREATE TABLE IF NOT EXISTS topping_categories (
    topping_id BIGINT NOT NULL REFERENCES toppings(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (topping_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_topping_categories_cat ON topping_categories(category_id);

-- Backfill existing single-category toppings into topping_categories
INSERT INTO topping_categories (topping_id, category_id)
SELECT id, category_id FROM toppings
WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;
