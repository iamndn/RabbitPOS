-- Migration: 000023_pos_fast_checkout_and_channels.down.sql
-- Description: Revert pos fast checkout, daily seq no, and sales channels columns

DROP INDEX IF EXISTS idx_orders_store_channel_created;
DROP INDEX IF EXISTS idx_orders_store_created_seq;

ALTER TABLE orders
  DROP COLUMN IF EXISTS platform_commission_percent,
  DROP COLUMN IF EXISTS sales_channel,
  DROP COLUMN IF EXISTS daily_seq_no;
