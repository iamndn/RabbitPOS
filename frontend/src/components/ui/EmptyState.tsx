import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Custom Lucide icon or illustration node */
  icon?: React.ReactNode;
  /** Primary sentence-case heading */
  title: React.ReactNode;
  /** Optional supporting explanation */
  description?: React.ReactNode;
  /** Optional primary/secondary CTA capsule button */
  action?: React.ReactNode;
  /** Compact padding for inline drawers, sheets, or widgets */
  compact?: boolean;
  /** Wrap in an opaque card surface instead of plain transparent container */
  surface?: 'plain' | 'card';
}

/**
 * Tahoe Empty State (`01-component-catalog.md` §13):
 * Strictly opaque (`0px` blur), concentric icon well, sentence-case typography.
 */
export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      title,
      description,
      action,
      compact = false,
      surface = 'plain',
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center text-center font-sans',
          compact ? 'px-4 py-7' : 'px-6 py-12',
          surface === 'card' &&
            'bg-surface-card rounded-card border border-card shadow-card',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'rounded-2xl bg-surface-grouped border border-hairline text-slate-500 flex items-center justify-center shrink-0',
            compact ? 'w-10 h-10 mb-3' : 'w-12 h-12 mb-3.5'
          )}
          aria-hidden="true"
        >
          {icon || <Inbox className={compact ? 'w-5 h-5' : 'w-6 h-6'} />}
        </div>

        <h3
          className={cn(
            'font-semibold text-slate-900',
            compact ? 'text-headline' : 'text-title-3'
          )}
        >
          {title}
        </h3>

        {description && (
          <p className="text-subhead text-slate-500 max-w-sm mt-1 leading-relaxed">
            {description}
          </p>
        )}

        {action && <div className="mt-4 flex items-center justify-center gap-2">{action}</div>}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
