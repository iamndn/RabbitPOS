/**
 * Offline Catalog & Cart Persistence Repository
 * Manages atomic caching of POS Menu, Categories, Toppings, Promotions,
 * Public Store Settings (strictly sanitized), Cart state, and Device Identity.
 */

import { getOfflineDB, STORES, idbGet, idbPut, StoreName } from './db';
import { Product } from '@/components/pos/VariantSelectorModal';
import { Promotion } from '@/types/promotion';
import { SettingsMap } from '@/lib/utils';
import { CustomTag } from '@/components/products/TagManagerModal';

export interface Category {
  id: number;
  name: string;
  image_url?: string;
  sort_order?: number;
  display_order?: number;
}

export interface Topping {
  id: number;
  name: string;
  price: number;
  is_active: boolean;
}

export interface OfflineCatalogData {
  products: Product[];
  categories: Category[];
  toppings: Topping[];
  promotions: Promotion[];
  settings: SettingsMap;
  customTags?: CustomTag[];
  lastSyncedAt: number | null;
  catalogVersion: number;
}

export interface StoredCartState {
  key: 'active_cart';
  items: any[];
  orderNote: string;
  discountAmount: number;
  selectedPromotion: Promotion | null;
  promotionDiscount: number;
  shippingFee: number;
  platformFeeDiscount: number;
  surcharge: number;
  updatedAt: number;
}

/**
 * Whitelist of safe public store settings allowed in Offline IndexedDB cache.
 * All sensitive settings (SMTP, Google Sheets private keys, Backup secrets) are strictly rejected.
 */
export const PUBLIC_STORE_SETTING_KEYS = new Set([
  'store_name',
  'store_address',
  'store_phone',
  'store_logo_url',
  'currency',
  'vietqr_bank_id',
  'vietqr_account_no',
  'vietqr_account_name',
  'auto_show_receipt_after_checkout',
]);

/**
 * Sanitize store settings object by discarding any sensitive keys
 */
export function sanitizeStoreSettingsForOffline(settings: SettingsMap | null | undefined): SettingsMap {
  if (!settings) return {};
  const clean: SettingsMap = {};
  for (const [k, v] of Object.entries(settings)) {
    if (PUBLIC_STORE_SETTING_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Atomically save the full catalog into IndexedDB in a single transaction
 */
export async function saveCatalogToOfflineCache(data: {
  products: Product[];
  categories: Category[];
  toppings?: Topping[];
  promotions?: Promotion[];
  settings?: SettingsMap | null;
  customTags?: CustomTag[];
  catalogVersion?: number;
}): Promise<number> {
  const db = await getOfflineDB();
  const now = Date.now();
  const version = data.catalogVersion || now;
  const cleanSettings = sanitizeStoreSettingsForOffline(data.settings);

  const txStores: StoreName[] = [
    STORES.CATALOG_PRODUCTS,
    STORES.CATEGORIES,
    STORES.TOPPINGS,
    STORES.PROMOTIONS,
    STORES.STORE_SETTINGS,
    STORES.SYNC_METADATA,
  ];

  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(txStores, 'readwrite');

    // 1. Products
    const prodStore = tx.objectStore(STORES.CATALOG_PRODUCTS);
    prodStore.clear();
    for (const p of data.products || []) {
      prodStore.put(p);
    }

    // 2. Categories
    const catStore = tx.objectStore(STORES.CATEGORIES);
    catStore.clear();
    for (const c of data.categories || []) {
      catStore.put(c);
    }

    // 3. Toppings
    const topStore = tx.objectStore(STORES.TOPPINGS);
    topStore.clear();
    for (const t of data.toppings || []) {
      topStore.put(t);
    }

    // 4. Promotions
    const promoStore = tx.objectStore(STORES.PROMOTIONS);
    promoStore.clear();
    for (const pr of data.promotions || []) {
      promoStore.put(pr);
    }

    // 5. Public Store Settings
    const setStore = tx.objectStore(STORES.STORE_SETTINGS);
    setStore.clear();
    for (const [k, v] of Object.entries(cleanSettings)) {
      setStore.put({ key: k, value: v });
    }

    // 6. Sync Metadata
    const metaStore = tx.objectStore(STORES.SYNC_METADATA);
    metaStore.put({ key: 'last_synced_at', value: now });
    metaStore.put({ key: 'catalog_version', value: version });
    if (data.customTags) {
      metaStore.put({ key: 'custom_tags', value: data.customTags });
    }

    tx.oncomplete = () => {
      resolve(now);
    };

    tx.onerror = () => {
      reject(tx.error);
    };

    tx.onabort = () => {
      reject(new Error('Transaction aborted while saving offline catalog'));
    };
  });
}

/**
 * Load the complete catalog from IndexedDB
 */
export async function loadCatalogFromOfflineCache(): Promise<OfflineCatalogData | null> {
  const db = await getOfflineDB();

  const txStores: StoreName[] = [
    STORES.CATALOG_PRODUCTS,
    STORES.CATEGORIES,
    STORES.TOPPINGS,
    STORES.PROMOTIONS,
    STORES.STORE_SETTINGS,
    STORES.SYNC_METADATA,
  ];

  return new Promise<OfflineCatalogData | null>((resolve, reject) => {
    const tx = db.transaction(txStores, 'readonly');

    const prodReq = tx.objectStore(STORES.CATALOG_PRODUCTS).getAll();
    const catReq = tx.objectStore(STORES.CATEGORIES).getAll();
    const topReq = tx.objectStore(STORES.TOPPINGS).getAll();
    const promoReq = tx.objectStore(STORES.PROMOTIONS).getAll();
    const setReq = tx.objectStore(STORES.STORE_SETTINGS).getAll();
    const metaReq = tx.objectStore(STORES.SYNC_METADATA).getAll();

    tx.oncomplete = () => {
      const products = (prodReq.result as Product[]) || [];
      const categories = (catReq.result as Category[]) || [];
      const toppings = (topReq.result as Topping[]) || [];
      const promotions = (promoReq.result as Promotion[]) || [];
      const rawSettings = (setReq.result as Array<{ key: string; value: string }>) || [];
      const rawMeta = (metaReq.result as Array<{ key: string; value: any }>) || [];

      // If no products and categories found in cache, return null
      if (products.length === 0 && categories.length === 0) {
        resolve(null);
        return;
      }

      const settings: SettingsMap = {};
      for (const item of rawSettings) {
        settings[item.key] = item.value;
      }

      let lastSyncedAt: number | null = null;
      let catalogVersion = 0;
      let customTags: CustomTag[] | undefined;

      for (const m of rawMeta) {
        if (m.key === 'last_synced_at') lastSyncedAt = m.value;
        if (m.key === 'catalog_version') catalogVersion = m.value;
        if (m.key === 'custom_tags') customTags = m.value;
      }

      resolve({
        products,
        categories,
        toppings,
        promotions,
        settings,
        customTags,
        lastSyncedAt,
        catalogVersion,
      });
    };

    tx.onerror = () => {
      reject(tx.error);
    };
  });
}

/**
 * Save active POS cart into IndexedDB
 */
export async function saveCartToOfflineCache(cart: Omit<StoredCartState, 'key' | 'updatedAt'>): Promise<void> {
  const fullCart: StoredCartState = {
    key: 'active_cart',
    ...cart,
    updatedAt: Date.now(),
  };
  await idbPut(STORES.CART_STATE, fullCart);
}

/**
 * Load active POS cart from IndexedDB
 */
export async function loadCartFromOfflineCache(): Promise<StoredCartState | null> {
  return idbGet<StoredCartState>(STORES.CART_STATE, 'active_cart');
}

/**
 * Clear saved POS cart from IndexedDB
 */
export async function clearCartFromOfflineCache(): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CART_STATE, 'readwrite');
    const store = tx.objectStore(STORES.CART_STATE);
    const req = store.delete('active_cart');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get or generate persistent Device ID
 */
export async function getDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return 'server_ssr_device';

  // 1. Try localStorage first
  const localId = localStorage.getItem('rabbitpos_device_id');
  if (localId && localId.trim() !== '') {
    return localId;
  }

  // 2. Try IndexedDB
  try {
    const record = await idbGet<{ key: string; value: string }>(STORES.SYNC_METADATA, 'device_id');
    if (record?.value) {
      localStorage.setItem('rabbitpos_device_id', record.value);
      return record.value;
    }
  } catch (e) {
    // Ignore IDB read error
  }

  // 3. Generate new UUID v4
  const newDeviceId = 'dev_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  localStorage.setItem('rabbitpos_device_id', newDeviceId);
  try {
    await idbPut(STORES.SYNC_METADATA, { key: 'device_id', value: newDeviceId });
  } catch (e) {
    // Ignore IDB write error
  }

  return newDeviceId;
}
