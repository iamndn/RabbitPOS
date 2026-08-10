-- ==============================================================================
-- Migration: 000003_create_transactions_table.up.sql
-- Description: Create table for Financial Ledger domain (Transactions)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    fund_id INT NOT NULL REFERENCES funds(id),
    transaction_type VARCHAR(20) NOT NULL DEFAULT 'outflow', -- 'inflow', 'outflow'
    category VARCHAR(50) NOT NULL DEFAULT 'other', -- 'sale', 'ingredient_purchase', 'utility_bill', 'reconciliation_variance', 'other'
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reference_order_id INT REFERENCES orders(id) ON DELETE SET NULL,
    description TEXT,
    created_by VARCHAR(100) DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_fund_id ON transactions(fund_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_order ON transactions(reference_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
