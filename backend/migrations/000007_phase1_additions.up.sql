-- Phase 1: Password Setup Flow, Cashier Attribution & Store Logo
-- Migration: 000007_phase1_additions.up.sql

-- 1. Add needs_password_setup column to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS needs_password_setup BOOLEAN NOT NULL DEFAULT true;

-- 2. Add cashier attribution columns to orders table
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cashier_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(100) NOT NULL DEFAULT '';

-- 3. Add cashier attribution columns to transactions table
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS cashier_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(100) NOT NULL DEFAULT '';

-- 4. Add store_logo_url to settings table (idempotent)
INSERT INTO settings (key, value, updated_at)
VALUES ('store_logo_url', '', NOW())
ON CONFLICT (key) DO NOTHING;
