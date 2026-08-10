-- ==============================================================================
-- Migration: 000002_create_orders_and_funds_tables.down.sql
-- Description: Drop Order & Fund domain tables
-- ==============================================================================

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS funds;
