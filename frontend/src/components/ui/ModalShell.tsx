'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { useOverlayLayer } from './overlayStack';

export type ModalShellSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional leading icon badge next to the title */
  icon?: React.ReactNode;
  /** Optional trailing controls placed before the close button */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /** Optional sticky footer (uses opaque surface-card so no extra blur layer is added) */
  footer?: React.ReactNode;
  size?: ModalShellSize;
  /** Places modal at z-modal-nested (60) instead of z-modal (50) */
  nested?: boolean;
  /** Render as a bottom sheet on <768px and centered panel on >=768px (default: true) */
  mobileSheet?: boolean;
  /**
   * Blocks Escape, backdrop click, and disables the close button while an async
   * financial mutation is in flight (Override Q5).
   */
  preventClose?: boolean;
  hideCloseButton?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  'aria-label'?: string;
}

const sizeClasses: Record<ModalShellSize, string> = {
  sm: 'md:max-w-md',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
  '2xl': 'md:max-w-5xl',
  full: 'md:max-w-[94vw]',
};

/**
 * Tahoe Task Modal Shell (`01-component-catalog.md` §11 & `Amendment A1`):
 * - Outer backdrop: `glass-scrim` (`0px` blur).
 * - Outer platter: `glass-thick` (`1` active `backdrop-filter` pass).
 * - Automatically sets `html[data-overlay-open="true"]` via `useOverlayLayer`,
 *   demoting z-30 AppShell bars and z-10/20 sticky headers to opaque surfaces.
 * - Automatically sets `data-under-nested-overlay="true"` when a higher overlay
 *   (`z-60` nested modal, `z-70` popover, `z-75` sheet, `z-80` ConfirmModal) opens above it,
 *   guaranteeing at most `1` active modal/sheet blur pass at all times.
 */
export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  headerActions,
  children,
  footer,
  size = 'md',
  nested = false,
  mobileSheet = true,
  preventClose = false,
  hideCloseButton = false,
  panelClassName,
  bodyClassName,
  footerClassName,
  'aria-label': ariaLabel,
}) => {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const zLayer = nested ? 60 : 50;
  const { underHigherOverlay, isTopmost } = useOverlayLayer(
    mounted && isOpen,
    zLayer,
    true
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save focus on open & restore on close
  useEffect(() => {
    if (!mounted) return;
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus?.();
      previouslyFocusedRef.current = null;
    }
  }, [isOpen, mounted]);

  // Dismiss topmost modal on Escape unless preventClose is active
  useEffect(() => {
    if (!mounted || !isOpen || !isTopmost) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!preventClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isOpen, isTopmost, preventClose, onClose]);

  if (!mounted || !isOpen) return null;

  const handleBackdropClick = () => {
    if (!preventClose) {
      onClose();
    }
  };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex justify-center font-sans',
        nested ? 'z-modal-nested' : 'z-modal',
        mobileSheet
          ? 'items-end md:items-center p-0 md:p-4'
          : 'items-center p-3.5 md:p-4'
      )}
    >
      {/* Unblurred Backdrop Scrim (0px blur — Amendment A1) */}
      <div
        className="fixed inset-0 glass-scrim animate-fadeIn"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Active Platter (1 glass-thick blur pass; demotes to opaque when underHigherOverlay) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-label={!title ? ariaLabel || 'Hộp thoại tác vụ' : undefined}
        data-under-nested-overlay={underHigherOverlay ? 'true' : undefined}
        className={cn(
          'relative w-full glass-thick border border-glass flex flex-col overflow-hidden',
          mobileSheet
            ? 'rounded-t-sheet md:rounded-panel max-h-[90dvh] md:max-h-[88dvh] pb-safe md:pb-0 animate-slideUp md:animate-scaleIn'
            : 'rounded-panel max-h-[88dvh] animate-scaleIn',
          sizeClasses[size],
          panelClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Sheet Grabber Pill (visual affordance on < md) */}
        {mobileSheet && (
          <div className="flex justify-center pt-2.5 pb-0.5 md:hidden select-none shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300/90" />
          </div>
        )}

        {/* Header */}
        {(title || description || !hideCloseButton) && (
          <div className="px-4 md:px-5 py-3 md:py-3.5 border-b border-hairline flex items-start justify-between gap-3 shrink-0">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {icon && (
                <div className="w-10 h-10 rounded-field bg-brand-50 border border-brand-200/80 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                  {icon}
                </div>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <h2
                    id={titleId}
                    className="text-title-3 font-semibold text-slate-900 leading-snug truncate"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id={descriptionId}
                    className="text-footnote text-slate-500 mt-0.5 leading-relaxed"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 -mr-1 -mt-0.5">
              {headerActions}
              {!hideCloseButton && (
                <IconButton
                  variant="ghost"
                  size="md"
                  aria-label="Đóng hộp thoại"
                  disabled={preventClose}
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Content Body (opaque cards/rows live inside here) */}
        <div
          className={cn(
            'flex-1 overflow-y-auto px-4 md:px-5 py-4 custom-scrollbar min-h-0',
            bodyClassName
          )}
        >
          {children}
        </div>

        {/* Sticky Footer (Opaque surface-card, 0px extra blur — Amendment A1) */}
        {footer && (
          <div
            className={cn(
              'px-4 md:px-5 py-3 border-t border-hairline bg-surface-card/95 shrink-0',
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

ModalShell.displayName = 'ModalShell';
