-- Migration: 000016_google_sheets_sync.up.sql
-- Purpose: Seed default Google Sheets bi-modal synchronization settings

INSERT INTO settings (key, value, updated_at) VALUES
    ('google_sheets_sync_enabled',          'false', NOW()),
    ('google_sheets_spreadsheet_id',        '',      NOW()),
    ('google_sheets_service_account_json',  '',      NOW()),
    ('google_sheets_auto_realtime_sync',    'true',  NOW()),
    ('google_sheets_last_synced_at',        '',      NOW()),
    ('google_sheets_last_sync_status',      'idle',  NOW()),
    ('google_sheets_last_sync_error',       '',      NOW())
ON CONFLICT (key) DO NOTHING;
