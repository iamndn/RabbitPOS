/**
 * Offline Order Queue Repository
 * Manages storage, status transitions, retrieval and lifecycle of offline orders in IndexedDB.
 */

import { getOfflineDB, STORES } from './db';

export type OfflineOrderStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'requires_review'
  | 'failed'
  | 'cancelled';

export interface OfflineOrderItemPayload {
  product_variant_id: number;
  quantity: number;
  topping_ids?: number[];
  notes?: string;
  price_override?: number;
}

export interface OfflineOrderPayload {
  idempotency_key: string;
  fund_id: number;
  promotion_id?: number;
  note?: string;
  manual_discount?: number;
  shipping_fee?: number;
  surcharge?: number;
  created_at?: string;
  items: OfflineOrderItemPayload[];
}

export interface OfflineOrderDisplaySnapshot {
  order_code: string;
  items: any[];
  subtotal: number;
  discount: number;
  promotion_discount: number;
  promotion_name?: string;
  shipping_fee: number;
  surcharge: number;
  total: number;
  final_total: number;
  payment_method: string;
  cashier_name: string;
  note?: string;
  is_offline_provisional: boolean;
}

export interface OfflineOrder {
  offline_order_id: string; // UUID primary key
  idempotency_key: string;   // Unique UUID for server idempotency
  device_id: string;
  catalog_version: number;
  created_at_device: string; // ISO string
  queued_at: number;        // Epoch ms for FIFO ordering
  payload: OfflineOrderPayload;
  display_snapshot: OfflineOrderDisplaySnapshot;
  status: OfflineOrderStatus;
  retry_count: number;
  last_error: string | null;
  error_code: string | null;
  server_order_id: number | null;
  server_order_code: string | null;
  synced_at: number | null;
}

export interface OfflineQueueStats {
  total: number;
  pending: number;
  syncing: number;
  requiresReview: number;
  synced: number;
  failed: number;
}

/**
 * Enqueue a new offline order in IndexedDB
 */
export async function enqueueOfflineOrder(order: OfflineOrder): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_ORDERS);
    const req = store.put(order);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get all offline orders, optionally filtered by status, sorted FIFO by queued_at
 */
export async function getOfflineOrders(statusFilter?: OfflineOrderStatus | OfflineOrderStatus[]): Promise<OfflineOrder[]> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_ORDERS);
    const req = store.getAll();

    req.onsuccess = () => {
      let orders = (req.result as OfflineOrder[]) || [];

      // Sort FIFO by queued_at ASC
      orders.sort((a, b) => a.queued_at - b.queued_at);

      if (statusFilter) {
        const filters = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        orders = orders.filter((o) => filters.includes(o.status));
      }

      resolve(orders);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Get a single offline order by ID
 */
export async function getOfflineOrderById(offlineOrderId: string): Promise<OfflineOrder | null> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readonly');
    const store = tx.objectStore(STORES.OFFLINE_ORDERS);
    const req = store.get(offlineOrderId);

    req.onsuccess = () => resolve((req.result as OfflineOrder) || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Update the status and fields of an existing offline order
 */
export async function updateOfflineOrderStatus(
  offlineOrderId: string,
  updates: Partial<Omit<OfflineOrder, 'offline_order_id' | 'idempotency_key'>>
): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_ORDERS);
    const getReq = store.get(offlineOrderId);

    getReq.onsuccess = () => {
      const existing = getReq.result as OfflineOrder | undefined;
      if (!existing) {
        reject(new Error(`Offline order ${offlineOrderId} not found`));
        return;
      }

      const merged: OfflineOrder = {
        ...existing,
        ...updates,
      };

      const putReq = store.put(merged);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };

    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete an offline order (e.g. after cancellation or user resolution)
 */
export async function deleteOfflineOrder(offlineOrderId: string): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OFFLINE_ORDERS, 'readwrite');
    const store = tx.objectStore(STORES.OFFLINE_ORDERS);
    const req = store.delete(offlineOrderId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get summary stats of offline order queue
 */
export async function getOfflineQueueStats(): Promise<OfflineQueueStats> {
  const orders = await getOfflineOrders();
  const stats: OfflineQueueStats = {
    total: orders.length,
    pending: 0,
    syncing: 0,
    requiresReview: 0,
    synced: 0,
    failed: 0,
  };

  for (const o of orders) {
    if (o.status === 'pending') stats.pending++;
    else if (o.status === 'syncing') stats.syncing++;
    else if (o.status === 'requires_review') stats.requiresReview++;
    else if (o.status === 'synced') stats.synced++;
    else if (o.status === 'failed') stats.failed++;
  }

  return stats;
}
