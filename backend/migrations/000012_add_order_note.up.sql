-- Migration: Add note column to orders table for order-level notes
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT NULL;
