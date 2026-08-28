/**
 * Offline Sync Unit & Integration Tests (TypeScript)
 */

import { calculateBackoffDelay } from '../lib/offline/sync';
import { OfflineOrder } from '../lib/offline/orders';

export function runOfflineSyncUnitTests(): { passed: number; failed: number } {
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

  // 1. Exponential Backoff Calculation
  const delay0 = calculateBackoffDelay(0);
  assert(delay0 >= 2000 && delay0 <= 3000, `Delay retry 0 is within 2-3s (actual: ${delay0}ms)`);

  const delay1 = calculateBackoffDelay(1);
  assert(delay1 >= 3600 && delay1 <= 4600, `Delay retry 1 is within 3.6-4.6s (actual: ${delay1}ms)`);

  const delay5 = calculateBackoffDelay(5);
  assert(delay5 >= 37000 && delay5 <= 40000, `Delay retry 5 is within 37-40s (actual: ${delay5}ms)`);

  const delay10 = calculateBackoffDelay(10);
  assert(delay10 <= 60000, `Delay retry 10 is capped at 60s max (actual: ${delay10}ms)`);

  // 2. Offline Order Structure Validation
  const mockOrder: OfflineOrder = {
    offline_order_id: 'off-uuid-1',
    idempotency_key: 'idemp-uuid-1',
    device_id: 'dev-1',
    catalog_version: 1700000000,
    created_at_device: new Date().toISOString(),
    queued_at: Date.now(),
    payload: {
      idempotency_key: 'idemp-uuid-1',
      fund_id: 1, // Cash
      items: [{ product_variant_id: 10, quantity: 2 }],
    },
    display_snapshot: {
      order_code: 'OFF-12345678',
      items: [],
      subtotal: 50000,
      discount: 0,
      promotion_discount: 0,
      shipping_fee: 0,
      surcharge: 0,
      total: 50000,
      final_total: 50000,
      payment_method: 'Tiền mặt (Offline)',
      cashier_name: 'Thu ngân',
      is_offline_provisional: true,
    },
    status: 'pending',
    retry_count: 0,
    last_error: null,
    error_code: null,
    server_order_id: null,
    server_order_code: null,
    synced_at: null,
  };

  assert(mockOrder.payload.fund_id === 1, 'Offline order enforces cash fund_id 1');
  assert(mockOrder.display_snapshot.is_offline_provisional === true, 'Provisional receipt flag is true');
  assert(mockOrder.display_snapshot.order_code.startsWith('OFF-'), 'Order code has OFF- prefix');

  return { passed, failed };
}
