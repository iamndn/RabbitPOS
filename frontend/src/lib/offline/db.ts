/**
 * IndexedDB Database Wrapper for RabbitPOS Offline PWA Engine
 * Manages schema creation, versioning, migrations, and atomic transactions.
 */

export const DB_NAME = 'RabbitPOS_Offline_DB';
export const DB_VERSION = 1;

export const STORES = {
  CATALOG_PRODUCTS: 'catalog_products',
  CATEGORIES: 'categories',
  TOPPINGS: 'toppings',
  PROMOTIONS: 'promotions',
  STORE_SETTINGS: 'store_settings',
  CART_STATE: 'cart_state',
  SYNC_METADATA: 'sync_metadata',
  OFFLINE_ORDERS: 'offline_orders', // Placeholder for Phase 6
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or upgrade the IndexedDB database
 */
export function getOfflineDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // Version 1: Initial Schema
      if (oldVersion < 1) {
        // 1. Catalog Products Store
        if (!db.objectStoreNames.contains(STORES.CATALOG_PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.CATALOG_PRODUCTS, { keyPath: 'id' });
          productStore.createIndex('category_id', 'category_id', { unique: false });
          productStore.createIndex('tag', 'tag', { unique: false });
          productStore.createIndex('is_active', 'is_active', { unique: false });
        }

        // 2. Categories Store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          const categoryStore = db.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
          categoryStore.createIndex('sort_order', 'sort_order', { unique: false });
        }

        // 3. Toppings Store
        if (!db.objectStoreNames.contains(STORES.TOPPINGS)) {
          const toppingStore = db.createObjectStore(STORES.TOPPINGS, { keyPath: 'id' });
          toppingStore.createIndex('is_active', 'is_active', { unique: false });
        }

        // 4. Promotions Store
        if (!db.objectStoreNames.contains(STORES.PROMOTIONS)) {
          const promoStore = db.createObjectStore(STORES.PROMOTIONS, { keyPath: 'id' });
          promoStore.createIndex('is_active', 'is_active', { unique: false });
        }

        // 5. Store Settings Store (key/value)
        if (!db.objectStoreNames.contains(STORES.STORE_SETTINGS)) {
          db.createObjectStore(STORES.STORE_SETTINGS, { keyPath: 'key' });
        }

        // 6. Cart State Store
        if (!db.objectStoreNames.contains(STORES.CART_STATE)) {
          db.createObjectStore(STORES.CART_STATE, { keyPath: 'key' });
        }

        // 7. Sync Metadata Store
        if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
          db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
        }

        // 8. Offline Orders Queue (Placeholder for Phase 6)
        if (!db.objectStoreNames.contains(STORES.OFFLINE_ORDERS)) {
          const orderStore = db.createObjectStore(STORES.OFFLINE_ORDERS, { keyPath: 'local_id' });
          orderStore.createIndex('created_at', 'created_at', { unique: false });
          orderStore.createIndex('sync_status', 'sync_status', { unique: false });
        }
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('[IndexedDB] Database upgrade blocked by another tab.');
    };
  });

  return dbPromise;
}

/**
 * Generic Promise wrapper to get all items from an ObjectStore
 */
export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic Promise wrapper to get a single item by key
 */
export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic Promise wrapper to put a single item
 */
export async function idbPut<T>(storeName: StoreName, value: T): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear a store and replace all items in a single transaction
 */
export async function idbReplaceAll<T>(storeName: StoreName, items: T[]): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    store.clear();
    for (const item of items) {
      store.put(item);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(`Transaction aborted on store ${storeName}`));
  });
}

/**
 * Delete a single item by key
 */
export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  const db = await getOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Reset/Clear entire IndexedDB for testing or recovery
 */
export async function idbClearAllStores(): Promise<void> {
  const db = await getOfflineDB();
  const storeNames = Object.values(STORES);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
