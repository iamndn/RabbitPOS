-- 000018_purchase_tracking_and_recipes.up.sql
-- RabbitPOS: Inventory Purchase Tracking, Ingredient Fluctuations & Recipe Costing (BOM)

-- 1. Table `ingredients` (Nguyên vật liệu, Hoa quả, Bao bì)
CREATE TABLE IF NOT EXISTS ingredients (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'fruit', -- 'fruit', 'ingredient', 'packaging', 'other'
    unit VARCHAR(20) NOT NULL, -- 'kg', 'lít', 'lon', 'hộp', 'cái', 'túi'
    latest_purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    average_purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    yield_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0000, -- e.g. 0.45 for orange juice, 0.55 for carrot, 1.0 for milk/cups
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients (name);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients (category);

-- 2. Table `purchase_items` (Chi tiết mặt hàng trong giao dịch chi)
CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_tx ON purchase_items (transaction_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_ing ON purchase_items (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_created ON purchase_items (created_at DESC);

-- 3. Table `recipe_items` (Định lượng công thức Bill of Materials - BOM)
CREATE TABLE IF NOT EXISTS recipe_items (
    id BIGSERIAL PRIMARY KEY,
    product_variant_id BIGINT REFERENCES product_variants(id) ON DELETE CASCADE,
    topping_id BIGINT REFERENCES toppings(id) ON DELETE CASCADE,
    ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    usage_quantity DECIMAL(10,3) NOT NULL, -- e.g. 0.150 (kg), 0.025 (lít), 1 (cái)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_recipe_target CHECK (
        (product_variant_id IS NOT NULL AND topping_id IS NULL) OR
        (product_variant_id IS NULL AND topping_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_recipe_items_variant ON recipe_items (product_variant_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_topping ON recipe_items (topping_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ing ON recipe_items (ingredient_id);
