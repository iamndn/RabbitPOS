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

// Opaque capsule filter chips (0px backdrop-filter, tint + hairline hierarchy per P3)
const chipVariantStyles: Record<ChipVariant, { inactive: string; active: string }> = {
  default: {
    inactive: 'bg-surface-card hover:bg-slate-50 text-slate-700 border-slate-900/10',
    active: 'bg-slate-900 text-white border-slate-900 font-semibold',
  },
  brand: {
    inactive: 'bg-surface-card hover:bg-brand-50/50 text-slate-700 border-slate-900/10',
    active: 'bg-brand-600/[0.12] text-brand-700 border-brand-500/35 font-semibold',
  },
  success: {
    inactive: 'bg-surface-card hover:bg-emerald-50/50 text-slate-700 border-slate-900/10',
    active: 'bg-emerald-50 text-emerald-800 border-emerald-400/50 font-semibold',
  },
  warning: {
    inactive: 'bg-surface-card hover:bg-amber-50/50 text-slate-700 border-slate-900/10',
    active: 'bg-amber-50 text-amber-800 border-amber-400/50 font-semibold',
  },
  danger: {
    inactive: 'bg-surface-card hover:bg-rose-50/50 text-slate-700 border-slate-900/10',
    active: 'bg-rose-50 text-rose-800 border-rose-400/50 font-semibold',
  },
};

const chipSizeStyles: Record<ChipSize, string> = {
  sm: 'h-8 px-3 text-xs md:text-caption rounded-full gap-1.5',
  md: 'h-9 px-3.5 text-sm md:text-subhead rounded-full gap-2',
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
      aria-pressed={active}
      className={cn(
        'inline-flex items-center justify-center font-sans select-none border shrink-0',
        'transition-all duration-press ease-press active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1',
        'touch-manipulation disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100',
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
            'inline-flex items-center justify-center text-caption font-semibold px-1.5 rounded-full min-w-[20px] font-num',
            active
              ? variant === 'default'
                ? 'bg-white/20 text-white'
                : 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-600'
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
  disabled?: boolean;
  onOpen?: () => void;
  onClear?: () => void;
  className?: string;
}

export const FilterPill: React.FC<FilterPillProps> = ({
  label,
  value,
  active = false,
  count,
  disabled = false,
  onOpen,
  onClear,
  className,
}) => {
  return (
    <div
      onClick={disabled ? undefined : onOpen}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen?.();
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-sm md:text-subhead font-sans shrink-0 cursor-pointer select-none',
        'transition-all duration-press ease-press active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1',
        disabled && 'opacity-45 pointer-events-none',
        active
          ? 'bg-brand-600/[0.12] border-brand-500/35 text-brand-800 font-medium'
          : 'bg-surface-card border-slate-900/10 text-slate-700 hover:bg-slate-50',
        className
      )}
    >
      <span className="text-slate-500">{label}:</span>
      <span className="font-semibold text-slate-900 truncate max-w-[120px] sm:max-w-[180px]">
        {value || 'Tất cả'}
      </span>

      {typeof count === 'number' && count > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-caption font-semibold font-num inline-flex items-center justify-center">
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onClear();
            }
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
