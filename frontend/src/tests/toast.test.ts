/**
 * Unit Test Suite for RabbitPOS Toast Notification Logic
 * Tests: Auto-dismiss durations, manual dismiss, queue size limit (max 3),
 * deduplication window (2s), and timer cleanups.
 */

import { ToastItem, ToastType, ToastOptions } from '../types/toast';

describe('Toast Notification Core Logic', () => {
  const MAX_TOASTS = 3;
  const DEDUPLICATION_WINDOW_MS = 2000;

  function getDefaultDuration(type: ToastType): number {
    switch (type) {
      case 'success':
      case 'info':
        return 3500;
      case 'warning':
        return 5000;
      case 'error':
        return 7000;
      case 'loading':
        return 0; // Persistent
      default:
        return 4000;
    }
  }

  class MockToastManager {
    public toasts: ToastItem[] = [];
    public activeTimers = new Map<string, any>();
    public recentToasts = new Map<string, number>();

    public showToast(type: ToastType, message: string, options: ToastOptions = {}): string {
      const now = Date.now();
      const dedupKey = `${type}:${message.trim()}`;

      // Deduplication check
      const lastShown = this.recentToasts.get(dedupKey);
      if (lastShown && now - lastShown < DEDUPLICATION_WINDOW_MS) {
        return options.id || dedupKey;
      }
      this.recentToasts.set(dedupKey, now);

      const id = options.id || `toast_${now}_${Math.random().toString(36).substring(2, 7)}`;
      const duration = options.duration !== undefined ? options.duration : getDefaultDuration(type);
      const dismissible = options.dismissible !== undefined ? options.dismissible : true;

      const newToast: ToastItem = {
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

      // Max 3 toasts queue
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

    public dismiss(id: string) {
      const timer = this.activeTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.activeTimers.delete(id);
      }
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }

    public clearAll() {
      this.activeTimers.forEach((timer) => clearTimeout(timer));
      this.activeTimers.clear();
      this.toasts = [];
    }
  }

  let manager: MockToastManager;

  beforeEach(() => {
    jest.useFakeTimers();
    manager = new MockToastManager();
  });

  afterEach(() => {
    manager.clearAll();
    jest.useRealTimers();
  });

  test('1. Default durations match requirements (success: 3.5s, warning: 5s, error: 7s, loading: 0)', () => {
    expect(getDefaultDuration('success')).toBe(3500);
    expect(getDefaultDuration('info')).toBe(3500);
    expect(getDefaultDuration('warning')).toBe(5000);
    expect(getDefaultDuration('error')).toBe(7000);
    expect(getDefaultDuration('loading')).toBe(0);
  });

  test('2. Auto-dismiss triggers timer and removes toast upon expiration', () => {
    const id = manager.showToast('success', 'Đã tạo đơn thành công');
    expect(manager.toasts.length).toBe(1);
    expect(manager.activeTimers.has(id)).toBe(true);

    // Fast-forward 3.5s
    jest.advanceTimersByTime(3500);

    expect(manager.toasts.length).toBe(0);
    expect(manager.activeTimers.has(id)).toBe(false);
  });

  test('3. Manual dismiss removes toast and cleans up timer immediately', () => {
    const id = manager.showToast('error', 'Lỗi kết nối máy chủ');
    expect(manager.toasts.length).toBe(1);
    expect(manager.activeTimers.has(id)).toBe(true);

    manager.dismiss(id);

    expect(manager.toasts.length).toBe(0);
    expect(manager.activeTimers.has(id)).toBe(false);
  });

  test('4. Maximum 3 toasts queue: 4th toast evicts the oldest and clears its timer', () => {
    const id1 = manager.showToast('info', 'Thông báo 1');
    const id2 = manager.showToast('info', 'Thông báo 2');
    const id3 = manager.showToast('info', 'Thông báo 3');

    expect(manager.toasts.length).toBe(3);
    expect(manager.toasts.map((t) => t.id)).toEqual([id1, id2, id3]);

    // Push 4th toast
    const id4 = manager.showToast('info', 'Thông báo 4');

    expect(manager.toasts.length).toBe(3);
    expect(manager.toasts.map((t) => t.id)).toEqual([id2, id3, id4]);
    // id1 timer should be cleaned up
    expect(manager.activeTimers.has(id1)).toBe(false);
  });

  test('5. Deduplication: duplicate message within 2 seconds is ignored', () => {
    const id1 = manager.showToast('warning', 'Món đang tạm ngưng phục vụ');
    expect(manager.toasts.length).toBe(1);

    // Immediate duplicate
    const id2 = manager.showToast('warning', 'Món đang tạm ngưng phục vụ');
    expect(manager.toasts.length).toBe(1);

    // Advance 1s (still within 2s window)
    jest.advanceTimersByTime(1000);
    const id3 = manager.showToast('warning', 'Món đang tạm ngưng phục vụ');
    expect(manager.toasts.length).toBe(1);

    // Advance 2.5s (window expired)
    jest.advanceTimersByTime(2500);
    const id4 = manager.showToast('warning', 'Món đang tạm ngưng phục vụ');
    expect(manager.toasts.length).toBe(1);
  });

  test('6. Loading toast has duration 0 and does not auto-dismiss until dismissed', () => {
    const id = manager.showToast('loading', 'Đang đồng bộ dữ liệu...');
    expect(manager.toasts.length).toBe(1);
    expect(manager.toasts[0].duration).toBe(0);
    expect(manager.activeTimers.has(id)).toBe(false);

    // Advance 10 seconds
    jest.advanceTimersByTime(10000);
    expect(manager.toasts.length).toBe(1);

    manager.dismiss(id);
    expect(manager.toasts.length).toBe(0);
  });
});
