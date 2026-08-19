'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface ModernSelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'blue';
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
}

export default function ModernSelect({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  leadingIcon,
  disabled = false,
  clearable = false,
  className = '',
  dropdownClassName = '',
  size = 'md',
  align = 'left',
}: ModernSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dropdownPlacement, setDropdownPlacement] = useState<'left' | 'right'>(align);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect placement on open to prevent right-edge overflow on mobile
  useEffect(() => {
    if (!isOpen) return;
    const updatePlacement = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        if (align === 'right' || rect.left + 210 > viewportWidth - 12) {
          setDropdownPlacement('right');
        } else {
          setDropdownPlacement('left');
        }
      }
    };
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    return () => window.removeEventListener('resize', updatePlacement);
  }, [isOpen, align]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen, searchable]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  const getBadgeStyle = (color?: string) => {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'blue':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'indigo':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const sizeClasses = {
    sm: 'py-1.5 px-2.5 text-xs',
    md: 'py-2 px-3 text-xs sm:text-sm',
    lg: 'py-3 px-4 text-sm',
  };

  return (
    <div ref={containerRef} className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full bg-white border border-slate-200 rounded-xl flex items-center justify-between text-left font-medium text-slate-800 transition shadow-sm hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
          isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''
        } ${sizeClasses[size]} ${className}`}
      >
        <div
          className="flex items-center gap-2 truncate pr-1 min-w-0 flex-1"
          title={selectedOption ? selectedOption.label : placeholder}
        >
          {leadingIcon && <span className="flex-shrink-0 text-slate-400">{leadingIcon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate min-w-0">
              {selectedOption.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
              <span className="truncate font-semibold text-slate-900">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${getBadgeStyle(selectedOption.badgeColor)}`}>
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition"
              title="Xóa lựa chọn"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <>
          {/* Mobile backdrop for easy dismissal */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/10 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 ${
              dropdownPlacement === 'right' ? 'right-0 left-auto' : 'left-0 right-auto'
            } ${dropdownClassName}`}
            style={{ minWidth: 'max(100%, 200px)', maxWidth: 'calc(100vw - 1.5rem)' }}
          >
            {/* Search Box */}
            {searchable && (
              <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-medium">Không tìm thấy kết quả</div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = String(option.value) === String(value);

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      disabled={option.disabled}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between text-xs transition ${
                        option.disabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-50'
                          : isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-100'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 pr-2 min-w-0 flex-1">
                        {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`${isSelected ? 'font-bold text-indigo-600' : 'font-medium text-slate-900'} leading-tight break-words`}>
                              {option.label}
                            </span>
                            {option.badge && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border flex-shrink-0 ${getBadgeStyle(option.badgeColor)}`}>
                                {option.badge}
                              </span>
                            )}
                          </div>
                          {option.subLabel && <span className="text-[11px] text-slate-400 block mt-0.5">{option.subLabel}</span>}
                        </div>
                      </div>

                      {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

