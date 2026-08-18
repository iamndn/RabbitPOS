ALTER TABLE orders
    DROP COLUMN IF EXISTS cancelled_at,
    DROP COLUMN IF EXISTS cancel_reason,
    DROP COLUMN IF EXISTS surcharge,
    DROP COLUMN IF EXISTS platform_fee_discount,
    DROP COLUMN IF EXISTS shipping_fee,
    DROP COLUMN IF EXISTS promotion_discount,
    DROP COLUMN IF EXISTS promotion_id;

DROP TABLE IF EXISTS promotions;
