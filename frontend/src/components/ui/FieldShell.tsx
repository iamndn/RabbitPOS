'use client';

import React from 'react';
import { cn } from '@/lib/cn';

export interface FieldShellProps {
  id?: string;
  label?: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optionalText?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FieldShell: React.FC<FieldShellProps> = ({
  id,
  label,
  required = false,
  hint,
  error,
  optionalText,
  compact = false,
  className,
  children,
}) => {
  const hintId = id ? `${id}-hint` : undefined;
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col w-full font-sans', compact ? 'gap-1' : 'gap-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={id}
            className={cn(
              // Sentence-case Tahoe field label (anti-generic: no uppercase eyebrow tracking)
              'font-medium select-none',
              compact ? 'text-footnote text-slate-600' : 'text-subhead text-slate-700'
            )}
          >
            {label}
            {required && (
              <span className="text-rose-500 ml-1 font-semibold" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {optionalText && (
            <span className="text-footnote text-slate-500 select-none shrink-0">
              {optionalText}
            </span>
          )}
        </div>
      )}

      <div className="relative w-full">
        {children}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-footnote text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="text-footnote text-slate-500 mt-0.5 select-none leading-normal"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
};

FieldShell.displayName = 'FieldShell';
