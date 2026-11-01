'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ConfirmOptions, ConfirmType } from '@/types/confirm';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { Button, IconButton } from '@/components/ui/Button';
import { useOverlayLayer } from '@/components/ui/overlayStack';
import { cn } from '@/lib/cn';

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Tahoe System Confirm / Alert Dialog (`01-component-catalog.md` §11, `Override Q5`, `Amendment A1`):
 * - Normalized z-index: `z-dialog-alert` (`80`), portaled to `document.body`.
 * - Registers with `useOverlayLayer` at `zLayer = 80`, automatically setting
 *   `html[data-overlay-open="true"]` and demoting any underlying `z-50`/`z-60` modal
 *   or `z-75` sheet to opaque `#FFFFFF` (`0px` blur).
 * - Outer backdrop: `glass-scrim` (`0px` blur).
 * - Dialog platter: `glass-thick` (`1` active `backdrop-filter` pass).
 * - Override Q5 Dual Pending Lock: Enforces synchronous `confirmingRef` + `isPending` state
 *   so double-taps, double-clicks, or repeated `Enter` presses can NEVER double-execute
 *   financial mutations (`order cancel`, `transaction delete`, `purchase delete`, `fund delete`).
 */
export default function ConfirmModal({
  isOpen,
  options,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const confirmingRef = useRef(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  const { underHigherOverlay, isTopmost } = useOverlayLayer(
    mounted && isOpen && Boolean(options),
    80,
    true
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset synchronous pending lock each time dialog opens/closes
  useEffect(() => {
    confirmingRef.current = false;
    setIsPending(false);
  }, [isOpen, options]);

  const triggerConfirm = useCallback(async () => {
    if (!options || confirmingRef.current) return;

    // Override Q5: Synchronous ref lock BEFORE any state update or await
    confirmingRef.current = true;
    setIsPending(true);

    if (options.onConfirmAsync) {
      try {
        const result = await options.onConfirmAsync();
        if (result === false) {
          confirmingRef.current = false;
          setIsPending(false);
          return;
        }
        onConfirm();
      } catch {
        // Release lock on failure so caller's error toast shows and user can retry or cancel
        confirmingRef.current = false;
        setIsPending(false);
      }
      return;
    }

    onConfirm();
  }, [options, onConfirm]);

  const triggerCancel = useCallback(() => {
    if (confirmingRef.current || isPending) return;
    onCancel();
  }, [isPending, onCancel]);

  useEffect(() => {
    if (!mounted || !isOpen || !options) return;

    const timer = setTimeout(() => {
      if (options.autoFocusButton === 'cancel') {
        cancelBtnRef.current?.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmost) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (!confirmingRef.current) {
          onCancel();
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (document.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault();
        void triggerConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted, isOpen, options, isTopmost, onCancel, triggerConfirm]);

  if (!mounted || !isOpen || !options) return null;

  const type: ConfirmType = options.type || 'info';

  const renderIcon = () => {
    if (options.icon) return options.icon;

    switch (type) {
      case 'danger':
        return <Trash2 className="w-5 h-5 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-brand-600" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-sky-600" />;
    }
  };

  const getBadgeStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-50 border-rose-200/85 text-rose-700';
      case 'warning':
        return 'bg-amber-50 border-amber-200/85 text-amber-800';
      case 'success':
        return 'bg-brand-50 border-brand-200/85 text-brand-700';
      case 'info':
      default:
        return 'bg-sky-50 border-sky-200/85 text-sky-700';
    }
  };

  const defaultConfirmText = () => {
    if (options.confirmText) return options.confirmText;
    if (options.isAlert) return t('common.close') || 'Đóng';
    switch (type) {
      case 'danger':
        return t('common.delete') || 'Xóa';
      case 'warning':
        return t('common.confirm') || 'Xác nhận';
      case 'success':
        return t('common.ok') || 'Đồng ý';
      case 'info':
      default:
        return t('common.confirm') || 'Xác nhận';
    }
  };

  const defaultCancelText = () => {
    return options.cancelText || t('common.cancel') || 'Hủy bỏ';
  };

  const confirmVariant = type === 'danger' ? 'danger' : 'primary';

  return createPortal(
    <div
      className="fixed inset-0 z-dialog-alert flex items-end md:items-center justify-center p-0 md:p-4 font-sans"
    >
      {/* Unblurred Backdrop Scrim (0px blur — Amendment A1) */}
      <div
        className="fixed inset-0 glass-scrim animate-fadeIn"
        onClick={triggerCancel}
        aria-hidden="true"
      />

      {/* Alert / Confirm Platter (1 glass-thick blur pass) */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        data-under-nested-overlay={underHigherOverlay ? 'true' : undefined}
        className="relative w-full max-w-full md:max-w-md glass-thick rounded-t-sheet md:rounded-panel border border-glass overflow-hidden animate-slideUp md:animate-scaleIn pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Grabber Pill */}
        <div className="w-10 h-1 rounded-full bg-slate-300/90 mx-auto mt-2.5 mb-0.5 md:hidden" />

        {/* Close Button Top Right (44x44 mobile / 36x36 desktop) */}
        <div className="absolute top-2.5 right-2.5">
          <IconButton
            variant="ghost"
            size="md"
            disabled={isPending}
            onClick={triggerCancel}
            aria-label="Đóng hộp thoại xác nhận"
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </IconButton>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3.5">
            {/* Type Badge Icon */}
            <div
              className={cn(
                'w-11 h-11 rounded-field flex items-center justify-center shrink-0 border',
                getBadgeStyle()
              )}
            >
              {renderIcon()}
            </div>

            {/* Title & Message */}
            <div className="flex-1 min-w-0 pr-7">
              <h3
                id={titleId}
                className="text-title-3 font-semibold text-slate-900 leading-snug"
              >
                {options.title}
              </h3>
              {options.message && (
                <p
                  id={messageId}
                  className="mt-1.5 text-subhead text-slate-600 leading-relaxed break-words"
                >
                  {options.message}
                </p>
              )}
            </div>
          </div>

          {/* Capsule Action Buttons (Override Q5: disabled & loading while pending) */}
          <div
            className={cn(
              'mt-6 pt-4 border-t border-hairline',
              options.isAlert
                ? 'flex justify-end'
                : 'grid grid-cols-2 gap-2.5 sm:flex sm:justify-end sm:gap-2.5'
            )}
          >
            {!options.isAlert && (
              <Button
                ref={cancelBtnRef}
                variant="secondary"
                size="lg"
                disabled={isPending}
                onClick={triggerCancel}
                className="w-full sm:w-auto"
              >
                {defaultCancelText()}
              </Button>
            )}
            <Button
              ref={confirmBtnRef}
              variant={confirmVariant}
              size="lg"
              isLoading={isPending}
              disabled={isPending}
              onClick={() => void triggerConfirm()}
              className={cn(
                'w-full sm:w-auto',
                type === 'warning' &&
                  'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 border-amber-700/80'
              )}
            >
              {defaultConfirmText()}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
