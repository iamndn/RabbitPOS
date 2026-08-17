-- ==============================================================================
-- Seed Script: catalog_seed.sql
-- Description: Initial catalog seed data for Tho Juice & Coffee (VND)
-- ==============================================================================

-- Insert Categories
INSERT INTO categories (id, name, display_order, is_active) VALUES
(1, 'Cà phê', 1, true),
(2, 'Nước ép tươi', 2, true),
(3, 'Trà & Trà sữa', 3, true)
ON CONFLICT (id) DO NOTHING;

-- Reset identity sequence if needed
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- Insert Products
INSERT INTO products (id, category_id, name, description, image_url, tag, is_active) VALUES
(1, 1, 'Cà phê Đen Đá', 'Cà phê Robusta Đắk Lắk pha phin truyền thống đậm đà', 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500', 'best_seller', true),
(2, 1, 'Cà phê Sữa Đá', 'Cà phê phin hòa quyện sữa đặc béo ngậy thơm ngon', 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500', 'best_seller', true),
(3, 1, 'Bạc Xỉu', 'Nhiều sữa ít cà phê ngọt dịu êm ái', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500', 'new', true),
(4, 2, 'Nước ép Cam Cà Rốt', '100% cam sành vắt tươi kết hợp cà rốt giàu vitamin A & C', 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500', 'best_seller', true),
(5, 2, 'Nước ép Táo Dứa', 'Táo xanh giòn ngọt thanh mát hòa quyện dứa tươi chua nhẹ', 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500', 'new', true),
(6, 2, 'Nước ép Ổi Hồng', 'Ổi hồng tươi thơm lừng, bổ sung vitamin tự nhiên mỗi ngày', 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500', 'best_seller', true),
(7, 3, 'Trà Sữa Trân Châu', 'Trà đen hảo hạng quyện sữa béo cùng trân châu dai giòn', 'https://images.unsplash.com/photo-1558857563-b371033873b8?w=500', 'best_seller', true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- Insert Product Variants (with COGS and Retail Prices in VND)
INSERT INTO product_variants (product_id, variant_name, cogs_price, retail_price, sku, is_active) VALUES
-- Cà phê Đen Đá
(1, 'Size M', 8000, 20000, 'CF-DEN-M', true),
(1, 'Size L', 10000, 25000, 'CF-DEN-L', true),

-- Cà phê Sữa Đá
(2, 'Size M', 10000, 25000, 'CF-SUA-M', true),
(2, 'Size L', 12000, 30000, 'CF-SUA-L', true),

-- Bạc Xỉu
(3, 'Size M', 11000, 29000, 'CF-BAC-M', true),
(3, 'Size L', 14000, 35000, 'CF-BAC-L', true),

-- Nước ép Cam Cà Rốt
(4, 'Size M (350ml)', 15000, 35000, 'NE-CAM-M', true),
(4, 'Size L (500ml)', 18000, 42000, 'NE-CAM-L', true),

-- Nước ép Táo Dứa
(5, 'Size M (350ml)', 16000, 39000, 'NE-TAO-M', true),
(5, 'Size L (500ml)', 20000, 46000, 'NE-TAO-L', true),

-- Nước ép Ổi Hồng
(6, 'Size M (350ml)', 14000, 35000, 'NE-OI-M', true),
(6, 'Size L (500ml)', 17000, 42000, 'NE-OI-L', true),

-- Trà Sữa Trân Châu
(7, 'Size M', 14000, 35000, 'TS-TC-M', true),
(7, 'Size L', 18000, 45000, 'TS-TC-L', true);

-- Insert Variant Groups
INSERT INTO variant_groups (product_id, group_name, selection_type, is_required) VALUES
(1, 'Kích thước', 'single', true),
(2, 'Kích thước', 'single', true),
(3, 'Kích thước', 'single', true),
(4, 'Kích thước', 'single', true),
(5, 'Kích thước', 'single', true),
(6, 'Kích thước', 'single', true),
(7, 'Kích thước', 'single', true);
