/**
 * Conflict-Safe Offline Order Synchronization Engine
 * Multi-Store Aware (Flushes pending offline orders across all accessible store DBs)
 * Features:
 * - FIFO processing per store
 * - Concurrency Lock (Web Locks API with Fallback Mutex)
 * - Exponential Backoff + Jitter
 * - Idempotency Replay handling with X-Store-ID header scoping
 * - Conflict detection & routing to `requires_review`
 */

import { fetchApi } from '../api';
import { getKnownStoreIds } from '../store';
import {
  getOfflineOrders,
  updateOfflineOrderStatus,
  OfflineOrder,
  OfflineQueueStats,
  getOfflineQueueStats,
} from './orders';

export interface SyncEngineResult {
  totalProcessed: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  errors: Array<{ offline_order_id: string; message: string; error_code?: string }>;
}

let isSyncInProgress = false;
let lastSyncTimestamp = 0;

/**
 * Calculate Exponential Backoff with Jitter in milliseconds
 */
export function calculateBackoffDelay(retryCount: number): number {
  const base = 2000; // 2 seconds base
  const multiplier = 1.8;
  const maxDelay = 60000; // 60 seconds max
  const jitter = Math.random() * 1000; // 0 - 1000ms jitter
  return Math.min(maxDelay, base * Math.pow(multiplier, Math.max(0, retryCount)) + jitter);
}

/**
 * Synchronize queued offline orders with the server across all accessible store DBs
 */
export async function syncOfflineOrders(options?: {
  force?: boolean;
  onProgress?: (processed: number, total: number) => void;
  onSuccessToast?: (count: number) => void;
  onConflictToast?: (orderCode: string, reason: string) => void;
}): Promise<SyncEngineResult> {
  // Check online status before attempting
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      totalProcessed: 0,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      errors: [{ offline_order_id: 'network', message: 'Thiết bị đang ngoại tuyến' }],
    };
  }

  // Use Web Locks API if available to prevent multiple tabs from syncing concurrently
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return navigator.locks.request(
      'rabbitpos_offline_sync_lock',
      { ifAvailable: true },
      async (lock) => {
        if (!lock) {
          console.log('[SyncEngine] Another tab is currently synchronizing offline orders.');
          return {
            totalProcessed: 0,
            syncedCount: 0,
            conflictCount: 0,
            failedCount: 0,
            errors: [{ offline_order_id: 'lock', message: 'Tiến trình đồng bộ đang chạy ở tab khác' }],
          };
        }
        return executeSyncLoop(options);
      }
    );
  }

  // Fallback in-memory mutex
  if (isSyncInProgress) {
    return {
      totalProcessed: 0,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      errors: [{ offline_order_id: 'busy', message: 'Tiến trình đồng bộ đang xử lý' }],
    };
  }

  return executeSyncLoop(options);
}

/**
 * Internal FIFO synchronization worker loop across all known store databases
 */
async function executeSyncLoop(options?: {
  force?: boolean;
  onProgress?: (processed: number, total: number) => void;
  onSuccessToast?: (count: number) => void;
  onConflictToast?: (orderCode: string, reason: string) => void;
}): Promise<SyncEngineResult> {
  isSyncInProgress = true;
  lastSyncTimestamp = Date.now();

  const result: SyncEngineResult = {
    totalProcessed: 0,
    syncedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const storeIds = getKnownStoreIds();
    let isNetworkDisconnected = false;

    for (const storeId of storeIds) {
      if (isNetworkDisconnected) break;

      // 1. Fetch pending and failed orders in FIFO order (queued_at ASC) for this store
      let queue: OfflineOrder[] = [];
      try {
        queue = await getOfflineOrders(['pending', 'failed'], storeId);
      } catch (err) {
        console.warn(`[SyncEngine] Could not read offline orders for store ${storeId}:`, err);
        continue;
      }

      if (queue.length === 0) {
        continue;
      }

      const now = Date.now();

      for (let i = 0; i < queue.length; i++) {
        const order = queue[i];
        const orderStoreId = order.store_id || storeId || 1;

        // Check exponential backoff unless force is requested
        if (!options?.force && order.retry_count > 0 && order.synced_at) {
          const requiredDelay = calculateBackoffDelay(order.retry_count);
          if (now - order.synced_at < requiredDelay) {
            // Skip this order for now, wait for backoff period to elapse
            continue;
          }
        }

        result.totalProcessed++;
        if (options?.onProgress) {
          options.onProgress(i + 1, queue.length);
        }

        // Mark order as syncing in this store DB
        await updateOfflineOrderStatus(order.offline_order_id, {
          status: 'syncing',
          last_error: null,
        }, orderStoreId);

        try {
          // Send order creation request to server with Idempotency-Key and X-Store-ID
          const res = await fetchApi<any>('/orders', {
            method: 'POST',
            headers: {
              'Idempotency-Key': order.idempotency_key,
              'X-Store-ID': String(orderStoreId),
            },
            body: JSON.stringify(order.payload),
          });

          if (res.status === 'success' && res.data) {
            // Order successfully accepted or replayed
            await updateOfflineOrderStatus(order.offline_order_id, {
              status: 'synced',
              server_order_id: res.data.id,
              server_order_code: res.data.order_code,
              synced_at: Date.now(),
              last_error: null,
              error_code: null,
            }, orderStoreId);
            result.syncedCount++;
          } else {
            // Business conflict or validation failure
            const errorCode = res.error_code || 'SYNC_ERROR';
            const isConflict =
              errorCode === 'ORDER_PRICE_CHANGED' ||
              errorCode === 'ORDER_PROMOTION_INVALID' ||
              errorCode === 'ORDER_ITEM_UNAVAILABLE' ||
              errorCode === 'ORDER_TOPPING_UNAVAILABLE' ||
              errorCode === 'ORDER_FUND_INVALID' ||
              errorCode === 'ORDER_IDEMPOTENT_CONFLICT' ||
              errorCode === 'AUTH_FORBIDDEN_ROLE';

            if (isConflict) {
              // Move to requires_review — never alter money or delete order silently
              await updateOfflineOrderStatus(order.offline_order_id, {
                status: 'requires_review',
                error_code: errorCode,
                last_error: res.message || 'Xung đột khi đồng bộ đơn hàng',
                synced_at: Date.now(),
              }, orderStoreId);
              result.conflictCount++;
              result.errors.push({
                offline_order_id: order.offline_order_id,
                message: res.message || 'Xung đột dữ liệu',
                error_code: errorCode,
              });

              if (options?.onConflictToast) {
                options.onConflictToast(order.display_snapshot.order_code, res.message || 'Xung đột đơn hàng');
              }
            } else {
              // Transient or generic server error -> Increment retry count
              await updateOfflineOrderStatus(order.offline_order_id, {
                status: 'failed',
                retry_count: order.retry_count + 1,
                error_code: errorCode,
                last_error: res.message || 'Lỗi xử lý đơn hàng từ máy chủ',
                synced_at: Date.now(),
              }, orderStoreId);
              result.failedCount++;
              result.errors.push({
                offline_order_id: order.offline_order_id,
                message: res.message || 'Lỗi máy chủ',
                error_code: errorCode,
              });
            }
          }
        } catch (networkErr: any) {
          // Network drop during sync -> increment retry and halt subsequent network attempts
          const errMsg = networkErr?.message || 'Mất kết nối mạng khi gửi đơn';
          await updateOfflineOrderStatus(order.offline_order_id, {
            status: 'failed',
            retry_count: order.retry_count + 1,
            last_error: errMsg,
            synced_at: Date.now(),
          }, orderStoreId);
          result.failedCount++;
          result.errors.push({
            offline_order_id: order.offline_order_id,
            message: errMsg,
          });

          // Break loops since network is disconnected
          isNetworkDisconnected = true;
          break;
        }
      }
    }

    if (result.syncedCount > 0 && options?.onSuccessToast) {
      options.onSuccessToast(result.syncedCount);
    }
  } finally {
    isSyncInProgress = false;
  }

  return result;
}
