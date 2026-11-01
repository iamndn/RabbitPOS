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
  className?: string;
  'aria-label'?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className,
  'aria-label': ariaLabel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    }

    if (nextIndex !== -1 && !options[nextIndex].disabled) {
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
      className={cn(
        'inline-flex items-center p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl font-sans select-none',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;

        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            disabled={opt.disabled}
            aria-selected={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => !opt.disabled && onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 transition-all duration-150 ease-out font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:z-10',
              'disabled:opacity-40 disabled:pointer-events-none',
              size === 'sm' ? 'h-7 px-2.5 text-xs rounded-lg' : 'h-9 px-3.5 text-xs md:text-sm rounded-lg',
              fullWidth ? 'flex-1' : 'shrink-0',
              isSelected
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            )}
          >
            {opt.icon && <span className="shrink-0 leading-none">{opt.icon}</span>}
            <span className="truncate">{opt.label}</span>
            {opt.badge && <span className="ml-1 shrink-0">{opt.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};

SegmentedControl.displayName = 'SegmentedControl';
