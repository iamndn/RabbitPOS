-- Phase 6: High Performance Composite Indexes for POS, Analytics & Financial Ledger
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders (created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_type ON transactions (created_at DESC, transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_fund_created ON transactions (fund_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
