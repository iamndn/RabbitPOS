// Toast Unit Test Runner

const MAX_TOASTS = 3;
const DEDUPLICATION_WINDOW_MS = 2000;

function getDefaultDuration(type) {
  switch (type) {
    case 'success':
    case 'info':
      return 3500;
    case 'warning':
      return 5000;
    case 'error':
      return 7000;
    case 'loading':
      return 0;
    default:
      return 4000;
  }
}

class ToastManager {
  constructor() {
    this.toasts = [];
    this.activeTimers = new Map();
    this.recentToasts = new Map();
  }

  showToast(type, message, options = {}) {
    const now = Date.now();
    const dedupKey = `${type}:${message.trim()}`;

    const lastShown = this.recentToasts.get(dedupKey);
    if (lastShown && now - lastShown < DEDUPLICATION_WINDOW_MS) {
      return options.id || dedupKey;
    }
    this.recentToasts.set(dedupKey, now);

    const id = options.id || `toast_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = options.duration !== undefined ? options.duration : getDefaultDuration(type);
    const dismissible = options.dismissible !== undefined ? options.dismissible : true;

    const newToast = {
      id,
      type,
      title: options.title,
      message,
      duration,
      dismissible,
      action: options.action,
      createdAt: now,
    };

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.activeTimers.set(id, timer);
    }

    const filtered = this.toasts.filter((t) => t.id !== id);
    if (filtered.length >= MAX_TOASTS) {
      const removed = filtered.slice(0, filtered.length - MAX_TOASTS + 1);
      removed.forEach((r) => {
        const oldTimer = this.activeTimers.get(r.id);
        if (oldTimer) {
          clearTimeout(oldTimer);
          this.activeTimers.delete(r.id);
        }
      });
      this.toasts = [...filtered.slice(filtered.length - MAX_TOASTS + 1), newToast];
    } else {
      this.toasts = [...filtered, newToast];
    }

    return id;
  }

  dismiss(id) {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  clearAll() {
    this.activeTimers.forEach((timer) => clearTimeout(timer));
    this.activeTimers.clear();
    this.toasts = [];
  }
}

function runTests() {
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

  const manager = new ToastManager();

  // Test 1: Duration rules
  assert(getDefaultDuration('success') === 3500, 'Success duration is 3.5s');
  assert(getDefaultDuration('info') === 3500, 'Info duration is 3.5s');
  assert(getDefaultDuration('warning') === 5000, 'Warning duration is 5.0s');
  assert(getDefaultDuration('error') === 7000, 'Error duration is 7.0s');
  assert(getDefaultDuration('loading') === 0, 'Loading duration is persistent (0)');

  // Test 2: Add and Manual Dismiss
  const id1 = manager.showToast('success', 'Thao tác thành công');
  assert(manager.toasts.length === 1, 'Toast is added to queue');
  assert(manager.activeTimers.has(id1), 'Active timer created for success toast');
  manager.dismiss(id1);
  assert(manager.toasts.length === 0, 'Toast is removed on manual dismiss');
  assert(!manager.activeTimers.has(id1), 'Timer is cleaned up on manual dismiss');

  // Test 3: Queue Limit (Max 3)
  manager.clearAll();
  const t1 = manager.showToast('info', 'Thông báo 1');
  const t2 = manager.showToast('info', 'Thông báo 2');
  const t3 = manager.showToast('info', 'Thông báo 3');
  assert(manager.toasts.length === 3, 'Queue has 3 items');
  const t4 = manager.showToast('info', 'Thông báo 4');
  assert(manager.toasts.length === 3, 'Queue remains at max 3 items after 4th push');
  assert(manager.toasts[0].id === t2, 'Oldest toast t1 evicted');
  assert(manager.toasts[2].id === t4, 'Newest toast t4 added at end');
  assert(!manager.activeTimers.has(t1), 'Evicted toast t1 timer cleaned up');

  // Test 4: Deduplication (within 2s)
  manager.clearAll();
  manager.showToast('warning', 'Hết hàng');
  manager.showToast('warning', 'Hết hàng');
  assert(manager.toasts.length === 1, 'Duplicate toast within window is ignored');

  // Test 5: Loading persistent
  manager.clearAll();
  const loadId = manager.showToast('loading', 'Đang nạp...');
  assert(manager.toasts.length === 1, 'Loading toast added');
  assert(manager.toasts[0].duration === 0, 'Loading duration is 0');
  assert(!manager.activeTimers.has(loadId), 'No auto-dismiss timer for loading toast');
  manager.dismiss(loadId);
  assert(manager.toasts.length === 0, 'Loading toast dismissed');

  manager.clearAll();
  console.log(`\n🎉 All ${passed} Toast logic tests PASSED successfully!`);
}

runTests();
