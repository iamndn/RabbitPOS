-- ==============================================================================
-- Seed File: users_seed.sql
-- Description: Default admin and staff user accounts for ThoPOS
-- Default Accounts:
--   1. admin / admin123 (Role: admin)
--   2. staff / staff123 (Role: staff)
-- ==============================================================================

INSERT INTO users (username, password_hash, role, is_active)
VALUES
    ('admin', '$2a$10$iM.Gv6f19tQ6Y9M04rQ/IeE1kQ3n4N5P6Q7R8S9T0U1V2W3X4Y5Z6', 'admin', true),
    ('staff', '$2a$10$iM.Gv6f19tQ6Y9M04rQ/IeE1kQ3n4N5P6Q7R8S9T0U1V2W3X4Y5Z6', 'staff', true)
ON CONFLICT (username) DO NOTHING;
