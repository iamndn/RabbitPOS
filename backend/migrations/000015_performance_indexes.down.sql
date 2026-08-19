-- Migration: 000015_performance_indexes.down.sql
-- Purpose: Rollback composite performance indexes

DROP INDEX IF EXISTS idx_orders_analytics;
DROP INDEX IF EXISTS idx_order_items_perf;
DROP INDEX IF EXISTS idx_transactions_perf;
DROP INDEX IF EXISTS idx_products_active_cat;
DROP INDEX IF EXISTS idx_toppings_active_cat;
