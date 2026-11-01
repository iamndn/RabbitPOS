'use client';

import React from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ChipVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: ChipVariant;
  size?: ChipSize;
  count?: number;
  leftIcon?: React.ReactNode;
  onRemove?: () => void;
}

const chipVariantStyles: Record<ChipVariant, { inactive: string; active: string }> = {
  default: {
    inactive: 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90',
    active: 'bg-slate-900 text-white border-slate-900 shadow-sm',
  },
  brand: {
    inactive: 'bg-white hover:bg-brand-50/50 text-slate-700 border-slate-200/90',
    active: 'bg-brand-50 text-brand-700 border-brand-300 font-semibold shadow-sm',
  },
  success: {
    inactive: 'bg-white hover:bg-emerald-50/50 text-slate-700 border-slate-200/90',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold shadow-sm',
  },
  warning: {
    inactive: 'bg-white hover:bg-amber-50/50 text-slate-700 border-slate-200/90',
    active: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold shadow-sm',
  },
  danger: {
    inactive: 'bg-white hover:bg-rose-50/50 text-slate-700 border-slate-200/90',
    active: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold shadow-sm',
  },
};

const chipSizeStyles: Record<ChipSize, string> = {
  sm: 'h-7 px-2.5 text-caption rounded-full gap-1.5',
  md: 'h-9 px-3.5 text-xs md:text-sm rounded-full gap-2',
};

export const Chip: React.FC<ChipProps> = ({
  active = false,
  variant = 'brand',
  size = 'md',
  count,
  leftIcon,
  onRemove,
  className,
  children,
  onClick,
  disabled,
  type = 'button',
  ...props
}) => {
  const currentVariant = chipVariantStyles[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center font-sans select-none border shrink-0',
        'transition-all duration-150 ease-out active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
        'touch-manipulation disabled:opacity-50 disabled:pointer-events-none',
        chipSizeStyles[size],
        active ? currentVariant.active : currentVariant.inactive,
        className
      )}
      {...props}
    >
      {leftIcon && <span className="shrink-0 leading-none">{leftIcon}</span>}
      <span className="truncate">{children}</span>

      {typeof count === 'number' && (
        <span
          className={cn(
            'inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[18px]',
            active
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
          )}
        >
          {count}
        </span>
      )}

      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Xóa bộ lọc"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onRemove();
            }
          }}
          className={cn(
            'ml-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/10 transition-colors',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500'
          )}
        >
          <X className="w-3 h-3" />
        </span>
      )}
    </button>
  );
};

Chip.displayName = 'Chip';

export interface FilterPillProps {
  label: string;
  value?: string | null;
  active?: boolean;
  count?: number;
  onOpen?: () => void;
  onClear?: () => void;
  className?: string;
}

export const FilterPill: React.FC<FilterPillProps> = ({
  label,
  value,
  active = false,
  count,
  onOpen,
  onClear,
  className,
}) => {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen?.();
      }}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs md:text-sm font-sans shrink-0 cursor-pointer select-none',
        'transition-all duration-150 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
        active
          ? 'bg-brand-50 border-brand-300 text-brand-800 font-medium shadow-sm'
          : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50',
        className
      )}
    >
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-[180px]">
        {value || 'Tất cả'}
      </span>

      {typeof count === 'number' && count > 0 && (
        <span className="w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] font-bold inline-flex items-center justify-center">
          {count}
        </span>
      )}

      {active && onClear ? (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Xóa bộ lọc ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-0.5 rounded-full hover:bg-brand-200/60 transition-colors ml-0.5"
        >
          <X className="w-3 h-3 text-brand-700" />
        </span>
      ) : (
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
      )}
    </div>
  );
};

FilterPill.displayName = 'FilterPill';
