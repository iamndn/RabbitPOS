-- ==============================================================================
-- Seed File: users_seed.sql
-- Description: Official staff/cashier user accounts for RabbitPOS
-- ==============================================================================

INSERT INTO users (username, password_hash, role, is_active, needs_password_setup)
VALUES
    ('NDN', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true),
    ('NHUNG', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true),
    ('DAT', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', true, true)
ON CONFLICT (username) DO NOTHING;

