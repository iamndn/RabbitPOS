import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ListGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional sentence-case group header rendered above the inset card */
  header?: React.ReactNode;
  /** Optional trailing action aligned with the group header */
  headerAction?: React.ReactNode;
  /** Optional footnote helper rendered below the inset card */
  footer?: React.ReactNode;
  /** Extra classes for the inner <ul> list surface */
  listClassName?: string;
}

/**
 * Tahoe Inset Grouped List Container (`P3` & `01-component-catalog.md` §13):
 * Strictly opaque `--surface-card` (`#FFFFFF`, `0px` backdrop-filter), `rounded-card` (`16px`),
 * hairline border `border-card`, and subtle `shadow-card`.
 */
export const ListGroup = React.forwardRef<HTMLDivElement, ListGroupProps>(
  ({ header, headerAction, footer, className, listClassName, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('w-full font-sans', className)} {...props}>
        {(header || headerAction) && (
          <div className="flex items-center justify-between gap-2 px-1.5 mb-1.5">
            {header && (
              <div className="text-subhead font-semibold text-slate-600">
                {header}
              </div>
            )}
            {headerAction && <div className="shrink-0">{headerAction}</div>}
          </div>
        )}

        <ul
          className={cn(
            'bg-surface-card rounded-card border border-card shadow-card overflow-hidden',
            'divide-y divide-hairline m-0 p-0 list-none',
            listClassName
          )}
        >
          {children}
        </ul>

        {footer && (
          <p className="text-footnote text-slate-500 px-1.5 mt-1.5 leading-relaxed">
            {footer}
          </p>
        )}
      </div>
    );
  }
);

ListGroup.displayName = 'ListGroup';

export interface ListRowProps {
  /** Leading icon, avatar, or badge */
  leading?: React.ReactNode;
  /** Primary row label */
  title: React.ReactNode;
  /** Secondary helper description */
  subtitle?: React.ReactNode;
  /** Right-aligned numeric or status value (rendered with tabular-nums) */
  value?: React.ReactNode;
  /** Custom trailing control (e.g., Switch, Badge, Button) */
  trailing?: React.ReactNode;
  /** Show a disclosure chevron on the far right */
  chevron?: boolean;
  /** Makes the entire row an accessible button */
  onClick?: () => void;
  /** Active/selected row highlight */
  selected?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Destructive red label styling */
  destructive?: boolean;
  className?: string;
  'aria-label'?: string;
}

export const ListRow: React.FC<ListRowProps> = ({
  leading,
  title,
  subtitle,
  value,
  trailing,
  chevron = false,
  onClick,
  selected = false,
  disabled = false,
  destructive = false,
  className,
  'aria-label': ariaLabel,
}) => {
  const isInteractive = Boolean(onClick);

  const rowContent = (
    <>
      {leading && (
        <div
          className={cn(
            'shrink-0 flex items-center justify-center',
            destructive ? 'text-rose-600' : selected ? 'text-brand-700' : 'text-slate-500'
          )}
        >
          {leading}
        </div>
      )}

      <div className="flex-1 min-w-0 text-left">
        <div
          className={cn(
            'text-body font-medium leading-snug truncate',
            destructive
              ? 'text-rose-600'
              : selected
                ? 'text-brand-700 font-semibold'
                : 'text-slate-900'
          )}
        >
          {title}
        </div>
        {subtitle && (
          <div className="text-footnote text-slate-500 mt-0.5 leading-snug line-clamp-2">
            {subtitle}
          </div>
        )}
      </div>

      {(value !== undefined || trailing || chevron) && (
        <div className="shrink-0 flex items-center gap-2 ml-2">
          {value !== undefined && (
            <span
              className={cn(
                'font-num text-subhead font-medium',
                selected ? 'text-brand-700 font-semibold' : 'text-slate-600'
              )}
            >
              {value}
            </span>
          )}
          {trailing}
          {chevron && (
            <ChevronRight
              className="w-4 h-4 text-slate-400 shrink-0"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </>
  );

  const sharedClasses = cn(
    'w-full min-h-[48px] md:min-h-[42px] px-4 py-2.5 flex items-center justify-between gap-3 font-sans',
    selected && 'bg-brand-50/75',
    disabled && 'opacity-50 pointer-events-none',
    className
  );

  if (isInteractive) {
    return (
      <li className="m-0 p-0">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-pressed={selected || undefined}
          className={cn(
            sharedClasses,
            'transition-colors duration-press ease-press',
            !selected && 'hover:bg-slate-50/90 active:bg-slate-100/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/45'
          )}
        >
          {rowContent}
        </button>
      </li>
    );
  }

  return (
    <li aria-label={ariaLabel} className={sharedClasses}>
      {rowContent}
    </li>
  );
};

ListRow.displayName = 'ListRow';
