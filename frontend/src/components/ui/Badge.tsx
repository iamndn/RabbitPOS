'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
}

const badgeVariantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  brand: {
    container: 'bg-brand-50 text-brand-700 border-brand-200/90',
    dot: 'bg-brand-600',
  },
  success: {
    container: 'bg-emerald-50 text-emerald-700 border-emerald-200/90',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-50 text-amber-700 border-amber-200/90',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-50 text-rose-700 border-rose-200/90',
    dot: 'bg-rose-500',
  },
  neutral: {
    container: 'bg-slate-100 text-slate-700 border-slate-200/90',
    dot: 'bg-slate-500',
  },
};

const badgeSizeStyles: Record<BadgeSize, string> = {
  sm: 'text-caption py-0.5 px-2 rounded-lg gap-1.5 leading-tight font-medium',
  md: 'text-xs py-1 px-2.5 rounded-lg gap-2 leading-normal font-semibold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  dot = false,
  className,
  children,
  ...props
}) => {
  const styles = badgeVariantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-sans border select-none shrink-0',
        styles.container,
        badgeSizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', styles.dot)}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{children}</span>
    </span>
  );
};

Badge.displayName = 'Badge';
