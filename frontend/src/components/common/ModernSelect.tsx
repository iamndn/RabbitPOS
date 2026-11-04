'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';
import { cn } from '@/lib/cn';

export interface ModernSelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: 'indigo' | 'purple' | 'amber' | 'rose' | 'slate' | 'blue';
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ModernSelectProps {
  options: ModernSelectOption[];
  value: string | number | null | undefined;
  onChange: (value: any) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  leadingIcon?: React.ReactNode;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  id?: string;
  title?: string;
}

export default function ModernSelect({
  options = [],
  value,
  onChange,
  placeholder,
  searchable = false,
  searchPlaceholder,
  leadingIcon,
  disabled = false,
  clearable = false,
  className = '',
  dropdownClassName = '',
  size = 'md',
  align = 'left',
  id,
  title,
}: ModernSelectProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  // Type-ahead buffer
  const typeaheadBuffer = useRef<string>('');
  const typeaheadTimeout = useRef<NodeJS.Timeout | null>(null);

  // Localized defaults
  const placeholderText = placeholder ?? t('common.select_placeholder') ?? 'Chọn...';
  const searchPlaceholderText =
    searchPlaceholder ?? t('common.search_placeholder') ?? 'Tìm kiếm...';
  const noResultsText = t('common.no_results') ?? 'Không tìm thấy kết quả';
  const clearText = t('common.clear_selection') ?? 'Xóa lựa chọn';
  const selectTitleText = title || placeholderText;

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  // Reset search and focused index when opening/closing
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((opt) => String(opt.value) === String(value));
      setFocusedIndex(idx >= 0 ? idx : 0);
      if (searchable) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 60);
      }
    } else {
      setSearchQuery('');
      setFocusedIndex(-1);
    }
  }, [isOpen, searchable, value, filteredOptions]);

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      onChange(optionValue);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp' ||
        e.key === 'Enter' ||
        e.key === ' '
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next].disabled) {
            next++;
          }
          return next < filteredOptions.length ? next : prev;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next].disabled) {
            next--;
          }
          return next >= 0 ? next : prev;
        });
        break;

      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
        break;

      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const opt = filteredOptions[focusedIndex];
          if (!opt.disabled) handleSelect(opt.value);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;

      default:
        if (e.key.length === 1 && !searchable) {
          typeaheadBuffer.current += e.key.toLowerCase();
          if (typeaheadTimeout.current) clearTimeout(typeaheadTimeout.current);
          typeaheadTimeout.current = setTimeout(() => {
            typeaheadBuffer.current = '';
          }, 600);

          const matchIdx = filteredOptions.findIndex(
            (opt) =>
              !opt.disabled && opt.label.toLowerCase().startsWith(typeaheadBuffer.current)
          );
          if (matchIdx >= 0) setFocusedIndex(matchIdx);
        }
        break;
    }
  };

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'purple':
      case 'indigo':
        return 'bg-brand-50 text-brand-700 border-brand-200/80';
      case 'amber':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
      case 'blue':
        return 'bg-sky-50 text-sky-700 border-sky-200/80';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200/80';
    }
  };

  const sizeClasses = {
    sm: 'h-10 md:h-8 px-3 md:px-2.5 text-sm md:text-xs rounded-xl md:rounded-sm-tahoe',
    md: 'h-11 md:h-9 px-3.5 text-base md:text-sm rounded-field',
    lg: 'h-12 md:h-11 px-4 text-base md:text-sm rounded-field',
  };

  const listboxId = id ? `${id}-listbox` : 'modern-select-listbox';

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full font-sans', disabled && 'opacity-60 cursor-not-allowed')}
    >
      {/* Opaque Trigger Control (0px blur, Pre-Flight Item 5: 0px resting input shadow) */}
      <button
        ref={triggerButtonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={selectedOption ? selectedOption.label : placeholderText}
        className={cn(
          'w-full bg-surface-card border border-slate-300/80 flex items-center justify-between text-left font-medium text-slate-900 transition-colors',
          'hover:border-slate-400/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:border-brand-600',
          isOpen && 'ring-2 ring-brand-500/25 border-brand-600',
          sizeClasses[size],
          className
        )}
      >
        <div className="flex items-center gap-2 truncate pr-1 min-w-0 flex-1">
          {leadingIcon && <span className="shrink-0 text-slate-400">{leadingIcon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate min-w-0">
              {selectedOption.icon && <span className="shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-semibold text-slate-900">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={cn(
                    'text-caption px-2 py-0.5 rounded-full border shrink-0',
                    getBadgeStyle(selectedOption.badgeColor)
                  )}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholderText}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e as any);
              }}
              className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              title={clearText}
              aria-label={clearText}
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 text-slate-400 transition-transform duration-snappy ease-spring-snappy',
              isOpen && 'rotate-180 text-brand-600'
            )}
          />
        </div>
      </button>

      {/* Sheet on Mobile (< md) / Popover on Desktop (md+) */}
      <ResponsiveSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerButtonRef}
        title={selectTitleText}
        detent="large"
        align={align === 'right' ? 'end' : 'start'}
        width="w-full min-w-[240px] max-w-[calc(100vw-1.5rem)]"
        sheetClassName="max-h-[72dvh]"
        popoverClassName={cn('w-full min-w-[220px] max-w-[calc(100vw-1.5rem)]', dropdownClassName)}
      >
        <div className="flex flex-col h-full -m-2 sm:m-0" onKeyDown={handleKeyDown}>
          {/* Capsule Search Box (Opaque sticky header inside glass sheet — 0 extra blur) */}
          {searchable && (
            <div className="p-2 sm:p-1.5 border-b border-hairline bg-surface-card/95 sticky top-0 z-content-sticky shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 md:w-3.5 md:h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholderText}
                  className="w-full pl-9 pr-8 h-10 md:h-8 bg-surface-card border border-slate-300/80 rounded-full text-base md:text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus:border-brand-600 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={clearText}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar min-h-0"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-footnote md:text-subhead text-slate-500 font-medium">
                {noResultsText}
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = String(option.value) === String(value);
                const isFocused = idx === focusedIndex;

                return (
                  <button
                    key={String(option.value)}
                    role="option"
                    type="button"
                    disabled={option.disabled}
                    aria-selected={isSelected}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    className={cn(
                      'w-full text-left flex items-center justify-between transition-colors rounded-field font-sans',
                      'min-h-[48px] md:min-h-[38px] px-3.5 py-2.5 md:px-3 md:py-2 text-sm md:text-xs',
                      option.disabled && 'opacity-40 cursor-not-allowed bg-slate-50/70',
                      isSelected
                        ? 'bg-brand-glass-pill text-brand-800 font-semibold border border-brand-200/80'
                        : isFocused
                          ? 'bg-slate-900/[0.06] text-slate-900'
                          : 'text-slate-700 hover:bg-slate-900/[0.05] hover:text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-2.5 pr-2 min-w-0 flex-1">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              'leading-snug break-words',
                              isSelected ? 'font-semibold text-brand-700' : 'font-medium text-slate-900'
                            )}
                          >
                            {option.label}
                          </span>
                          {option.badge && (
                            <span
                              className={cn(
                                'text-caption px-2 py-0.5 rounded-full border shrink-0',
                                getBadgeStyle(option.badgeColor)
                              )}
                            >
                              {option.badge}
                            </span>
                          )}
                        </div>
                        {option.subLabel && (
                          <span className="text-footnote text-slate-500 block mt-0.5">
                            {option.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}
