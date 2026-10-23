// Multi-Store Phase 3 Frontend Unit & Isolation Test Suite
// Verifies:
// 1. clientCache store namespacing & per-store invalidation
// 2. Per-store active cart isolation & legacy one-time migration
// 3. Decision F5: IndexedDB Store #1 legacy name preservation & Store #2 isolation
// 4. Offline order store_id tagging & multi-store sync with X-Store-ID header
// 5. Store resolution, role determination, and fallback hierarchy

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
};

// ── 1. clientCache Store Namespacing Test ────────────────────────────────────
console.log('\n--- 1. Testing clientCache Store Namespacing & Scoped Invalidation ---');

class MockClientCache {
  constructor() {
    this.cache = new Map();
  }

  buildKey(endpoint, storeId) {
    const isGlobal = ['/health', '/auth/me', '/stores'].some(
      (p) => endpoint === p || endpoint.startsWith(`${p}?`)
    );
    if (isGlobal || !storeId) {
      return endpoint;
    }
    return `s${storeId}:${endpoint}`;
  }

  set(endpoint, storeId, data, ttlMs = 30000) {
    const key = this.buildKey(endpoint, storeId);
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs, storeId });
  }

  get(endpoint, storeId) {
    const key = this.buildKey(endpoint, storeId);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(endpoint, storeId) {
    const key = this.buildKey(endpoint, storeId);
    this.cache.delete(key);
  }

  clearStore(storeId) {
    const prefix = `s${storeId}:`;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  clearAll() {
    this.cache.clear();
  }
}

const cache = new MockClientCache();

// Set Store 1 and Store 2 categories
cache.set('/categories', 1, [{ id: 1, name: 'Trà Sữa' }]);
cache.set('/categories', 2, [{ id: 2, name: 'Bánh Mì' }]);

// Global endpoint check
cache.set('/health', 1, { status: 'healthy' });
cache.set('/stores', 2, [{ id: 1 }, { id: 2 }]);

assert(cache.get('/categories', 1)[0].name === 'Trà Sữa', 'Store 1 cached categories retrieved cleanly');
assert(cache.get('/categories', 2)[0].name === 'Bánh Mì', 'Store 2 cached categories isolated from Store 1');
assert(cache.buildKey('/health', 1) === '/health', 'Global /health endpoint is not store-namespaced');
assert(cache.buildKey('/stores', 2) === '/stores', 'Global /stores endpoint is not store-namespaced');

// Clear only Store 1
cache.clearStore(1);
assert(cache.get('/categories', 1) === null, 'Store 1 cache cleared cleanly on store switch');
assert(cache.get('/categories', 2)[0].name === 'Bánh Mì', 'Store 2 cache preserved when Store 1 is invalidated');


// ── 2. Per-Store Cart Isolation & Legacy Migration Test ──────────────────────
console.log('\n--- 2. Testing Per-Store Active Cart Isolation & Legacy Migration ---');

class MockLocalStorage {
  constructor() {
    this.data = {};
  }
  getItem(k) {
    return this.data[k] || null;
  }
  setItem(k, v) {
    this.data[k] = String(v);
  }
  removeItem(k) {
    delete this.data[k];
  }
  clear() {
    this.data = {};
  }
}

const mockStorage = new MockLocalStorage();

// Simulate legacy cart in localStorage before migration
mockStorage.setItem('rabbitpos_active_cart', JSON.stringify({ cartItems: [{ id: 101, name: 'Cà phê muối' }] }));

// Execute one-time legacy cart migration
function runLegacyCartMigration(storage) {
  const legacy = storage.getItem('rabbitpos_active_cart');
  if (legacy) {
    if (!storage.getItem('rabbitpos_active_cart_1')) {
      storage.setItem('rabbitpos_active_cart_1', legacy);
    }
    storage.removeItem('rabbitpos_active_cart');
  }
}

runLegacyCartMigration(mockStorage);

assert(mockStorage.getItem('rabbitpos_active_cart') === null, 'Legacy rabbitpos_active_cart key was removed');
assert(
  JSON.parse(mockStorage.getItem('rabbitpos_active_cart_1')).cartItems[0].name === 'Cà phê muối',
  'Legacy cart successfully migrated to Store 1 key (rabbitpos_active_cart_1)'
);

// Simulate Store 2 cart addition
mockStorage.setItem('rabbitpos_active_cart_2', JSON.stringify({ cartItems: [{ id: 202, name: 'Bánh Croissant' }] }));

assert(
  JSON.parse(mockStorage.getItem('rabbitpos_active_cart_1')).cartItems.length === 1 &&
  JSON.parse(mockStorage.getItem('rabbitpos_active_cart_2')).cartItems.length === 1,
  'Store 1 and Store 2 maintain completely independent carts'
);

// Clear Store 1 cart on order completion
mockStorage.removeItem('rabbitpos_active_cart_1');
assert(mockStorage.getItem('rabbitpos_active_cart_1') === null, 'Store 1 cart cleared after checkout');
assert(mockStorage.getItem('rabbitpos_active_cart_2') !== null, 'Store 2 cart remains completely unaffected');


// ── 3. Decision F5: IndexedDB Store Isolation & Legacy Name Preservation ─────
console.log('\n--- 3. Testing Decision F5: IndexedDB Name Preservation & Multi-Store Isolation ---');

function getDbNameForStore(storeId = 1) {
  if (storeId <= 1) {
    return 'RabbitPOS_Offline_DB'; // Decision F5: Store #1 keeps exact legacy DB name
  }
  return `RabbitPOS_Offline_DB_s${storeId}`;
}

assert(getDbNameForStore(1) === 'RabbitPOS_Offline_DB', 'Store #1 preserves legacy database name RabbitPOS_Offline_DB');
assert(getDbNameForStore(undefined) === 'RabbitPOS_Offline_DB', 'Default store preserves legacy database name');
assert(getDbNameForStore(0) === 'RabbitPOS_Offline_DB', 'Store 0 falls back to legacy database name');
assert(getDbNameForStore(2) === 'RabbitPOS_Offline_DB_s2', 'Store #2 uses isolated database RabbitPOS_Offline_DB_s2');
assert(getDbNameForStore(3) === 'RabbitPOS_Offline_DB_s3', 'Store #3 uses isolated database RabbitPOS_Offline_DB_s3');
assert(getDbNameForStore(99) === 'RabbitPOS_Offline_DB_s99', 'Store #99 uses isolated database RabbitPOS_Offline_DB_s99');


// ── 4. Offline Order Store Tagging & Multi-Store Background Sync ─────────────
console.log('\n--- 4. Testing Offline Order Store Tagging & Sync Routing with X-Store-ID ---');

class MockStoreIndexedDB {
  constructor() {
    this.dbs = new Map();
  }

  getStoreDB(storeId) {
    const dbName = getDbNameForStore(storeId);
    if (!this.dbs.has(dbName)) {
      this.dbs.set(dbName, { orders: [] });
    }
    return this.dbs.get(dbName);
  }

  enqueue(order, storeId) {
    const targetStoreId = storeId || order.store_id || 1;
    order.store_id = targetStoreId;
    const db = this.getStoreDB(targetStoreId);
    db.orders.push(order);
  }

  getOrders(storeId) {
    const db = this.getStoreDB(storeId);
    return [...db.orders];
  }
}

const mockIdb = new MockStoreIndexedDB();

// Queue an order in Store #1
mockIdb.enqueue({
  offline_order_id: 'ord_offline_s1_001',
  idempotency_key: 'idem_s1_001',
  queued_at: Date.now(),
  status: 'pending',
  payload: { total: 45000, items: [] },
  display_snapshot: { order_code: 'OFF-001' },
}, 1);

// Queue an order in Store #2
mockIdb.enqueue({
  offline_order_id: 'ord_offline_s2_001',
  idempotency_key: 'idem_s2_001',
  queued_at: Date.now() + 10,
  status: 'pending',
  payload: { total: 95000, items: [] },
  display_snapshot: { order_code: 'OFF-002' },
}, 2);

const s1Orders = mockIdb.getOrders(1);
const s2Orders = mockIdb.getOrders(2);

assert(s1Orders.length === 1 && s1Orders[0].store_id === 1, 'Store #1 order tagged with store_id: 1 and saved in legacy DB');
assert(s2Orders.length === 1 && s2Orders[0].store_id === 2, 'Store #2 order tagged with store_id: 2 and saved in isolated DB s2');

// Simulate multi-store background sync engine flushing both DBs
const dispatchedServerRequests = [];

function mockSyncEngineFlush(knownStoreIds) {
  for (const storeId of knownStoreIds) {
    const queue = mockIdb.getOrders(storeId).filter(o => o.status === 'pending');
    for (const order of queue) {
      dispatchedServerRequests.push({
        url: '/orders',
        headers: {
          'Idempotency-Key': order.idempotency_key,
          'X-Store-ID': String(order.store_id),
        },
        payload: order.payload,
      });
      order.status = 'synced';
    }
  }
}

mockSyncEngineFlush([1, 2]);

assert(dispatchedServerRequests.length === 2, 'Both pending offline orders synced in single sync run');
assert(dispatchedServerRequests[0].headers['X-Store-ID'] === '1', 'Store #1 order sent with X-Store-ID: 1');
assert(dispatchedServerRequests[1].headers['X-Store-ID'] === '2', 'Store #2 order sent with X-Store-ID: 2');


// ── 5. Store Resolution & Role Determination Hierarchy ───────────────────────
console.log('\n--- 5. Testing Store Resolution & Role Determination Hierarchy ---');

function resolveActiveStore(persistedStoreId, accessibleStores, defaultStoreId, isSuperAdmin) {
  if (accessibleStores.length === 0) return null;

  // 1. If persisted ID is valid among accessible active stores
  if (persistedStoreId) {
    const found = accessibleStores.find(s => s.id === persistedStoreId && s.is_active);
    if (found) return found;
  }

  // 2. Fall back to default_store_id
  if (defaultStoreId) {
    const foundDefault = accessibleStores.find(s => s.id === defaultStoreId && s.is_active);
    if (foundDefault) return foundDefault;
  }

  // 3. Fall back to first active accessible store
  const firstActive = accessibleStores.find(s => s.is_active);
  if (firstActive) return firstActive;

  // 4. Fall back to first accessible store
  return accessibleStores[0];
}

const mockStores = [
  { id: 1, name: 'Thỏ Juice & Coffee', is_active: true },
  { id: 2, name: 'Thỏ Bakery', is_active: true },
  { id: 3, name: 'Thỏ Inactive Branch', is_active: false },
];

assert(
  resolveActiveStore(2, mockStores, 1, false).id === 2,
  'Valid persisted store ID resolves directly'
);
assert(
  resolveActiveStore(999, mockStores, 2, false).id === 2,
  'Inaccessible store ID falls back to default_store_id (Store #2)'
);
assert(
  resolveActiveStore(3, mockStores, 1, false).id === 1,
  'Inactive store ID falls back to active default_store_id'
);
assert(
  resolveActiveStore(null, mockStores, null, false).id === 1,
  'Missing persisted & default ID falls back to first active store'
);

console.log('\n🎉 All Multi-Store Phase 3 Frontend Unit & Isolation tests PASSED successfully!\n');
