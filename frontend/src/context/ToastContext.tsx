'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  ToastContextType,
  ToastItem,
  ToastOptions,
  ToastType,
} from '@/types/toast';
import ToastContainer from '@/components/common/ToastContainer';

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 3;
const DEDUPLICATION_WINDOW_MS = 2000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, { timer: NodeJS.Timeout | null; startedAt: number; remaining: number }>>(new Map());
  const recentToastsRef = useRef<Map<string, { id: string; timestamp: number }>>(new Map());

  // Cleanup all active timers when provider unmounts
  useEffect(() => {
    const activeTimers = timersRef.current;
    return () => {
      activeTimers.forEach((item) => {
        if (item.timer) clearTimeout(item.timer);
      });
      activeTimers.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const item = timersRef.current.get(id);
    if (item && item.timer) {
      clearTimeout(item.timer);
    }
    timersRef.current.delete(id);

    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pause = useCallback((id: string) => {
    const item = timersRef.current.get(id);
    if (item && item.timer) {
      clearTimeout(item.timer);
      const elapsed = Date.now() - item.startedAt;
      const remaining = Math.max(1000, item.remaining - elapsed);
      timersRef.current.set(id, { timer: null, startedAt: Date.now(), remaining });
    }
  }, []);

  const resume = useCallback(
    (id: string) => {
      const item = timersRef.current.get(id);
      if (item && !item.timer && item.remaining > 0) {
        const startedAt = Date.now();
        const timer = setTimeout(() => {
          dismiss(id);
        }, item.remaining);
        timersRef.current.set(id, { timer, startedAt, remaining: item.remaining });
      }
    },
    [dismiss]
  );

  const clearAll = useCallback(() => {
    timersRef.current.forEach((item) => {
      if (item.timer) clearTimeout(item.timer);
    });
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const getDefaultDuration = (type: ToastType): number => {
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
  };

  const showToast = useCallback(
    (type: ToastType, message: string, options: ToastOptions = {}): string => {
      const now = Date.now();
      const dedupKey = `${type}:${message.trim()}`;

      // Deduplication check within 2 seconds
      const lastEntry = recentToastsRef.current.get(dedupKey);
      if (lastEntry && now - lastEntry.timestamp < DEDUPLICATION_WINDOW_MS) {
        // Increment count on existing toast!
        setToasts((prev) =>
          prev.map((t) => {
            if (t.id === lastEntry.id) {
              return { ...t, count: (t.count || 1) + 1, createdAt: now };
            }
            return t;
          })
        );
        // Refresh timer if active
        const duration = options.duration !== undefined ? options.duration : getDefaultDuration(type);
        const existingTimer = timersRef.current.get(lastEntry.id);
        if (existingTimer && existingTimer.timer) {
          clearTimeout(existingTimer.timer);
        }
        if (duration > 0) {
          const newTimer = setTimeout(() => {
            dismiss(lastEntry.id);
          }, duration);
          timersRef.current.set(lastEntry.id, { timer: newTimer, startedAt: now, remaining: duration });
        }
        recentToastsRef.current.set(dedupKey, { id: lastEntry.id, timestamp: now });
        return lastEntry.id;
      }

      const id = options.id || `toast_${now}_${Math.random().toString(36).substring(2, 7)}`;
      recentToastsRef.current.set(dedupKey, { id, timestamp: now });

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
        count: 1,
      };

      // Set auto-dismiss timer if duration > 0
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, { timer, startedAt: now, remaining: duration });
      }

      setToasts((prev) => {
        // Keep max 3 toasts, removing oldest if needed
        const filtered = prev.filter((t) => t.id !== id);
        if (filtered.length >= MAX_TOASTS) {
          const removed = filtered.slice(0, filtered.length - MAX_TOASTS + 1);
          removed.forEach((r) => {
            const oldItem = timersRef.current.get(r.id);
            if (oldItem && oldItem.timer) {
              clearTimeout(oldItem.timer);
            }
            timersRef.current.delete(r.id);
          });
          return [...filtered.slice(filtered.length - MAX_TOASTS + 1), newToast];
        }
        return [...filtered, newToast];
      });

      return id;
    },
    [dismiss]
  );

  const update = useCallback(
    (id: string, options: Partial<ToastOptions> & { type?: ToastType; message?: string }) => {
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;

          const updatedType = options.type || t.type;
          const updatedMessage = options.message !== undefined ? options.message : t.message;
          const updatedDuration =
            options.duration !== undefined ? options.duration : getDefaultDuration(updatedType);

          // Clear previous timer and set new if duration > 0
          const oldItem = timersRef.current.get(id);
          if (oldItem && oldItem.timer) {
            clearTimeout(oldItem.timer);
            timersRef.current.delete(id);
          }

          if (updatedDuration > 0) {
            const newTimer = setTimeout(() => {
              dismiss(id);
            }, updatedDuration);
            timersRef.current.set(id, { timer: newTimer, startedAt: Date.now(), remaining: updatedDuration });
          }

          return {
            ...t,
            type: updatedType,
            message: updatedMessage,
            title: options.title !== undefined ? options.title : t.title,
            duration: updatedDuration,
            dismissible: options.dismissible !== undefined ? options.dismissible : t.dismissible,
            action: options.action !== undefined ? options.action : t.action,
          };
        })
      );
    },
    [dismiss]
  );

  // Shortcut APIs
  const success = useCallback((msg: string, opts?: ToastOptions) => showToast('success', msg, opts), [showToast]);
  const error = useCallback((msg: string, opts?: ToastOptions) => showToast('error', msg, opts), [showToast]);
  const warning = useCallback((msg: string, opts?: ToastOptions) => showToast('warning', msg, opts), [showToast]);
  const info = useCallback((msg: string, opts?: ToastOptions) => showToast('info', msg, opts), [showToast]);
  const loading = useCallback((msg: string, opts?: ToastOptions) => showToast('loading', msg, { duration: 0, ...opts }), [showToast]);

  // Offline Helpers (Ready for Offline POS phase)
  const offline = useCallback(
    (msg?: string) =>
      showToast('warning', msg || 'Mất kết nối Internet. Đã chuyển sang chế độ Bán Hàng Offline.', {
        title: 'Chế độ Ngoại Tuyến',
        duration: 6000,
      }),
    [showToast]
  );

  const online = useCallback(
    (msg?: string) =>
      showToast('success', msg || 'Đã khôi phục kết nối Internet. Đang đồng bộ dữ liệu...', {
        title: 'Đã Kết Nối Lại',
        duration: 4000,
      }),
    [showToast]
  );

  const queuedOrder = useCallback(
    (orderCode: string) =>
      showToast('info', `Đơn hàng #${orderCode} đã được lưu offline vào hàng đợi thiết bị.`, {
        title: 'Đã Lưu Offline',
        duration: 4500,
      }),
    [showToast]
  );

  const syncSuccess = useCallback(
    (count: number) =>
      showToast('success', `Đã đồng bộ thành công ${count} đơn hàng offline lên máy chủ.`, {
        title: 'Đồng Bộ Thành Công',
        duration: 4000,
      }),
    [showToast]
  );

  const syncConflict = useCallback(
    (orderCode: string, reason?: string) =>
      showToast('error', `Đơn hàng #${orderCode} gặp xung đột khi đồng bộ: ${reason || 'Dữ liệu không khớp'}.`, {
        title: 'Xung Đột Đồng Bộ',
        duration: 8000,
      }),
    [showToast]
  );

  const contextValue: ToastContextType = useMemo(
    () => ({
      toasts,
      showToast,
      success,
      error,
      warning,
      info,
      loading,
      update,
      dismiss,
      clearAll,
      pause,
      resume,
      offline,
      online,
      queuedOrder,
      syncSuccess,
      syncConflict,
    }),
    [
      toasts,
      showToast,
      success,
      error,
      warning,
      info,
      loading,
      update,
      dismiss,
      clearAll,
      pause,
      resume,
      offline,
      online,
      queuedOrder,
      syncSuccess,
      syncConflict,
    ]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismiss}
        onPause={pause}
        onResume={resume}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
