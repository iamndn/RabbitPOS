-- Migration: 000014_email_reports_setup.up.sql
-- Purpose: Add email column to users table and seed SMTP/email report settings

-- Add email column to users if not already present
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150) NOT NULL DEFAULT '';

-- Seed email addresses for the 3 default admin accounts
UPDATE users SET email = 'nhanhdn.jfw@gmail.com'          WHERE username = 'NDN';
UPDATE users SET email = 'candynhung754@gmail.com'         WHERE username = 'NHUNG';
UPDATE users SET email = '150498tranquangdat@gmail.com'    WHERE username = 'DAT';

-- Seed SMTP and email report configuration into the settings table
-- Uses ON CONFLICT DO NOTHING so existing user-configured values are preserved
INSERT INTO settings (key, value, updated_at) VALUES
    ('smtp_host',                 'smtp.gmail.com',                                                                        NOW()),
    ('smtp_port',                 '587',                                                                                    NOW()),
    ('smtp_user',                 '',                                                                                       NOW()),
    ('smtp_password',             '',                                                                                       NOW()),
    ('smtp_from_email',           'rabbitpos@ndnworks.com',                                                                 NOW()),
    ('smtp_from_name',            'Thỏ Juice & Coffee - RabbitPOS',                                                        NOW()),
    ('report_recipient_emails',   'nhanhdn.jfw@gmail.com,candynhung754@gmail.com,150498tranquangdat@gmail.com',            NOW()),
    ('enable_daily_email_report', 'true',                                                                                   NOW()),
    ('daily_report_time',         '22:30',                                                                                  NOW())
ON CONFLICT (key) DO NOTHING;
