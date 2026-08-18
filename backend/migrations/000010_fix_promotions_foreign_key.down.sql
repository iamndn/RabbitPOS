-- Rollback foreign key constraint on orders table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_promotion') THEN
        ALTER TABLE orders DROP CONSTRAINT fk_orders_promotion;
    END IF;
    ALTER TABLE orders
        ADD CONSTRAINT fk_orders_promotion
        FOREIGN KEY (promotion_id)
        REFERENCES promotions(id);
EXCEPTION
    WHEN others THEN NULL;
END $$;
