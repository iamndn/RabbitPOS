ALTER TABLE order_items
    DROP COLUMN IF EXISTS toppings_price,
    DROP COLUMN IF EXISTS selected_toppings;

DROP TABLE IF EXISTS toppings;
