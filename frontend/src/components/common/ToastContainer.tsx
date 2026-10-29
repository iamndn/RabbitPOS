'use client';

import React, { useRef, useState } from 'react';
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
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

export default function ToastContainer({
  toasts,
  onDismiss,
  onPause,
  onResume,
}: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed z-[9999] pointer-events-none flex flex-col items-center gap-2 
                 top-3.5 pt-safe left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-sm 
                 sm:top-5 sm:max-w-md sm:w-full"
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onPause={onPause}
          onResume={onResume}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const isAlert = toast.type === 'error' || toast.type === 'warning';
  const [isPaused, setIsPaused] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff < 0) {
      setTranslateY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (translateY < -35) {
      onDismiss(toast.id);
    } else {
      setTranslateY(0);
    }
    touchStartY.current = null;
  };

  const handleMouseEnter = () => {
    setIsPaused(true);
    onPause?.(toast.id);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    onResume?.(toast.id);
  };

  const getStyleConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          container: 'border-emerald-200/90 shadow-emerald-950/5',
          iconBubble: 'bg-emerald-50 text-emerald-600 border-emerald-200/80',
          icon: <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />,
          progress: 'bg-emerald-500',
          title: 'text-slate-900',
          actionBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
        };
      case 'error':
        return {
          container: 'border-rose-200/90 shadow-rose-950/5',
          iconBubble: 'bg-rose-50 text-rose-600 border-rose-200/80',
          icon: <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />,
          progress: 'bg-rose-500',
          title: 'text-rose-950',
          actionBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
        };
      case 'warning':
        return {
          container: 'border-amber-200/90 shadow-amber-950/5',
          iconBubble: 'bg-amber-50 text-amber-600 border-amber-200/80',
          icon: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />,
          progress: 'bg-amber-500',
          title: 'text-amber-950',
          actionBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
        };
      case 'loading':
        return {
          container: 'border-purple-200/90 shadow-purple-950/5',
          iconBubble: 'bg-purple-50 text-purple-600 border-purple-200/80',
          icon: <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 animate-spin" />,
          progress: 'bg-purple-500',
          title: 'text-slate-900',
          actionBtn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs',
        };
      case 'info':
      default:
        return {
          container: 'border-sky-200/90 shadow-sky-950/5',
          iconBubble: 'bg-sky-50 text-sky-600 border-sky-200/80',
          icon: <Info className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />,
          progress: 'bg-sky-500',
          title: 'text-slate-900',
          actionBtn: 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs',
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: translateY !== 0 ? `translateY(${translateY}px)` : undefined,
        opacity: translateY < 0 ? Math.max(0, 1 + translateY / 100) : 1,
        transition: translateY === 0 ? 'transform 0.2s ease, opacity 0.2s ease' : undefined,
      }}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-white/95 dark:bg-slate-900/95 p-3 sm:p-3.5 backdrop-blur-md shadow-xl transition-all duration-200 animate-in slide-in-from-top-3 fade-in select-none sm:select-auto ${style.container}`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 border ${style.iconBubble}`}>
          {style.icon}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {toast.title && (
              <h4 className={`text-xs font-black tracking-tight leading-snug ${style.title}`}>
                {toast.title}
              </h4>
            )}
            {toast.count && toast.count > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-900 text-white shadow-2xs">
                ×{toast.count}
              </span>
            )}
          </div>
          <p className="text-xs font-medium leading-relaxed break-words text-slate-600 dark:text-slate-300 mt-0.5">
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
                className={`text-[11px] font-bold px-3 py-1 rounded-lg transition active:scale-95 ${style.actionBtn}`}
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
            aria-label="Đóng thông báo"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Bar with pause support */}
      {toast.duration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={`h-full ${style.progress} animate-toast-progress`}
            style={{
              animationDuration: `${toast.duration}ms`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
}
