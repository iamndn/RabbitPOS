export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export interface ToastOptions {
  id?: string;
  title?: string;
  duration?: number; // ms. 0 or null for persistent (loading)
  dismissible?: boolean;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
  dismissible: boolean;
  action?: ToastAction;
  createdAt: number;
}

export interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  update: (id: string, options: Partial<ToastOptions> & { type?: ToastType; message?: string }) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;

  // Dedicated helpers for Offline POS Phase
  offline: (message?: string) => string;
  online: (message?: string) => string;
  queuedOrder: (orderCode: string) => string;
  syncSuccess: (count: number) => string;
  syncConflict: (orderCode: string, reason?: string) => string;
}
