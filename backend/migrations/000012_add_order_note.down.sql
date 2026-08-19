-- Rollback: Remove note column from orders table
ALTER TABLE orders DROP COLUMN IF EXISTS note;
