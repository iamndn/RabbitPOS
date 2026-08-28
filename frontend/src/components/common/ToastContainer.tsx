'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { ToastItem } from '@/types/toast';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed z-[9999] pointer-events-none flex flex-col gap-2.5 
                 bottom-20 left-3 right-3 max-w-sm mx-auto 
                 sm:bottom-auto sm:left-auto sm:right-4 sm:top-4 sm:max-w-md sm:w-full"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const isAlert = toast.type === 'error' || toast.type === 'warning';

  const getStyleConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          container: 'bg-emerald-900/95 text-emerald-50 border-emerald-500/40 shadow-xl shadow-emerald-950/20',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />,
          progress: 'bg-emerald-400/70',
          button: 'text-emerald-200 hover:text-white hover:bg-emerald-800/50',
          actionBtn: 'bg-emerald-700 hover:bg-emerald-600 text-white',
        };
      case 'error':
        return {
          container: 'bg-rose-950/95 text-rose-50 border-rose-500/40 shadow-xl shadow-rose-950/25',
          icon: <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />,
          progress: 'bg-rose-400/70',
          button: 'text-rose-200 hover:text-white hover:bg-rose-800/50',
          actionBtn: 'bg-rose-700 hover:bg-rose-600 text-white',
        };
      case 'warning':
        return {
          container: 'bg-amber-950/95 text-amber-50 border-amber-500/40 shadow-xl shadow-amber-950/25',
          icon: <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />,
          progress: 'bg-amber-400/70',
          button: 'text-amber-200 hover:text-white hover:bg-amber-800/50',
          actionBtn: 'bg-amber-700 hover:bg-amber-600 text-white',
        };
      case 'loading':
        return {
          container: 'bg-slate-900/95 text-slate-50 border-slate-700/60 shadow-xl shadow-slate-950/30',
          icon: <Loader2 className="w-5 h-5 text-teal-400 animate-spin shrink-0 mt-0.5" />,
          progress: 'bg-teal-400/70',
          button: 'text-slate-300 hover:text-white hover:bg-slate-800/50',
          actionBtn: 'bg-teal-600 hover:bg-teal-500 text-white',
        };
      case 'info':
      default:
        return {
          container: 'bg-slate-900/95 text-slate-50 border-slate-700/60 shadow-xl shadow-slate-950/30',
          icon: <Info className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />,
          progress: 'bg-sky-400/70',
          button: 'text-slate-300 hover:text-white hover:bg-slate-800/50',
          actionBtn: 'bg-sky-700 hover:bg-sky-600 text-white',
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border p-3.5 backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-4 sm:slide-in-from-top-4 fade-in ${style.container}`}
    >
      <div className="flex items-start gap-3">
        {style.icon}
        <div className="flex-1 min-w-0 pr-1">
          {toast.title && (
            <h4 className="text-xs font-bold tracking-tight mb-0.5 leading-snug">
              {toast.title}
            </h4>
          )}
          <p className="text-xs font-medium leading-relaxed break-words opacity-95">
            {toast.message}
          </p>

          {toast.action && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className={`text-[11px] font-bold px-3 py-1 rounded-lg transition active:scale-95 shadow-xs ${style.actionBtn}`}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {toast.dismissible && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Close notification"
            className={`p-1 rounded-lg transition active:scale-95 shrink-0 ${style.button}`}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Subtle Auto-dismiss Progress Bar */}
      {toast.duration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/20 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`h-full ${style.progress} animate-toast-progress`}
            style={{
              animationDuration: `${toast.duration}ms`,
            }}
          />
        </div>
      )}
    </div>
  );
}
