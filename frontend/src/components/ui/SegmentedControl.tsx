'use client';

import React, { useRef } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedControlOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const findNextEnabledIndex = (start: number, step: 1 | -1): number => {
    const len = options.length;
    for (let i = 1; i <= len; i++) {
      const idx = (start + step * i + len) % len;
      if (!options[idx]?.disabled) return idx;
    }
    return -1;
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (disabled) return;
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = findNextEnabledIndex(index, 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = findNextEnabledIndex(index, -1);
    } else if (e.key === 'Home') {
      nextIndex = options.findIndex((o) => !o.disabled);
    } else if (e.key === 'End') {
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i].disabled) {
          nextIndex = i;
          break;
        }
      }
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      onChange(options[nextIndex].value);
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={cn(
        // Opaque recessed capsule well (--surface-grouped, 0px backdrop-filter)
        'inline-flex items-center p-1 bg-surface-grouped border border-hairline rounded-full font-sans select-none',
        disabled && 'opacity-45 pointer-events-none',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        const isOptDisabled = disabled || Boolean(opt.disabled);

        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            disabled={isOptDisabled}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => !isOptDisabled && onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-full font-medium',
              'transition-all duration-snappy ease-spring-snappy active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:z-10',
              'touch-manipulation disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100',
              size === 'sm'
                ? 'h-8 px-3 text-footnote'
                : 'h-9 px-3.5 text-footnote md:text-subhead',
              fullWidth ? 'flex-1 min-w-0' : 'shrink-0',
              isSelected
                ? 'bg-surface-card text-brand-700 shadow-glass-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-black/[0.03]'
            )}
          >
            {opt.icon && <span className="shrink-0 leading-none">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge && <span className="ml-0.5 shrink-0">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};

SegmentedControl.displayName = 'SegmentedControl';
