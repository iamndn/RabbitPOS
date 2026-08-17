-- ==============================================================================
-- Seed Script: funds_seed.sql
-- Description: Initial payment funds seed data for Tho POS
-- ==============================================================================

INSERT INTO funds (id, name, fund_type, current_balance, is_active) VALUES
(1, 'Tiền mặt tại quầy', 'cash', 0.00, true),
(2, 'Chuyển khoản VietQR', 'bank', 0.00, true)
ON CONFLICT (id) DO NOTHING;

SELECT setval('funds_id_seq', (SELECT MAX(id) FROM funds));
