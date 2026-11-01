'use client';

import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

const EVENT_NAME = 'rabbitpos:header-popover-open';

export interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  exclusiveId?: string;
  sheetClassName?: string;
  popoverClassName?: string;
  align?: 'start' | 'center' | 'end';
  width?: string;
  maxHeight?: string;
  'aria-label'?: string;
}

export const ResponsiveSheet: React.FC<ResponsiveSheetProps> = ({
  isOpen,
  onClose,
  triggerRef,
  title,
  description,
  children,
  footer,
  exclusiveId,
  sheetClassName,
  popoverClassName,
  align = 'start',
  width = 'w-80',
  maxHeight = 'max-h-[75vh]',
  'aria-label': ariaLabel,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    flipped: boolean;
  }>({ flipped: false });

  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  // Check client mounting
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  // Mutual exclusivity broadcasting
  useEffect(() => {
    if (!exclusiveId || !isOpen || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: exclusiveId }));

    const handleOtherOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== exclusiveId) {
        onClose();
      }
    };
    window.addEventListener(EVENT_NAME, handleOtherOpen);
    return () => window.removeEventListener(EVENT_NAME, handleOtherOpen);
  }, [exclusiveId, isOpen, onClose]);

  // Save active element on open, return focus on close
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;
    } else if (previouslyFocusedElement.current) {
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else {
        previouslyFocusedElement.current.focus?.();
      }
    }
  }, [isOpen, triggerRef]);

  // Lock mobile body scroll
  useEffect(() => {
    if (!isOpen || !isMobile) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isMobile]);

  // Calculate desktop anchored popover position with collision flip
  const updatePopoverPosition = useCallback(() => {
    if (!isOpen || isMobile || !triggerRef?.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const estimatedHeight = 320;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Flip upwards if bottom space is constrained (< 280px) and top has more space
    const shouldFlip = spaceBelow < 280 && spaceAbove > spaceBelow;

    let coords: typeof popoverCoords = { flipped: shouldFlip };

    if (shouldFlip) {
      coords.bottom = viewportHeight - rect.top + 8;
    } else {
      coords.top = rect.bottom + 8;
    }

    if (align === 'end') {
      coords.right = Math.max(12, viewportWidth - rect.right);
    } else if (align === 'center') {
      coords.left = Math.max(12, Math.min(viewportWidth - 340, rect.left + rect.width / 2 - 160));
    } else {
      coords.left = Math.max(12, Math.min(viewportWidth - 340, rect.left));
    }

    setPopoverCoords(coords);
  }, [isOpen, isMobile, triggerRef, align]);

  useLayoutEffect(() => {
    updatePopoverPosition();
    if (isOpen && !isMobile) {
      window.addEventListener('scroll', updatePopoverPosition, true);
      window.addEventListener('resize', updatePopoverPosition);
      return () => {
        window.removeEventListener('scroll', updatePopoverPosition, true);
        window.removeEventListener('resize', updatePopoverPosition);
      };
    }
  }, [isOpen, isMobile, updatePopoverPosition]);

  // Dismiss on outside click (desktop popover)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        sheetRef.current &&
        !sheetRef.current.contains(target) &&
        (!triggerRef?.current || !triggerRef.current.contains(target))
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, isMobile, onClose, triggerRef]);

  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  // ─── Mobile View: Bottom Sheet (< md) ─────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-sheet flex flex-col justify-end">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm animate-fadeIn transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet Surface */}
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : ariaLabel || 'Bảng chọn tác vụ'}
          className={cn(
            'relative z-sheet w-full bg-white rounded-t-3xl shadow-2xl flex flex-col',
            'max-h-[85dvh] overflow-hidden border-t border-slate-200/90 pb-safe font-sans',
            'animate-slideUp',
            sheetClassName
          )}
        >
          {/* Top Drag Handle Affordance */}
          <div className="flex justify-center pt-2.5 pb-1 select-none">
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
          </div>

          {/* Header */}
          {(title || description) && (
            <div className="px-4 py-2 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="flex flex-col min-w-0">
                {title && (
                  <h2 className="text-base font-bold text-slate-900 leading-snug truncate">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-caption text-slate-500 mt-0.5 leading-normal">
                    {description}
                  </p>
                )}
              </div>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Đóng bảng chọn"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-700 -mr-1"
              >
                <X className="w-4 h-4" />
              </IconButton>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar min-h-0">
            {children}
          </div>

          {/* Sticky Footer */}
          {footer && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/90 backdrop-blur-sm mt-auto shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // ─── Desktop View: Anchored Popover (md+) ─────────────────────────────────
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
    bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
    left: popoverCoords.left !== undefined ? `${popoverCoords.left}px` : undefined,
    right: popoverCoords.right !== undefined ? `${popoverCoords.right}px` : undefined,
  };

  return createPortal(
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : ariaLabel || 'Menu thao tác'}
      style={popoverStyle}
      className={cn(
        'z-popover bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden font-sans',
        'animate-scaleIn flex flex-col',
        width,
        maxHeight,
        popoverClassName
      )}
    >
      {(title || description) && (
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex flex-col min-w-0">
            {title && (
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-caption text-slate-500 truncate">
                {description}
              </p>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Đóng"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 w-6 h-6"
          >
            <X className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0">
        {children}
      </div>

      {footer && (
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/80 shrink-0">
          {footer}
        </div>
      )}
    </div>,
    document.body
  );
};

ResponsiveSheet.displayName = 'ResponsiveSheet';
