-- Fix foreign key constraint fk_orders_promotion on orders table to allow ON UPDATE CASCADE ON DELETE SET NULL
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_promotion') THEN
        ALTER TABLE orders DROP CONSTRAINT fk_orders_promotion;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_promotion_id_fkey') THEN
        ALTER TABLE orders DROP CONSTRAINT orders_promotion_id_fkey;
    END IF;
    ALTER TABLE orders
        ADD CONSTRAINT fk_orders_promotion
        FOREIGN KEY (promotion_id)
        REFERENCES promotions(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;
