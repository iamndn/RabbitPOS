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
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white shadow-sm border border-transparent focus-visible:ring-brand-500/35',
  secondary:
    'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-200/90 shadow-sm focus-visible:ring-slate-400/40',
  soft:
    'bg-brand-50 hover:bg-brand-100 active:bg-brand-200 text-brand-700 border border-brand-200 focus-visible:ring-brand-500/35',
  ghost:
    'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-700 border border-transparent focus-visible:ring-slate-400/40',
  danger:
    'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm border border-transparent focus-visible:ring-rose-500/35',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs rounded-lg gap-1.5',
  md: 'h-11 md:h-9 px-4 md:px-3 text-base md:text-sm rounded-xl gap-2 font-medium',
  lg: 'h-12 md:h-11 px-5 md:px-4 text-base rounded-xl gap-2.5 font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
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
        className={cn(
          // Base layout & typography
          'inline-flex items-center justify-center select-none font-sans outline-none font-medium',
          'transition-all duration-150 ease-out active:scale-[0.98]',
          // Focus-visible compliance (D6)
          'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
          // Touch manipulation
          'touch-manipulation',
          // Disabled state
          'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
          // Variant & Size tokens
          variantStyles[variant],
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
  'aria-label': string; // Required for screen reader accessibility
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-11 h-11 md:w-9 md:h-9 rounded-xl',
  lg: 'w-12 h-12 md:w-11 md:h-11 rounded-xl',
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'ghost',
      size = 'md',
      isLoading = false,
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
        className={cn(
          'inline-flex items-center justify-center select-none shrink-0 outline-none',
          'transition-all duration-150 ease-out active:scale-[0.96]',
          'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white',
          'touch-manipulation',
          'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100',
          variantStyles[variant],
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
