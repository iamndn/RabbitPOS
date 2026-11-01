'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  selected?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white border border-brand-700/20 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.22)] focus-visible:ring-brand-500/45',
  secondary:
    'bg-surface-card hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-900/10 shadow-card focus-visible:ring-brand-500/40',
  soft:
    'bg-brand-600/[0.12] hover:bg-brand-600/[0.18] active:bg-brand-600/[0.24] text-brand-700 border border-brand-600/20 focus-visible:ring-brand-500/45',
  ghost:
    'bg-transparent hover:bg-slate-900/[0.05] active:bg-slate-900/[0.10] text-slate-700 border border-transparent focus-visible:ring-brand-500/40',
  danger:
    'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border border-rose-700/20 shadow-[0_1px_2px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.22)] focus-visible:ring-rose-500/45',
};

const selectedVariantOverrides: Partial<Record<ButtonVariant, string>> = {
  secondary: 'bg-brand-50 border-brand-300 text-brand-700 font-semibold',
  ghost: 'bg-brand-glass-pill text-brand-700 font-semibold',
  soft: 'bg-brand-600/[0.20] border-brand-600/35 text-brand-800 font-semibold',
};

// Tahoe Capsule Shape (rounded-full) & Mobile-First 44px Touch Targets (P2, P9)
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-9 md:h-8 px-3.5 md:px-3 text-xs rounded-full gap-1.5 font-medium',
  md: 'h-11 md:h-9 px-4 md:px-3.5 text-headline md:text-subhead rounded-full gap-2 font-semibold',
  lg: 'h-12 md:h-11 px-5 text-base rounded-full gap-2.5 font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      selected,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        aria-pressed={selected}
        className={cn(
          'inline-flex items-center justify-center select-none font-sans outline-none',
          'transition-all duration-press ease-press active:scale-[0.97]',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'touch-manipulation',
          'disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100',
          variantStyles[variant],
          selected && selectedVariantOverrides[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 leading-none">{leftIcon}</span>
        )}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && <span className="shrink-0 leading-none">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  selected?: boolean;
  'aria-label': string; // Required for screen reader accessibility
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-9 h-9 md:w-8 md:h-8 rounded-full',
  md: 'w-11 h-11 md:w-9 md:h-9 rounded-full',
  lg: 'w-12 h-12 md:w-11 md:h-11 rounded-full',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      isLoading = false,
      selected,
      disabled,
      className,
      children,
      type = 'button',
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={isLoading || undefined}
        aria-pressed={selected}
        className={cn(
          'inline-flex items-center justify-center select-none shrink-0 outline-none',
          'transition-all duration-press ease-press active:scale-[0.95]',
          'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'touch-manipulation',
          'disabled:opacity-45 disabled:pointer-events-none disabled:active:scale-100',
          variantStyles[variant],
          selected && selectedVariantOverrides[variant],
          iconSizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          children
        )}
      </button>
    );
  }
);
IconButton.displayName = 'IconButton';
