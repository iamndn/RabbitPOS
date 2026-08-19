-- Rollback Phase 6: Drop Performance Indexes
DROP INDEX IF EXISTS idx_orders_created_status;
DROP INDEX IF EXISTS idx_transactions_created_type;
DROP INDEX IF EXISTS idx_transactions_fund_created;
DROP INDEX IF EXISTS idx_order_items_order_id;
