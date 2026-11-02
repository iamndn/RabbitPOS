import React from 'react';
import { cn } from '@/lib/cn';

export type SkeletonRadius = 'xs' | 'sm' | 'field' | 'card' | 'panel' | 'capsule';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: SkeletonRadius;
}

const radiusClasses: Record<SkeletonRadius, string> = {
  xs: 'rounded-xs',
  sm: 'rounded-sm-tahoe',
  field: 'rounded-field',
  card: 'rounded-card',
  panel: 'rounded-panel',
  capsule: 'rounded-full',
};

/**
 * Tahoe Skeleton Placeholder (`01-component-catalog.md` §13):
 * Strictly opaque (`0px` blur), concentric radii, reduced-motion safe via globals.css.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ rounded = 'sm', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn(
          'bg-slate-200/75 animate-pulse',
          radiusClasses[rounded],
          className
        )}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export const SkeletonCard: React.FC<{ className?: string; lines?: number }> = ({
  className,
  lines = 3,
}) => (
  <div
    aria-hidden="true"
    className={cn(
      'bg-surface-card rounded-card border border-card shadow-card p-4 space-y-3',
      className
    )}
  >
    <div className="flex items-center justify-between gap-3">
      <Skeleton rounded="capsule" className="h-4 w-28" />
      <Skeleton rounded="capsule" className="h-5 w-16" />
    </div>
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          rounded="xs"
          className={cn('h-3.5', idx === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  </div>
);

SkeletonCard.displayName = 'SkeletonCard';

export const SkeletonListGroup: React.FC<{ rows?: number; className?: string }> = ({
  rows = 3,
  className,
}) => (
  <div
    aria-hidden="true"
    className={cn(
      'bg-surface-card rounded-card border border-card shadow-card divide-y divide-hairline overflow-hidden',
      className
    )}
  >
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className="min-h-[48px] md:min-h-[42px] px-4 py-2.5 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Skeleton rounded="field" className="w-8 h-8 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton rounded="xs" className="h-3.5 w-36 max-w-full" />
            <Skeleton rounded="xs" className="h-2.5 w-24 max-w-full" />
          </div>
        </div>
        <Skeleton rounded="capsule" className="h-4 w-16 shrink-0" />
      </div>
    ))}
  </div>
);

SkeletonListGroup.displayName = 'SkeletonListGroup';

