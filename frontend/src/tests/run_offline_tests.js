// Offline PWA & Storage Unit Test Runner

const PUBLIC_STORE_SETTING_KEYS = new Set([
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

function sanitizeStoreSettingsForOffline(settings) {
  if (!settings) return {};
  const clean = {};
  for (const [k, v] of Object.entries(settings)) {
    if (PUBLIC_STORE_SETTING_KEYS.has(k)) {
      clean[k] = v;
    }
  }
  return clean;
}

class MockIndexedDBStorage {
  constructor() {
    this.stores = {
      catalog_products: new Map(),
      categories: new Map(),
      toppings: new Map(),
      promotions: new Map(),
      store_settings: new Map(),
      cart_state: new Map(),
      sync_metadata: new Map(),
      offline_orders: new Map(),
    };
  }

  saveCatalog({ products, categories, toppings = [], promotions = [], settings = {}, customTags }) {
    const now = Date.now();
    const cleanSettings = sanitizeStoreSettingsForOffline(settings);

    // Atomic write simulation
    this.stores.catalog_products.clear();
    for (const p of products || []) {
      this.stores.catalog_products.set(p.id, p);
    }

    this.stores.categories.clear();
    for (const c of categories || []) {
      this.stores.categories.set(c.id, c);
    }

    this.stores.toppings.clear();
    for (const t of toppings || []) {
      this.stores.toppings.set(t.id, t);
    }

    this.stores.promotions.clear();
    for (const pr of promotions || []) {
      this.stores.promotions.set(pr.id, pr);
    }

    this.stores.store_settings.clear();
    for (const [k, v] of Object.entries(cleanSettings)) {
      this.stores.store_settings.set(k, { key: k, value: v });
    }

    this.stores.sync_metadata.set('last_synced_at', { key: 'last_synced_at', value: now });
    this.stores.sync_metadata.set('catalog_version', { key: 'catalog_version', value: now });
    if (customTags) {
      this.stores.sync_metadata.set('custom_tags', { key: 'custom_tags', value: customTags });
    }

    return now;
  }

  loadCatalog() {
    const products = Array.from(this.stores.catalog_products.values());
    const categories = Array.from(this.stores.categories.values());
    const toppings = Array.from(this.stores.toppings.values());
    const promotions = Array.from(this.stores.promotions.values());
    const rawSettings = Array.from(this.stores.store_settings.values());
    const rawMeta = Array.from(this.stores.sync_metadata.values());

    if (products.length === 0 && categories.length === 0) {
      return null;
    }

    const settings = {};
    for (const s of rawSettings) {
      settings[s.key] = s.value;
    }

    let lastSyncedAt = null;
    let catalogVersion = 0;
    let customTags = undefined;

    for (const m of rawMeta) {
      if (m.key === 'last_synced_at') lastSyncedAt = m.value;
      if (m.key === 'catalog_version') catalogVersion = m.value;
      if (m.key === 'custom_tags') customTags = m.value;
    }

    return {
      products,
      categories,
      toppings,
      promotions,
      settings,
      customTags,
      lastSyncedAt,
      catalogVersion,
    };
  }

  saveCart(cartData) {
    this.stores.cart_state.set('active_cart', {
      key: 'active_cart',
      ...cartData,
      updatedAt: Date.now(),
    });
  }

  loadCart() {
    return this.stores.cart_state.get('active_cart') || null;
  }

  clearCart() {
    this.stores.cart_state.delete('active_cart');
  }
}

function runOfflineTests() {
  let passed = 0;

  function assert(condition, msg) {
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      process.exit(1);
    } else {
      passed++;
      console.log(`✅ PASS: ${msg}`);
    }
  }

  console.log('--- Running Offline PWA & IndexedDB Tests ---');

  // Test 1: Security Sanitizer strictly excludes secrets
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
    // SENSITIVE SECRETS
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    smtp_username: 'rabbitpos@gmail.com',
    smtp_password: 'super-secret-password-123',
    google_sheets_service_account_json: '{"private_key": "-----BEGIN RSA PRIVATE KEY-----"}',
    jwt_secret: 'top-secret-jwt-key',
    backup_encryption_key: 'backup-aes-key',
  };

  const clean = sanitizeStoreSettingsForOffline(rawSettings);
  assert(clean.store_name === 'Thỏ Juice & Coffee', 'Public store_name preserved');
  assert(clean.vietqr_account_no === '0123456789', 'Public VietQR account preserved');
  assert(clean.smtp_password === undefined, 'SMTP password strictly discarded');
  assert(clean.google_sheets_service_account_json === undefined, 'Google Private Key strictly discarded');
  assert(clean.jwt_secret === undefined, 'JWT secret strictly discarded');
  assert(clean.backup_encryption_key === undefined, 'Backup encryption key strictly discarded');
  assert(Object.keys(clean).length === 9, 'Only whitelisted public keys retained');

  // Test 2: Null / Empty safety
  assert(Object.keys(sanitizeStoreSettingsForOffline(null)).length === 0, 'Null settings handled safely');
  assert(Object.keys(sanitizeStoreSettingsForOffline(undefined)).length === 0, 'Undefined settings handled safely');

  // Test 3: IndexedDB Mock Save & Load Catalog
  const storage = new MockIndexedDBStorage();
  const mockProducts = [
    { id: 1, name: 'Cà phê đen', category_id: 1, is_active: true, variants: [{ id: 10, retail_price: 25000 }] },
    { id: 2, name: 'Trà đào cam sả', category_id: 2, is_active: true, variants: [{ id: 20, retail_price: 35000 }] },
  ];
  const mockCategories = [
    { id: 1, name: 'Cà phê', sort_order: 1 },
    { id: 2, name: 'Trà trái cây', sort_order: 2 },
  ];
  const mockToppings = [{ id: 101, name: 'Trân châu trắng', price: 5000, is_active: true }];
  const mockPromotions = [{ id: 501, name: 'Giảm 10%', discount_type: 'percent', discount_value: 10, is_active: true }];

  const syncedTimestamp = storage.saveCatalog({
    products: mockProducts,
    categories: mockCategories,
    toppings: mockToppings,
    promotions: mockPromotions,
    settings: rawSettings,
  });

  assert(typeof syncedTimestamp === 'number', 'Catalog saved with timestamp');

  // Load from storage
  const loaded = storage.loadCatalog();
  assert(loaded !== null, 'Loaded cached catalog');
  assert(loaded.products.length === 2, 'Loaded 2 products');
  assert(loaded.categories.length === 2, 'Loaded 2 categories');
  assert(loaded.toppings.length === 1, 'Loaded 1 topping');
  assert(loaded.promotions.length === 1, 'Loaded 1 promotion');
  assert(loaded.settings.store_name === 'Thỏ Juice & Coffee', 'Loaded sanitized store settings');
  assert(loaded.settings.smtp_password === undefined, 'No secrets in loaded settings');
  assert(loaded.lastSyncedAt === syncedTimestamp, 'Sync timestamp correctly matched');

  // Test 4: Empty Cache Handling
  const emptyStorage = new MockIndexedDBStorage();
  assert(emptyStorage.loadCatalog() === null, 'Empty storage returns null (triggers offline empty state)');

  // Test 5: Cart Persistence (Save, Restore, Clear)
  const mockCartItems = [
    { id: 'cart-1', product: mockProducts[0], selectedVariant: mockProducts[0].variants[0], quantity: 2, lineTotal: 50000 },
  ];
  storage.saveCart({
    items: mockCartItems,
    orderNote: 'Ít đường',
    discountAmount: 5000,
    selectedPromotion: null,
    promotionDiscount: 0,
    shippingFee: 0,
    platformFeeDiscount: 0,
    surcharge: 0,
  });

  const restoredCart = storage.loadCart();
  assert(restoredCart !== null, 'Restored cart from storage');
  assert(restoredCart.items.length === 1, 'Cart items restored');
  assert(restoredCart.orderNote === 'Ít đường', 'Order note restored');
  assert(restoredCart.discountAmount === 5000, 'Discount amount restored');

  storage.clearCart();
  assert(storage.loadCart() === null, 'Cart cleared after checkout');

  console.log(`\n🎉 All ${passed} Offline PWA & Storage tests PASSED successfully!`);
}

runOfflineTests();
