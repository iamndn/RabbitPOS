-- ==============================================================================
-- Seed Script: settings_seed.sql
-- Description: Initial system settings for Tho Juice & Coffee
-- ==============================================================================

INSERT INTO settings (key, value, updated_at) VALUES
('store_name', 'Thỏ Juice & Coffee', NOW()),
('store_address', '123 Vo Van Kiet, D1, HCMC', NOW()),
('store_phone', '0901234567', NOW()),
('currency_code', 'VND', NOW()),
('currency_symbol', 'đ', NOW()),
('currency_position', 'suffix', NOW()),
('vietqr_bank_id', 'MB', NOW()),
('vietqr_account_no', '123456789', NOW()),
('vietqr_account_name', 'THO JUICE AND COFFEE', NOW())
ON CONFLICT (key) DO NOTHING;
