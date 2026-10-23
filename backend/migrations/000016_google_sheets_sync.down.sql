-- Migration: 000016_google_sheets_sync.down.sql
-- Purpose: Rollback Google Sheets sync settings seeds

DELETE FROM settings WHERE key IN (
    'google_sheets_sync_enabled',
    'google_sheets_spreadsheet_id',
    'google_sheets_service_account_json',
    'google_sheets_auto_realtime_sync',
    'google_sheets_last_synced_at',
    'google_sheets_last_sync_status',
    'google_sheets_last_sync_error'
);
