-- Create toppings table: stores topping options with optional category scoping
CREATE TABLE IF NOT EXISTS toppings (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100)    NOT NULL,
    price       NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    cogs        NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    -- NULL category_id means this topping is available for all products (global)
    category_id BIGINT          NULL REFERENCES categories(id) ON DELETE CASCADE,
    is_active   BOOLEAN         NOT NULL DEFAULT true,
    created_at  TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_toppings_category_id ON toppings(category_id);
CREATE INDEX IF NOT EXISTS idx_toppings_is_active    ON toppings(is_active);

-- Add selected_toppings JSONB to order_items to snapshot topping selections at order time
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS selected_toppings JSONB     NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS toppings_price    NUMERIC(15, 2) NOT NULL DEFAULT 0;
