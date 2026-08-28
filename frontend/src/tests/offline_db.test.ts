/**
 * Unit Test Suite for Offline IndexedDB and Repository Logic
 */

import {
  sanitizeStoreSettingsForOffline,
} from '../lib/offline/catalog';

export function runOfflineDbUnitTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      passed++;
      console.log(`✅ PASS: ${msg}`);
    }
  }

  // Test 1: Sanitizer whitelist allows only public store settings
  const rawSettings = {
    store_name: 'Thỏ Juice & Coffee',
    store_address: '123 Đường ABC, Q1',
    store_phone: '0901234567',
    store_logo_url: '/logo.png',
    currency: 'VND',
    vietqr_bank_id: '970422',
    vietqr_account_no: '0123456789',
    vietqr_account_name: 'NGUYEN VAN A',
    auto_show_receipt_after_checkout: 'true',
    // SENSITIVE KEYS - MUST BE STRIPPED
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_username: 'rabbitpos@gmail.com',
    smtp_password: 'super-secret-password-123',
    google_sheets_service_account_json: '{"private_key": "-----BEGIN RSA PRIVATE KEY-----"}',
    jwt_secret: 'top-secret-jwt-key',
    backup_encryption_key: 'backup-aes-key',
  };

  const clean = sanitizeStoreSettingsForOffline(rawSettings);

  assert(clean.store_name === 'Thỏ Juice & Coffee', 'store_name is preserved');
  assert(clean.store_address === '123 Đường ABC, Q1', 'store_address is preserved');
  assert(clean.currency === 'VND', 'currency is preserved');
  assert(clean.vietqr_account_no === '0123456789', 'vietqr_account_no is preserved');

  assert(clean.smtp_password === undefined, 'smtp_password is stripped');
  assert(clean.smtp_host === undefined, 'smtp_host is stripped');
  assert(clean.smtp_username === undefined, 'smtp_username is stripped');
  assert(clean.google_sheets_service_account_json === undefined, 'google_sheets_service_account_json is stripped');
  assert(clean.jwt_secret === undefined, 'jwt_secret is stripped');
  assert(clean.backup_encryption_key === undefined, 'backup_encryption_key is stripped');

  assert(Object.keys(clean).length === 9, 'Only 9 public keys are retained');

  // Test 2: Sanitizer handles null and undefined safely
  assert(Object.keys(sanitizeStoreSettingsForOffline(null)).length === 0, 'Null settings return empty object');
  assert(Object.keys(sanitizeStoreSettingsForOffline(undefined)).length === 0, 'Undefined settings return empty object');
  assert(Object.keys(sanitizeStoreSettingsForOffline({})).length === 0, 'Empty settings return empty object');

  return { passed, failed };
}
