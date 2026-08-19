-- Migration: 000015_performance_indexes.up.sql
-- Purpose: Add composite and covering indexes for high-frequency queries and aggregations

-- 1. Covering index for Analytics & P&L queries on orders
CREATE INDEX IF NOT EXISTS idx_orders_analytics 
    ON orders (status, created_at DESC) 
    INCLUDE (total_amount, discount_amount, shipping_fee, surcharge);

-- 2. Fast JOIN and aggregation index for order items by product variant
CREATE INDEX IF NOT EXISTS idx_order_items_perf 
    ON order_items (order_id, product_variant_id);

-- 3. Composite index for Fund Ledger & Period Summary transactions
CREATE INDEX IF NOT EXISTS idx_transactions_perf 
    ON transactions (fund_id, transaction_type, created_at DESC);

-- 4. Composite index for active catalog products by category
CREATE INDEX IF NOT EXISTS idx_products_active_cat 
    ON products (is_active, category_id);

-- 5. Composite index for active toppings by category
CREATE INDEX IF NOT EXISTS idx_toppings_active_cat 
    ON toppings (is_active, category_id);
