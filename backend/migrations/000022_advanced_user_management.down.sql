-- 000022_advanced_user_management.down.sql
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
ALTER TABLE users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP COLUMN IF EXISTS pin_code;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
DROP TABLE IF EXISTS audit_logs CASCADE;

