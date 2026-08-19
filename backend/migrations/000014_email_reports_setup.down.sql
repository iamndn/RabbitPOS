-- Migration: 000014_email_reports_setup.down.sql
-- Purpose: Rollback — remove email column from users and remove seeded SMTP settings

-- Remove SMTP and email report settings seeds
DELETE FROM settings WHERE key IN (
    'smtp_host',
    'smtp_port',
    'smtp_user',
    'smtp_password',
    'smtp_from_email',
    'smtp_from_name',
    'report_recipient_emails',
    'enable_daily_email_report',
    'daily_report_time'
);

-- Drop email column from users
ALTER TABLE users DROP COLUMN IF EXISTS email;
