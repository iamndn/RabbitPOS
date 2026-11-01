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
import { cn } from '@/lib/cn';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

/**
 * Tahoe Toast Container (`01-component-catalog.md` §12 & `Amendment A1`):
 * - Uses normalized `z-toast` (`90`, replacing `z-[9999]`).
 * - Strictly caps active Toast `backdrop-filter` passes at `<= 1`:
 *   Only the newest/primary toast (`idx === toasts.length - 1`) uses `.glass-toast`
 *   (`glass-regular` that stays frosted at `z-90` even over open overlays), while older
 *   stacked toasts use opaque `bg-surface-card shadow-card` (`0px` blur).
 */
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
      className="fixed z-toast pointer-events-none flex flex-col items-center gap-2 top-3.5 pt-safe left-1/2 -translate-x-1/2 w-[calc(100vw-1.5rem)] max-w-sm sm:top-5 sm:max-w-md sm:w-full font-sans"
    >
      {toasts.map((toast, idx) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          useGlass={idx === toasts.length - 1}
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
  useGlass,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastItem;
  useGlass: boolean;
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
          container: 'border-emerald-200/80',
          iconBubble: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
          icon: <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />,
          progress: 'bg-emerald-500',
          title: 'text-slate-900',
          actionBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-glass-sm',
        };
      case 'error':
        return {
          container: 'border-rose-200/85',
          iconBubble: 'bg-rose-50 text-rose-700 border-rose-200/80',
          icon: <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />,
          progress: 'bg-rose-500',
          title: 'text-rose-950',
          actionBtn: 'bg-rose-600 hover:bg-rose-700 text-white shadow-glass-sm',
        };
      case 'warning':
        return {
          container: 'border-amber-200/85',
          iconBubble: 'bg-amber-50 text-amber-800 border-amber-200/80',
          icon: <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />,
          progress: 'bg-amber-500',
          title: 'text-amber-950',
          actionBtn: 'bg-amber-600 hover:bg-amber-700 text-white shadow-glass-sm',
        };
      case 'loading':
        return {
          container: 'border-brand-200/85',
          iconBubble: 'bg-brand-50 text-brand-700 border-brand-200/80',
          icon: <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600 animate-spin" />,
          progress: 'bg-brand-500',
          title: 'text-slate-900',
          actionBtn: 'bg-brand-600 hover:bg-brand-700 text-white shadow-glass-sm',
        };
      case 'info':
      default:
        return {
          container: 'border-sky-200/85',
          iconBubble: 'bg-sky-50 text-sky-700 border-sky-200/80',
          icon: <Info className="w-4 h-4 sm:w-5 sm:h-5 text-sky-600" />,
          progress: 'bg-sky-500',
          title: 'text-slate-900',
          actionBtn: 'bg-sky-600 hover:bg-sky-700 text-white shadow-glass-sm',
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
      data-toast="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: translateY !== 0 ? `translateY(${translateY}px)` : undefined,
        opacity: translateY < 0 ? Math.max(0, 1 + translateY / 100) : 1,
        transition:
          translateY === 0
            ? 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)'
            : undefined,
      }}
      className={cn(
        'pointer-events-auto relative w-full overflow-hidden rounded-card border p-3 sm:p-3.5 animate-fadeIn select-none sm:select-auto',
        useGlass ? 'glass-toast' : 'bg-surface-card shadow-card',
        style.container
      )}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div
          className={cn(
            'w-8 h-8 sm:w-9 sm:h-9 rounded-field flex items-center justify-center shrink-0 border',
            style.iconBubble
          )}
        >
          {style.icon}
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {toast.title && (
              <h4
                className={cn(
                  'text-footnote font-semibold tracking-tight leading-snug',
                  style.title
                )}
              >
                {toast.title}
              </h4>
            )}
            {toast.count && toast.count > 1 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption font-num font-bold bg-slate-900 text-white">
                ×{toast.count}
              </span>
            )}
          </div>
          <p className="text-footnote font-medium leading-relaxed break-words text-slate-600 mt-0.5">
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
                className={cn(
                  'text-caption font-semibold px-3 py-1.5 rounded-full transition-all duration-press ease-press active:scale-[0.97]',
                  style.actionBtn
                )}
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
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-900/[0.06] transition-colors shrink-0 -mr-1 -mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Bar with pause support */}
      {toast.duration > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/60 overflow-hidden"
          aria-hidden="true"
        >
          <div
            className={cn('h-full animate-toast-progress', style.progress)}
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
