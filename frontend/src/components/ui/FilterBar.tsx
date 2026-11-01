'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import HorizontalScroller from '@/components/common/HorizontalScroller';
import { ResponsiveSheet } from './ResponsiveSheet';
import { Button } from './Button';
import { Badge } from './Badge';
import { cn } from '@/lib/cn';

export interface FilterBarProps {
  /** Controlled search value (if using built-in search) */
  searchValue?: string;
  /** Search value change handler (if using built-in search) */
  onSearchChange?: (value: string) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Custom search slot (overrides built-in search input) */
  searchSlot?: React.ReactNode;
  /** Chips / Quick pills slot (automatically wrapped in HorizontalScroller) */
  chipsSlot?: React.ReactNode;
  /** Filter controls: rendered inline on desktop (md+) and stacked inside bottom sheet on mobile (<md) */
  filters?: React.ReactNode;
  /** Actions slot on the right (e.g. Date picker, Export button, Add button) */
  actionsSlot?: React.ReactNode;
  /** Number of active filters applied (shows badge on mobile filter button) */
  activeFiltersCount?: number;
  /** Callback when user clicks Reset in mobile filter sheet */
  onReset?: () => void;
  /** Callback when user clicks Apply in mobile filter sheet */
  onApply?: () => void;
  /** Custom title for mobile filter sheet */
  sheetTitle?: string;
  /** Additional wrapper class names */
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchSlot,
  chipsSlot,
  filters,
  actionsSlot,
  activeFiltersCount = 0,
  onReset,
  onApply,
  sheetTitle,
  className,
}) => {
  const { t } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const hasSearch = searchSlot !== undefined || (searchValue !== undefined && onSearchChange !== undefined);
  const hasFilters = Boolean(filters);

  const handleApply = () => {
    onApply?.();
    setIsSheetOpen(false);
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <div className={cn('w-full space-y-2', className)}>
      {/* ─── Top Bar: Search + Filters + Actions ─────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        {/* Left Section: Search & Filters */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* 1. Search Box */}
          {hasSearch && (
            <div className="flex-1 md:flex-initial md:w-72 min-w-0">
              {searchSlot ? (
                searchSlot
              ) : (
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchValue || ''}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder={searchPlaceholder || t('common.search_placeholder') || 'Tìm kiếm...'}
                    className="w-full h-11 md:h-9.5 pl-9 pr-8 text-base md:text-xs rounded-xl border border-slate-200/90 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-600 shadow-2xs transition"
                  />
                  {searchValue && (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
                      aria-label="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. Desktop Inline Filters (md+) */}
          {hasFilters && (
            <div className="hidden md:flex items-center gap-2 flex-wrap">
              {filters}
            </div>
          )}

          {/* 3. Mobile "Filters" Sheet Trigger Button (< md) */}
          {hasFilters && (
            <div className="md:hidden shrink-0">
              <Button
                variant={activeFiltersCount > 0 ? 'soft' : 'secondary'}
                size="md"
                onClick={() => setIsSheetOpen(true)}
                className="h-11 px-3.5 font-bold gap-1.5"
                aria-label={t('common.filters_title') || 'Bộ lọc nâng cao'}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{t('common.filter_button') || 'Bộ lọc'}</span>
                {activeFiltersCount > 0 && (
                  <Badge variant="brand" size="sm" className="ml-0.5 px-1.5 py-0.2 font-black">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Right Section: Actions (Date picker, Export, Add, etc.) */}
        {actionsSlot && (
          <div className="flex items-center gap-2 shrink-0 justify-end">
            {actionsSlot}
          </div>
        )}
      </div>

      {/* ─── Bottom Bar: Horizontal Quick Filter Chips (if provided) ─────── */}
      {chipsSlot && (
        <div className="w-full min-w-0 pt-0.5">
          <HorizontalScroller gradientFade showArrows className="gap-1.5 py-0.5">
            {chipsSlot}
          </HorizontalScroller>
        </div>
      )}

      {/* ─── Mobile Bottom Sheet for Stacked Filters (< md) ──────────────── */}
      {hasFilters && (
        <ResponsiveSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-700" />
              <span>{sheetTitle || t('common.filters_title') || 'Bộ lọc nâng cao'}</span>
              {activeFiltersCount > 0 && (
                <Badge variant="brand" size="sm">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
          }
          footer={
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleReset}
                className="w-full font-bold gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('common.reset_filters') || 'Đặt lại'}</span>
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={handleApply}
                className="w-full font-bold"
              >
                <span>
                  {t('common.apply_filters') || 'Áp dụng'}
                  {activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                </span>
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            {filters}
          </div>
        </ResponsiveSheet>
      )}
    </div>
  );
};

FilterBar.displayName = 'FilterBar';
