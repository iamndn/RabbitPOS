// Offline Order Queue & Conflict-Safe Sync Unit & Integration Test Runner

function calculateBackoffDelay(retryCount) {
  const base = 2000;
  const multiplier = 1.8;
  const maxDelay = 60000;
  const jitter = Math.random() * 1000;
  return Math.min(maxDelay, base * Math.pow(multiplier, Math.max(0, retryCount)) + jitter);
}

class MockSyncEngine {
  constructor(mockServer) {
    this.server = mockServer;
    this.queue = [];
    this.isLocked = false;
  }

  enqueue(order) {
    this.queue.push(order);
    this.queue.sort((a, b) => a.queued_at - b.queued_at); // FIFO sort
  }

  async sync(options = {}) {
    if (this.isLocked) {
      return { status: 'locked', syncedCount: 0, conflictCount: 0 };
    }

    this.isLocked = true;
    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    try {
      const now = Date.now();
      for (const order of this.queue) {
        if (order.status !== 'pending' && order.status !== 'failed') continue;

        // Exponential backoff check
        if (!options.force && order.retry_count > 0 && order.synced_at) {
          const delay = calculateBackoffDelay(order.retry_count);
          if (now - order.synced_at < delay) {
            continue;
          }
        }

        order.status = 'syncing';
        const res = await this.server.createOrder(order.payload, order.idempotency_key);

        if (res.status === 'success') {
          order.status = 'synced';
          order.server_order_id = res.data.id;
          order.server_order_code = res.data.order_code;
          order.synced_at = Date.now();
          order.last_error = null;
          syncedCount++;
        } else {
          const isConflict =
            res.error_code === 'ORDER_PRICE_CHANGED' ||
            res.error_code === 'ORDER_PROMOTION_INVALID' ||
            res.error_code === 'ORDER_ITEM_UNAVAILABLE';

          if (isConflict) {
            order.status = 'requires_review';
            order.error_code = res.error_code;
            order.last_error = res.message;
            order.synced_at = Date.now();
            conflictCount++;
          } else {
            order.status = 'failed';
            order.retry_count++;
            order.last_error = res.message;
            order.synced_at = Date.now();
            failedCount++;
          }
        }
      }
    } finally {
      this.isLocked = false;
    }

    return { status: 'completed', syncedCount, conflictCount, failedCount };
  }
}

class MockServer {
  constructor() {
    this.orders = [];
    this.idempotencyRecords = new Map();
    this.activeVariants = new Set([10, 20, 30]);
    this.variantPrices = new Map([
      [10, 25000],
      [20, 35000],
      [30, 45000],
    ]);
  }

  async createOrder(payload, idempotencyKey) {
    // Check idempotency cache
    if (this.idempotencyRecords.has(idempotencyKey)) {
      return {
        status: 'success',
        data: this.idempotencyRecords.get(idempotencyKey),
        message: 'Idempotency cached hit',
      };
    }

    // Check items availability
    for (const item of payload.items) {
      if (!this.activeVariants.has(item.product_variant_id)) {
        return {
          status: 'error',
          error_code: 'ORDER_ITEM_UNAVAILABLE',
          message: `Biến thể món ID ${item.product_variant_id} đã ngừng kinh doanh`,
        };
      }
    }

    // Check promotion
    if (payload.promotion_id === 999) {
      return {
        status: 'error',
        error_code: 'ORDER_PROMOTION_INVALID',
        message: 'Mã khuyến mãi đã hết hạn sử dụng',
      };
    }

    const orderId = this.orders.length + 1;
    const orderCode = `ORD-SERVER-${orderId}`;
    const orderRecord = {
      id: orderId,
      order_code: orderCode,
      subtotal: 50000,
      total_amount: 50000,
    };

    this.orders.push(orderRecord);
    this.idempotencyRecords.set(idempotencyKey, orderRecord);

    return {
      status: 'success',
      data: orderRecord,
      message: 'Order created successfully',
    };
  }
}

function runOfflineSyncTests() {
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

  console.log('--- Running Offline Order Queue & Conflict-Safe Sync Tests ---');

  // Test 1: Exponential Backoff math
  const b0 = calculateBackoffDelay(0);
  assert(b0 >= 2000 && b0 <= 3000, 'Backoff retry 0 between 2-3s');
  const b1 = calculateBackoffDelay(1);
  assert(b1 >= 3600 && b1 <= 4600, 'Backoff retry 1 between 3.6-4.6s');
  const b5 = calculateBackoffDelay(5);
  assert(b5 >= 37000 && b5 <= 40000, 'Backoff retry 5 between 37-40s');

  // Test 2: FIFO Ordering
  const server = new MockServer();
  const engine = new MockSyncEngine(server);

  const order1 = {
    offline_order_id: 'off-1',
    idempotency_key: 'idemp-1',
    queued_at: 1000,
    payload: { items: [{ product_variant_id: 10, quantity: 1 }], fund_id: 1 },
    display_snapshot: { order_code: 'OFF-001', final_total: 25000, is_offline_provisional: true },
    status: 'pending',
    retry_count: 0,
  };

  const order2 = {
    offline_order_id: 'off-2',
    idempotency_key: 'idemp-2',
    queued_at: 2000,
    payload: { items: [{ product_variant_id: 20, quantity: 1 }], fund_id: 1 },
    display_snapshot: { order_code: 'OFF-002', final_total: 35000, is_offline_provisional: true },
    status: 'pending',
    retry_count: 0,
  };

  // Enqueue in reverse order to verify FIFO sorting
  engine.enqueue(order2);
  engine.enqueue(order1);

  assert(engine.queue[0].offline_order_id === 'off-1', 'FIFO sorted: order1 first');
  assert(engine.queue[1].offline_order_id === 'off-2', 'FIFO sorted: order2 second');

  // Test 3: Successful Sync
  return (async () => {
    const res1 = await engine.sync({ force: true });
    assert(res1.syncedCount === 2, 'Both offline orders synced successfully');
    assert(order1.status === 'synced', 'Order1 marked as synced');
    assert(order2.status === 'synced', 'Order2 marked as synced');
    assert(order1.server_order_code === 'ORD-SERVER-1', 'Order1 received server order code');
    assert(order2.server_order_code === 'ORD-SERVER-2', 'Order2 received server order code');

    // Test 4: Idempotency Replay (Re-sync does not duplicate orders)
    const replayRes = await server.createOrder(order1.payload, order1.idempotency_key);
    assert(replayRes.status === 'success', 'Idempotent replay succeeds');
    assert(replayRes.data.order_code === 'ORD-SERVER-1', 'Replay returns identical existing order code');
    assert(server.orders.length === 2, 'No duplicate orders created on server');

    // Test 5: Conflict Routing to requires_review (Item Unavailable)
    const conflictOrder = {
      offline_order_id: 'off-3',
      idempotency_key: 'idemp-3',
      queued_at: 3000,
      payload: { items: [{ product_variant_id: 9999, quantity: 1 }], fund_id: 1 }, // Non-existent variant
      display_snapshot: { order_code: 'OFF-003', final_total: 50000, is_offline_provisional: true },
      status: 'pending',
      retry_count: 0,
    };

    engine.enqueue(conflictOrder);
    const resConflict = await engine.sync({ force: true });
    assert(resConflict.conflictCount === 1, 'Conflict detected for unavailable item');
    assert(conflictOrder.status === 'requires_review', 'Order transitioned to requires_review');
    assert(conflictOrder.error_code === 'ORDER_ITEM_UNAVAILABLE', 'Error code is ORDER_ITEM_UNAVAILABLE');
    assert(conflictOrder.display_snapshot.final_total === 50000, 'Original customer total preserved intact');

    // Test 6: Promotion Conflict (Expired Promo)
    const promoConflictOrder = {
      offline_order_id: 'off-4',
      idempotency_key: 'idemp-4',
      queued_at: 4000,
      payload: { items: [{ product_variant_id: 10, quantity: 1 }], promotion_id: 999, fund_id: 1 },
      display_snapshot: { order_code: 'OFF-004', final_total: 40000, is_offline_provisional: true },
      status: 'pending',
      retry_count: 0,
    };

    engine.enqueue(promoConflictOrder);
    const resPromo = await engine.sync({ force: true });
    assert(resPromo.conflictCount === 1, 'Conflict detected for expired promotion');
    assert(promoConflictOrder.status === 'requires_review', 'Promo conflict transitioned to requires_review');
    assert(promoConflictOrder.error_code === 'ORDER_PROMOTION_INVALID', 'Error code is ORDER_PROMOTION_INVALID');

    // Test 7: Lock Mutex (Multiple tabs concurrent sync prevention)
    engine.isLocked = true;
    const lockTest = await engine.sync();
    assert(lockTest.status === 'locked', 'Concurrency lock blocks simultaneous sync execution');

    console.log(`\n🎉 All ${passed} Offline Sync Engine & Conflict tests PASSED successfully!`);
  })();
}

runOfflineSyncTests();
