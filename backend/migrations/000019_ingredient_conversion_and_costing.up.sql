-- 000019_ingredient_conversion_and_costing.up.sql
-- RabbitPOS: Unit Conversions, Loss Rate, Saved Specifications & Recipe Costing

-- 1. Upgrade `ingredients` table
ALTER TABLE ingredients 
    ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) NOT NULL DEFAULT 'ml',
    ADD COLUMN IF NOT EXISTS loss_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS default_purchase_unit VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS default_pack_qty DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    ADD COLUMN IF NOT EXISTS default_pack_unit VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS default_capacity_qty DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    ADD COLUMN IF NOT EXISTS default_capacity_unit VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS saved_conversions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill base_unit from existing unit if present
UPDATE ingredients SET base_unit = unit WHERE base_unit = 'ml' AND unit IS NOT NULL AND unit != '';

-- 2. Upgrade `purchase_items` table
ALTER TABLE purchase_items
    ADD COLUMN IF NOT EXISTS purchase_unit VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS purchase_quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS purchase_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS pack_qty DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    ADD COLUMN IF NOT EXISTS pack_unit VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS capacity_qty DECIMAL(10,3) NOT NULL DEFAULT 1.000,
    ADD COLUMN IF NOT EXISTS capacity_unit VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(15,4) NOT NULL DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS total_base_quantity DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS base_unit VARCHAR(20) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS base_unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS loss_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS effective_base_quantity DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS effective_base_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS conversion_spec VARCHAR(255) NOT NULL DEFAULT '';

-- Backfill legacy purchase_items
UPDATE purchase_items 
SET 
    purchase_quantity = quantity,
    purchase_unit_price = unit_price,
    total_base_quantity = quantity,
    base_unit_price = unit_price,
    effective_base_quantity = quantity,
    effective_base_price = unit_price
WHERE purchase_quantity = 0.000 AND quantity > 0;
