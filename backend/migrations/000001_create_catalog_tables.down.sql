-- ==============================================================================
-- Migration: 000001_create_catalog_tables.down.sql
-- Description: Drop Catalog domain tables
-- ==============================================================================

DROP TABLE IF EXISTS variant_groups;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
