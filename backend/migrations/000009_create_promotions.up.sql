-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id                      BIGSERIAL PRIMARY KEY,
    name                    VARCHAR(150)    NOT NULL,
    promo_type              VARCHAR(50)     NOT NULL, -- 'discount_amount', 'discount_percent', 'gift_item'
    discount_value          NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    min_order_amount        NUMERIC(15, 2)  NOT NULL DEFAULT 0,
    min_quantity            INT             NOT NULL DEFAULT 0,
    scope                   VARCHAR(50)     NOT NULL DEFAULT 'all', -- 'all', 'category', 'product'
    target_ids              JSONB           NOT NULL DEFAULT '[]',
    gift_product_variant_id BIGINT          NULL REFERENCES product_variants(id) ON DELETE SET NULL,
    start_date              TIMESTAMPTZ     NULL,
    end_date                TIMESTAMPTZ     NULL,
    usage_limit             INT             NOT NULL DEFAULT 0, -- 0 = unlimited
    usage_count             INT             NOT NULL DEFAULT 0,
    is_active               BOOLEAN         NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_is_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promotions_start_date ON promotions(start_date);
CREATE INDEX IF NOT EXISTS idx_promotions_end_date ON promotions(end_date);

-- Alter orders table to support promotions, dynamic fee adjustments, and cancellation lifecycle
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS promotion_id          BIGINT         NULL REFERENCES promotions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS promotion_discount    NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_fee          NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS platform_fee_discount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS surcharge             NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cancel_reason         TEXT           NULL,
    ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ    NULL;

CREATE INDEX IF NOT EXISTS idx_orders_promotion_id ON orders(promotion_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
