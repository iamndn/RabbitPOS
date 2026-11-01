'use client';

import React, { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';
import { useOverlayLayer } from './overlayStack';

const EVENT_NAME = 'rabbitpos:header-popover-open';

export type SheetDetent = 'compact' | 'medium' | 'large' | 'auto';

const detentClasses: Record<SheetDetent, string> = {
  compact: 'max-h-[48dvh]',
  medium: 'max-h-[60dvh]',
  large: 'max-h-[88dvh]',
  auto: 'max-h-[85dvh]',
};

export interface ResponsiveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  exclusiveId?: string;
  /** Preset height detent for mobile bottom sheet (Override Q6) */
  detent?: SheetDetent;
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
  detent = 'auto',
  sheetClassName,
  popoverClassName,
  align = 'start',
  width = 'w-80',
  maxHeight = 'max-h-[75vh]',
  'aria-label': ariaLabel,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    flipped: boolean;
  }>({ flipped: false });

  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    startY: number;
    startTime: number;
  } | null>(null);

  // Amendment A1: Register overlay at z-75 (mobile sheet) or z-70 (desktop popover)
  const { underHigherOverlay, isTopmost } = useOverlayLayer(
    mounted && isOpen,
    isMobile ? 75 : 70,
    isMobile
  );

  // Check client mounting & viewport breakpoint
  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  // Reset drag state whenever sheet opens/closes
  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      setIsDragging(false);
      dragSessionRef.current = null;
    }
  }, [isOpen]);

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
      previouslyFocusedElement.current = null;
    }
  }, [isOpen, triggerRef]);

  // Calculate desktop anchored popover position with collision flip
  const updatePopoverPosition = useCallback(() => {
    if (!isOpen || isMobile || !triggerRef?.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const measuredHeight = sheetRef.current?.offsetHeight || 320;
    const measuredWidth = sheetRef.current?.offsetWidth || 320;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    const shouldFlip = spaceBelow < Math.min(280, measuredHeight + 16) && spaceAbove > spaceBelow;

    const coords: typeof popoverCoords = { flipped: shouldFlip };

    if (shouldFlip) {
      coords.bottom = viewportHeight - rect.top + 8;
    } else {
      coords.top = rect.bottom + 8;
    }

    if (align === 'end') {
      coords.right = Math.max(12, viewportWidth - rect.right);
    } else if (align === 'center') {
      coords.left = Math.max(
        12,
        Math.min(viewportWidth - measuredWidth - 12, rect.left + rect.width / 2 - measuredWidth / 2)
      );
    } else {
      coords.left = Math.max(12, Math.min(viewportWidth - measuredWidth - 12, rect.left));
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

  // Dismiss on outside click (desktop popover, topmost only)
  useEffect(() => {
    if (!isOpen || isMobile || !isTopmost) return;

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
  }, [isOpen, isMobile, isTopmost, onClose, triggerRef]);

  // Dismiss topmost overlay on Escape key
  useEffect(() => {
    if (!isOpen || !isTopmost) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTopmost, onClose]);

  // Override Q6: Header/Grabber-only pointer-drag-to-dismiss (never attached to scrolling body!)
  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startTime: performance.now(),
    };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic events without active pointerId
    }
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;
    const deltaY = Math.max(0, e.clientY - session.startY);
    setDragOffsetY(deltaY);
  };

  const finishHeaderDrag = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== e.pointerId) return;

    const deltaY = Math.max(0, e.clientY - session.startY);
    const elapsed = Math.max(1, performance.now() - session.startTime);
    const velocity = deltaY / elapsed; // px/ms

    dragSessionRef.current = null;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (!cancelled && (deltaY > 72 || (deltaY > 24 && velocity > 0.5))) {
      setDragOffsetY(0);
      onClose();
    } else {
      setDragOffsetY(0);
    }
  };

  if (!mounted || !isOpen) return null;

  // ─── Mobile View: Tahoe Bottom Sheet (< 768px, z-sheet: 75) ────────────────
  if (isMobile) {
    const sheetDragStyle: React.CSSProperties | undefined =
      dragOffsetY > 0 || isDragging
        ? {
            transform: `translate3d(0, ${dragOffsetY}px, 0)`,
            transition: isDragging
              ? 'none'
              : 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }
        : undefined;

    return createPortal(
      <div className="fixed inset-0 z-sheet flex flex-col justify-end font-sans">
        {/* Unblurred Backdrop Scrim (0px blur — Amendment A1) */}
        <div
          className="fixed inset-0 glass-scrim animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet Platter (1 glass-thick blur pass) */}
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : ariaLabel || 'Bảng chọn tác vụ'}
          data-under-nested-overlay={underHigherOverlay ? 'true' : undefined}
          style={sheetDragStyle}
          className={cn(
            'relative z-sheet w-full glass-thick rounded-t-sheet border-t border-glass flex flex-col',
            'overflow-hidden pb-safe',
            dragOffsetY === 0 && !isDragging && 'animate-slideUp',
            detentClasses[detent],
            sheetClassName
          )}
        >
          {/* Non-Scrolling Grabber + Header Drag Zone (Override Q6: >= 48px touch zone, touch-none) */}
          <div
            onPointerDown={handleHeaderPointerDown}
            onPointerMove={handleHeaderPointerMove}
            onPointerUp={(e) => finishHeaderDrag(e, false)}
            onPointerCancel={(e) => finishHeaderDrag(e, true)}
            className={cn(
              'shrink-0 select-none touch-none cursor-grab active:cursor-grabbing',
              !(title || description) && 'min-h-[32px]'
            )}
          >
            {/* Top Drag Handle Pill */}
            <div className="flex justify-center pt-2.5 pb-1.5">
              <div className="w-10 h-1.5 bg-slate-300/90 rounded-full" />
            </div>

            {/* Header */}
            {(title || description) && (
              <div className="px-4 pb-2.5 pt-0.5 border-b border-hairline flex items-center justify-between gap-3 min-h-[48px]">
                <div className="flex flex-col min-w-0 flex-1">
                  {title && (
                    <div className="text-title-3 font-semibold text-slate-900 leading-snug truncate">
                      {title}
                    </div>
                  )}
                  {description && (
                    <p className="text-footnote text-slate-500 mt-0.5 leading-normal">
                      {description}
                    </p>
                  )}
                </div>
                <IconButton
                  variant="ghost"
                  size="md"
                  aria-label="Đóng bảng chọn"
                  onClick={onClose}
                  className="text-slate-500 hover:text-slate-800 -mr-1.5 shrink-0"
                >
                  <X className="w-4 h-4" />
                </IconButton>
              </div>
            )}
          </div>

          {/* Scrollable Content Body (independent native touch scrolling) */}
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar min-h-0">
            {children}
          </div>

          {/* Sticky Footer (Opaque surface-card, 0px extra blur — Amendment A1) */}
          {footer && (
            <div className="p-3 border-t border-hairline bg-surface-card/95 mt-auto shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }

  // ─── Desktop View: Anchored Popover (>= 768px, z-popover: 70) ─────────────
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
      data-under-nested-overlay={underHigherOverlay ? 'true' : undefined}
      style={popoverStyle}
      className={cn(
        'z-popover glass-thick border border-glass rounded-card overflow-hidden font-sans',
        'animate-scaleIn flex flex-col',
        width,
        maxHeight,
        popoverClassName
      )}
    >
      {(title || description) && (
        <div className="px-4 py-2.5 border-b border-hairline flex items-center justify-between gap-2 shrink-0">
          <div className="flex flex-col min-w-0 flex-1">
            {title && (
              <div className="text-subhead font-semibold text-slate-900 truncate">
                {title}
              </div>
            )}
            {description && (
              <p className="text-footnote text-slate-500 truncate mt-0.5">
                {description}
              </p>
            )}
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Đóng"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 -mr-1 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0">
        {children}
      </div>

      {footer && (
        <div className="p-2.5 border-t border-hairline bg-surface-card/95 shrink-0">
          {footer}
        </div>
      )}
    </div>,
    document.body
  );
};

ResponsiveSheet.displayName = 'ResponsiveSheet';
