'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export type DividerVariant = 'full' | 'inset' | 'inset-icon' | 'vertical' | 'labeled';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: DividerVariant;
  surface?: 'opaque' | 'glass';
  label?: React.ReactNode;
}

export const Divider: React.FC<DividerProps> = ({
  variant = 'full',
  surface = 'opaque',
  label,
  className,
  ...props
}) => {
  const lineTone =
    surface === 'glass' ? 'bg-slate-900/[0.09]' : 'bg-[color:var(--separator-hairline)]';

  if (variant === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('w-px self-stretch shrink-0', lineTone, className)}
        {...props}
      />
    );
  }

  if (variant === 'labeled' || label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        className={cn('flex items-center gap-3 w-full select-none', className)}
        {...props}
      >
        <span className={cn('h-px flex-1', lineTone)} aria-hidden="true" />
        {label && (
          <span className="text-footnote font-medium text-slate-500 shrink-0">
            {label}
          </span>
        )}
        <span className={cn('h-px flex-1', lineTone)} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        'h-px shrink-0',
        lineTone,
        variant === 'inset' && 'ml-4',
        variant === 'inset-icon' && 'ml-12',
        variant === 'full' && 'w-full',
        className
      )}
      {...props}
    />
  );
};

Divider.displayName = 'Divider';
