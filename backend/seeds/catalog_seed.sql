-- ==============================================================================
-- Seed Script: catalog_seed.sql
-- Description: Initial catalog seed data for Tho Juice & Coffee
-- ==============================================================================

-- Insert Categories
INSERT INTO categories (id, name, display_order, is_active) VALUES
(1, 'Coffee', 1, true),
(2, 'Fruit Juices', 2, true),
(3, 'Tea & Milk Tea', 3, true)
ON CONFLICT (id) DO NOTHING;

-- Reset identity sequence if needed
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Insert Products
INSERT INTO products (id, category_id, name, description, image_url, tag, is_active) VALUES
(1, 1, 'Espresso', 'Rich and bold single origin dark roast espresso', 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500', 'best_seller', true),
(2, 2, 'Orange Juice', '100% pure freshly squeezed navel orange juice', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 'best_seller', true),
(3, 2, 'Avocado Smoothie', 'Creamy fresh avocado blended with condensed milk', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500', 'new', true),
(4, 3, 'Milk Tea Boba', 'Classic black milk tea with chewy tapioca pearls', 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=500', 'best_seller', true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Insert Product Variants (with COGS and Retail Prices)
INSERT INTO product_variants (product_id, variant_name, cogs_price, retail_price, sku, is_active) VALUES
-- Espresso
(1, 'Size M (Single Shot)', 0.80, 2.50, 'COF-ESP-M', true),
(1, 'Size L (Double Shot)', 1.10, 3.20, 'COF-ESP-L', true),

-- Orange Juice
(2, 'Size M (350ml)', 1.00, 3.00, 'JUC-ORG-M', true),
(2, 'Size L (500ml)', 1.40, 4.00, 'JUC-ORG-L', true),

-- Avocado Smoothie
(3, 'Size M (350ml)', 1.50, 4.00, 'JUC-AVO-M', true),
(3, 'Size L (500ml)', 2.00, 5.00, 'JUC-AVO-L', true),

-- Milk Tea Boba
(4, 'Regular (Size M)', 1.20, 3.50, 'TEA-BOB-REG', true),
(4, 'Large w/ Cream Cheese', 1.80, 4.80, 'TEA-BOB-LRG', true);

-- Insert Variant Groups
INSERT INTO variant_groups (product_id, group_name, selection_type, is_required) VALUES
(1, 'Size', 'single', true),
(2, 'Size', 'single', true),
(3, 'Size', 'single', true),
(4, 'Toppings', 'multiple', false);
