'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type SwitchSize = 'sm' | 'md';

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  size?: SwitchSize;
  isLoading?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      onCheckedChange,
      size = 'md',
      isLoading = false,
      disabled = false,
      label,
      description,
      className,
      id,
      'aria-label': ariaLabel,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    const labelId = id ? `${id}-label` : undefined;
    const descId = id && description ? `${id}-desc` : undefined;

    const control = (
      <button
        ref={ref}
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-busy={isLoading || undefined}
        aria-label={ariaLabel}
        aria-labelledby={!ariaLabel && labelId ? labelId : undefined}
        aria-describedby={descId}
        disabled={isDisabled}
        onClick={() => !isDisabled && onCheckedChange(!checked)}
        className={cn(
          // Minimum 44x44px hit target on mobile (< md), 36px on desktop (P9)
          'group relative inline-flex items-center justify-center shrink-0 select-none outline-none touch-manipulation',
          'min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[40px] rounded-full',
          'focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
          'disabled:opacity-45 disabled:pointer-events-none',
          !label && className
        )}
        {...props}
      >
        {/* Opaque Capsule Track (0px backdrop-filter) */}
        <span
          aria-hidden="true"
          className={cn(
            'relative inline-flex items-center rounded-full border border-transparent transition-colors duration-snappy ease-spring-snappy',
            'group-active:scale-[0.96]',
            size === 'sm' ? 'w-9 h-[22px] p-[2px]' : 'w-11 h-[26px] p-[2px]',
            checked ? 'bg-brand-600' : 'bg-slate-300 group-hover:bg-slate-400/80'
          )}
        >
          {/* Thumb */}
          <span
            className={cn(
              'pointer-events-none inline-flex items-center justify-center rounded-full bg-white',
              'shadow-[0_1px_3px_rgba(15,23,42,0.22),0_1px_1px_rgba(15,23,42,0.10)]',
              'transition-transform duration-snappy ease-spring-snappy',
              size === 'sm' ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]',
              checked
                ? size === 'sm'
                  ? 'translate-x-[14px]'
                  : 'translate-x-[18px]'
                : 'translate-x-0'
            )}
          >
            {isLoading && (
              <Loader2 className="w-3 h-3 text-brand-600 animate-spin" aria-hidden="true" />
            )}
          </span>
        </span>
      </button>
    );

    if (!label && !description) {
      return control;
    }

    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 w-full font-sans',
          isDisabled && 'opacity-60',
          className
        )}
      >
        <div
          className="flex flex-col min-w-0 flex-1 cursor-pointer select-none"
          onClick={() => !isDisabled && onCheckedChange(!checked)}
        >
          {label && (
            <span id={labelId} className="text-headline text-slate-900 leading-snug">
              {label}
            </span>
          )}
          {description && (
            <span id={descId} className="text-footnote text-slate-500 mt-0.5 leading-normal">
              {description}
            </span>
          )}
        </div>
        {control}
      </div>
    );
  }
);

Switch.displayName = 'Switch';
