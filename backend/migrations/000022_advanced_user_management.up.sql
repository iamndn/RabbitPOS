-- 000022_advanced_user_management.up.sql
-- Phase 8: Advanced Multi-Tier User Management & Role-Based Access Control (RBAC)

-- 1. Update users table: full_name, phone, pin_code, is_active
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_code VARCHAR(60) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Migrate legacy 'admin' to 'master'
UPDATE users SET role = 'master' WHERE role = 'admin' OR role = 'super_admin';

-- 3. Create or enhance audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    store_id BIGINT REFERENCES stores(id) ON DELETE SET NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_id BIGINT,
    actor_username VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT '',
    action VARCHAR(100) NOT NULL,
    target_resource VARCHAR(100) NOT NULL DEFAULT '',
    resource VARCHAR(100) NOT NULL DEFAULT '',
    target_id BIGINT,
    resource_id VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'success',
    ip_address VARCHAR(45) DEFAULT '',
    user_agent VARCHAR(255) DEFAULT '',
    details JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
