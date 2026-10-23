-- 000019_ingredient_conversion_and_costing.down.sql

ALTER TABLE purchase_items
    DROP COLUMN IF EXISTS purchase_unit,
    DROP COLUMN IF EXISTS purchase_quantity,
    DROP COLUMN IF EXISTS purchase_unit_price,
    DROP COLUMN IF EXISTS pack_qty,
    DROP COLUMN IF EXISTS pack_unit,
    DROP COLUMN IF EXISTS capacity_qty,
    DROP COLUMN IF EXISTS capacity_unit,
    DROP COLUMN IF EXISTS conversion_rate,
    DROP COLUMN IF EXISTS total_base_quantity,
    DROP COLUMN IF EXISTS base_unit,
    DROP COLUMN IF EXISTS base_unit_price,
    DROP COLUMN IF EXISTS loss_rate,
    DROP COLUMN IF EXISTS effective_base_quantity,
    DROP COLUMN IF EXISTS effective_base_price,
    DROP COLUMN IF EXISTS conversion_spec;

ALTER TABLE ingredients
    DROP COLUMN IF EXISTS base_unit,
    DROP COLUMN IF EXISTS loss_rate,
    DROP COLUMN IF EXISTS default_purchase_unit,
    DROP COLUMN IF EXISTS default_pack_qty,
    DROP COLUMN IF EXISTS default_pack_unit,
    DROP COLUMN IF EXISTS default_capacity_qty,
    DROP COLUMN IF EXISTS default_capacity_unit,
    DROP COLUMN IF EXISTS saved_conversions;
