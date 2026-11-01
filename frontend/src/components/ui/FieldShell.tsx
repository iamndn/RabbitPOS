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
  className,
  children,
}) => {
  const hintId = id ? `${id}-hint` : undefined;
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5 w-full font-sans', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={id}
            className="text-xs md:text-xs font-semibold text-slate-700 tracking-wide select-none"
          >
            {label}
            {required && (
              <span className="text-rose-500 ml-1 font-bold" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {optionalText && (
            <span className="text-caption text-slate-400 select-none">
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
          className="text-caption md:text-xs text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-fadeIn"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="text-caption md:text-xs text-slate-500 mt-0.5 select-none"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
};

FieldShell.displayName = 'FieldShell';
