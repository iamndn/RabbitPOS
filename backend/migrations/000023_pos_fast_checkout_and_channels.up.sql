-- Migration: 000023_pos_fast_checkout_and_channels.up.sql
-- Description: Add daily queue number, sales channel and platform commission percent to orders with indexes

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS daily_seq_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sales_channel VARCHAR(30) NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS platform_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_orders_store_created_seq ON orders (store_id, created_at DESC, daily_seq_no);
CREATE INDEX IF NOT EXISTS idx_orders_store_channel_created ON orders (store_id, sales_channel, status, created_at DESC);
