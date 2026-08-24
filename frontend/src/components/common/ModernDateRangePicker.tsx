'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  ArrowRight,
  Sun,
  CalendarDays,
  CalendarRange,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export type FilterMode = 'day' | 'month' | 'year' | 'custom';
export type DatePeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom' | 'day';

export interface DateRangeChangeParams {
  period: DatePeriod;
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface ModernDateRangePickerProps {
  period: DatePeriod;
  customFrom?: string;
  customTo?: string;
  onChange: (params: DateRangeChangeParams) => void;
  className?: string;
  align?: 'left' | 'right';
}

// ============================================================================
// DATE UTILITY HELPERS
// ============================================================================

export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalMonthStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function parseLocalDate(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function toLocalDateStr(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr.slice(0, 10);
  return getLocalDateStr(d);
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function computeDateRange(period: DatePeriod, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const formatDate = (d: Date) => getLocalDateStr(d);

  if (period === 'today') {
    const todayStr = formatDate(now);
    return { from: todayStr, to: todayStr };
  }
  if (period === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yStr = formatDate(y);
    return { from: yStr, to: yStr };
  }
  if (period === 'day') {
    const fromStr = customFrom || formatDate(now);
    return { from: fromStr, to: fromStr };
  }
  if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now);
    monday.setDate(diff);
    return { from: formatDate(monday), to: formatDate(now) };
  }
  if (period === 'month') {
    if (customFrom) {
      const d = parseLocalDate(customFrom);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from: formatDate(start), to: formatDate(end) };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatDate(start), to: formatDate(end) };
  }
  if (period === 'year') {
    if (customFrom) {
      const d = parseLocalDate(customFrom);
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear(), 11, 31);
      return { from: formatDate(start), to: formatDate(end) };
    }
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { from: formatDate(start), to: formatDate(end) };
  }
  return {
    from: customFrom || formatDate(now),
    to: customTo || formatDate(now),
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ModernDateRangePicker({
  period,
  customFrom,
  customTo,
  onChange,
  className = '',
  align = 'right',
}: ModernDateRangePickerProps) {
  const { t, locale } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  // Determine current active mode
  const currentMode: FilterMode = useMemo(() => {
    if (period === 'today' || period === 'yesterday' || period === 'day') return 'day';
    if (period === 'month') return 'month';
    if (period === 'year') return 'year';
    return 'custom';
  }, [period]);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);

  // Internal range state
  const initialRange = computeDateRange(period, customFrom, customTo);
  const [tempFrom, setTempFrom] = useState(initialRange.from);
  const [tempTo, setTempTo] = useState(initialRange.to);

  // For Year selector in Month mode
  const [monthPickerYear, setMonthPickerYear] = useState<number>(() => {
    return parseLocalDate(initialRange.from).getFullYear();
  });

  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo);
    setTempFrom(range.from);
    setTempTo(range.to);
    setMonthPickerYear(parseLocalDate(range.from).getFullYear());
  }, [period, customFrom, customTo]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Today & Yesterday comparison dates
  const todayStr = getLocalDateStr(new Date());
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterdayObj);

  // Current active range
  const currentRange = computeDateRange(period, customFrom, customTo);

  // ============================================================================
  // DISPLAY TITLE LOGIC
  // ============================================================================

  const displayTitle = useMemo(() => {
    const fromDate = parseLocalDate(currentRange.from);
    const toDate = parseLocalDate(currentRange.to);

    if (currentMode === 'day') {
      if (currentRange.from === todayStr) {
        return locale === 'vi' ? `Hôm nay (${formatDisplayDate(currentRange.from)})` : `Today (${formatDisplayDate(currentRange.from)})`;
      }
      if (currentRange.from === yesterdayStr) {
        return locale === 'vi' ? `Hôm qua (${formatDisplayDate(currentRange.from)})` : `Yesterday (${formatDisplayDate(currentRange.from)})`;
      }
      return formatDisplayDate(currentRange.from);
    }

    if (currentMode === 'month') {
      const currentMonthStr = getLocalMonthStr(new Date());
      const selectedMonthStr = getLocalMonthStr(fromDate);
      const monthNumber = String(fromDate.getMonth() + 1).padStart(2, '0');
      const year = fromDate.getFullYear();

      if (selectedMonthStr === currentMonthStr) {
        return locale === 'vi' ? `Tháng này (${monthNumber}/${year})` : `This Month (${monthNumber}/${year})`;
      }
      return locale === 'vi' ? `Tháng ${monthNumber}/${year}` : `Month ${monthNumber}/${year}`;
    }

    if (currentMode === 'year') {
      const currentYear = new Date().getFullYear();
      const selectedYear = fromDate.getFullYear();
      if (selectedYear === currentYear) {
        return locale === 'vi' ? `Năm nay (${selectedYear})` : `This Year (${selectedYear})`;
      }
      return locale === 'vi' ? `Năm ${selectedYear}` : `Year ${selectedYear}`;
    }

    // Custom mode
    if (currentRange.from === currentRange.to) {
      return formatDisplayDate(currentRange.from);
    }
    return `${formatDisplayDate(currentRange.from)} – ${formatDisplayDate(currentRange.to)}`;
  }, [currentMode, currentRange, todayStr, yesterdayStr, locale]);

  // Mode descriptions & labels
  const modeOptions: { mode: FilterMode; labelVi: string; labelEn: string; icon: React.ReactNode; descVi: string; descEn: string }[] = [
    {
      mode: 'day',
      labelVi: 'Ngày',
      labelEn: 'Day',
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      descVi: 'Lọc theo từng ngày cụ thể (tiến/lùi 1 ngày)',
      descEn: 'Filter by specific single day (step 1 day)',
    },
    {
      mode: 'month',
      labelVi: 'Tháng',
      labelEn: 'Month',
      icon: <CalendarDays className="w-4 h-4 text-indigo-500" />,
      descVi: 'Lọc theo từng tháng (tiến/lùi 1 tháng)',
      descEn: 'Filter by specific month (step 1 month)',
    },
    {
      mode: 'year',
      labelVi: 'Năm',
      labelEn: 'Year',
      icon: <Calendar className="w-4 h-4 text-emerald-500" />,
      descVi: 'Lọc theo cả năm (tiến/lùi 1 năm)',
      descEn: 'Filter by specific year (step 1 year)',
    },
    {
      mode: 'custom',
      labelVi: 'Tùy chỉnh',
      labelEn: 'Custom',
      icon: <SlidersHorizontal className="w-4 h-4 text-purple-500" />,
      descVi: 'Chọn khoảng thời gian tự do (Từ ngày - Đến ngày)',
      descEn: 'Custom date range (From Date - To Date)',
    },
  ];

  const currentModeInfo = modeOptions.find((m) => m.mode === currentMode) || modeOptions[0];

  // ============================================================================
  // PREVIOUS / NEXT ARROW NAVIGATION
  // ============================================================================

  const handleNavigate = (direction: 'prev' | 'next') => {
    const factor = direction === 'prev' ? -1 : 1;
    const fromDate = parseLocalDate(currentRange.from);

    if (currentMode === 'day') {
      const newD = new Date(fromDate);
      newD.setDate(newD.getDate() + factor);
      const newStr = getLocalDateStr(newD);
      const newPeriod: DatePeriod = newStr === todayStr ? 'today' : newStr === yesterdayStr ? 'yesterday' : 'day';
      onChange({ period: newPeriod, from: newStr, to: newStr });
      return;
    }

    if (currentMode === 'month') {
      const newMonthDate = new Date(fromDate.getFullYear(), fromDate.getMonth() + factor, 1);
      const start = new Date(newMonthDate.getFullYear(), newMonthDate.getMonth(), 1);
      const end = new Date(newMonthDate.getFullYear(), newMonthDate.getMonth() + 1, 0);
      onChange({
        period: 'month',
        from: getLocalDateStr(start),
        to: getLocalDateStr(end),
      });
      return;
    }

    if (currentMode === 'year') {
      const newYear = fromDate.getFullYear() + factor;
      const start = new Date(newYear, 0, 1);
      const end = new Date(newYear, 11, 31);
      onChange({
        period: 'year',
        from: getLocalDateStr(start),
        to: getLocalDateStr(end),
      });
      return;
    }

    if (currentMode === 'custom') {
      const toDate = parseLocalDate(currentRange.to);
      const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
      const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

      const newFrom = new Date(fromDate);
      newFrom.setDate(newFrom.getDate() + factor * diffDays);
      const newTo = new Date(toDate);
      newTo.setDate(newTo.getDate() + factor * diffDays);

      onChange({
        period: 'custom',
        from: getLocalDateStr(newFrom),
        to: getLocalDateStr(newTo),
      });
    }
  };

  // ============================================================================
  // SWITCH MODE HANDLER
  // ============================================================================

  const handleSwitchMode = (newMode: FilterMode) => {
    setIsModeMenuOpen(false);
    const now = new Date();

    if (newMode === 'day') {
      const targetStr = currentRange.from || getLocalDateStr(now);
      const newPeriod: DatePeriod = targetStr === todayStr ? 'today' : targetStr === yesterdayStr ? 'yesterday' : 'day';
      onChange({ period: newPeriod, from: targetStr, to: targetStr });
      return;
    }

    if (newMode === 'month') {
      const d = parseLocalDate(currentRange.from);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      onChange({
        period: 'month',
        from: getLocalDateStr(start),
        to: getLocalDateStr(end),
      });
      return;
    }

    if (newMode === 'year') {
      const d = parseLocalDate(currentRange.from);
      const start = new Date(d.getFullYear(), 0, 1);
      const end = new Date(d.getFullYear(), 11, 31);
      onChange({
        period: 'year',
        from: getLocalDateStr(start),
        to: getLocalDateStr(end),
      });
      return;
    }

    if (newMode === 'custom') {
      onChange({
        period: 'custom',
        from: currentRange.from,
        to: currentRange.to,
      });
      setIsPickerOpen(true);
    }
  };

  // Custom presets
  const customPresets: { labelVi: string; labelEn: string; getRange: () => { from: string; to: string } }[] = [
    {
      labelVi: 'Hôm nay',
      labelEn: 'Today',
      getRange: () => ({ from: todayStr, to: todayStr }),
    },
    {
      labelVi: 'Hôm qua',
      labelEn: 'Yesterday',
      getRange: () => ({ from: yesterdayStr, to: yesterdayStr }),
    },
    {
      labelVi: '7 ngày qua',
      labelEn: 'Last 7 days',
      getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return { from: getLocalDateStr(d), to: todayStr };
      },
    },
    {
      labelVi: '30 ngày qua',
      labelEn: 'Last 30 days',
      getRange: () => {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return { from: getLocalDateStr(d), to: todayStr };
      },
    },
    {
      labelVi: 'Tuần này',
      labelEn: 'This week',
      getRange: () => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return { from: getLocalDateStr(monday), to: todayStr };
      },
    },
    {
      labelVi: 'Tháng này',
      labelEn: 'This month',
      getRange: () => {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return { from: getLocalDateStr(start), to: getLocalDateStr(end) };
      },
    },
  ];

  return (
    <div className={`relative inline-block text-xs max-w-full w-full sm:w-auto ${className}`} ref={containerRef}>
      {/* Container: Justified on Mobile, Inline Flex on Desktop */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full justify-between sm:justify-start">
        
        {/* ========================================================================= */}
        {/* 1. DATE NAVIGATOR CONTROL: [ < ] [ Display Date ] [ > ]                   */}
        {/* ========================================================================= */}
        <div className="flex items-center bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-slate-300 transition-all p-1 flex-1 min-w-0 sm:flex-initial">
          {/* Previous Arrow */}
          <button
            type="button"
            onClick={() => handleNavigate('prev')}
            title={locale === 'vi' ? 'Lùi thời gian' : 'Previous period'}
            aria-label="Previous period"
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/80 active:scale-90 transition-all shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 sm:w-4 sm:h-4" />
          </button>

          {/* Center Date Text (Click to open picker) */}
          <button
            type="button"
            onClick={() => {
              setIsModeMenuOpen(false);
              setIsPickerOpen(!isPickerOpen);
            }}
            className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 text-slate-800 font-bold hover:text-indigo-600 transition flex-1 min-w-0 truncate cursor-pointer select-none"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0 hidden xs:inline-block" />
            <span className="truncate text-xs sm:text-xs tracking-tight">
              {displayTitle}
            </span>
          </button>

          {/* Next Arrow */}
          <button
            type="button"
            onClick={() => handleNavigate('next')}
            title={locale === 'vi' ? 'Tiến thời gian' : 'Next period'}
            aria-label="Next period"
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/80 active:scale-90 transition-all shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 2. MODE SELECTOR BUTTON (NGÀY / THÁNG / NĂM / TUỲ CHỈNH)                    */}
        {/* ========================================================================= */}
        <div className="relative shrink-0" ref={modeMenuRef}>
          <button
            type="button"
            onClick={() => {
              setIsPickerOpen(false);
              setIsModeMenuOpen(!isModeMenuOpen);
            }}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold px-2.5 sm:px-3 py-2 rounded-2xl border border-slate-200/90 shadow-xs transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-95 cursor-pointer shrink-0"
            title={locale === 'vi' ? 'Thay đổi chế độ lọc thời gian' : 'Change filter mode'}
          >
            <span className="shrink-0">{currentModeInfo.icon}</span>
            <span className="text-xs font-black text-slate-800">
              {locale === 'vi' ? currentModeInfo.labelVi : currentModeInfo.labelEn}
            </span>
            <ChevronDown className={`w-3 h-3 text-slate-400 shrink-0 transition-transform duration-200 ${isModeMenuOpen ? 'rotate-180 text-indigo-600' : ''}`} />
          </button>

          {/* Mode Dropdown Menu */}
          {isModeMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs sm:hidden"
                onClick={() => setIsModeMenuOpen(false)}
              />
              <div
                className={`fixed inset-x-3 bottom-4 sm:bottom-auto sm:top-full sm:translate-y-1 z-50 sm:w-64 sm:absolute ${
                  align === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
                } bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 text-slate-800 animate-in fade-in-0 zoom-in-95 duration-150`}
              >
                <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {locale === 'vi' ? 'Chế độ lọc thời gian' : 'Time Filter Mode'}
                  </p>
                </div>
                <div className="space-y-1">
                  {modeOptions.map((opt) => {
                    const isSelected = currentMode === opt.mode;
                    return (
                      <button
                        key={opt.mode}
                        type="button"
                        onClick={() => handleSwitchMode(opt.mode)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 font-black border border-indigo-100 shadow-2xs'
                            : 'hover:bg-slate-50 text-slate-700 font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 p-1 bg-white rounded-lg border border-slate-100 shadow-2xs">{opt.icon}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-800">
                              {locale === 'vi' ? opt.labelVi : opt.labelEn}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {locale === 'vi' ? opt.descVi : opt.descEn}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL / POPOVER FOR CHOOSING SPECIFIC DATE / MONTH / YEAR / RANGE        */}
      {/* ========================================================================= */}
      {isPickerOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs sm:hidden animate-in fade-in-0 duration-150"
            onClick={() => setIsPickerOpen(false)}
          />
          <div
            className={`fixed inset-x-0 bottom-0 sm:bottom-auto sm:top-full sm:translate-y-1.5 z-50 w-full sm:max-w-none sm:w-88 sm:absolute ${
              align === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
            } bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 pb-safe sm:pb-4 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 text-slate-800`}
          >
            {/* Mobile Drag Indicator */}
            <div className="flex justify-center sm:hidden pt-0 pb-2">
              <div className="w-12 h-1 bg-slate-200 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs">
                {currentModeInfo.icon}
                <span>
                  {currentMode === 'day' && (locale === 'vi' ? 'Chọn ngày cụ thể' : 'Select Specific Day')}
                  {currentMode === 'month' && (locale === 'vi' ? 'Chọn tháng cụ thể' : 'Select Specific Month')}
                  {currentMode === 'year' && (locale === 'vi' ? 'Chọn năm cụ thể' : 'Select Specific Year')}
                  {currentMode === 'custom' && (locale === 'vi' ? 'Chọn khoảng ngày tùy chỉnh' : 'Select Custom Range')}
                </span>
              </div>
              <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                {locale === 'vi' ? currentModeInfo.labelVi : currentModeInfo.labelEn}
              </span>
            </div>

            {/* =================================================================== */}
            {/* MODE: DAY PICKER                                                    */}
            {/* =================================================================== */}
            {currentMode === 'day' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ period: 'today', from: todayStr, to: todayStr });
                      setIsPickerOpen(false);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      currentRange.from === todayStr
                        ? 'bg-amber-500 text-white border-amber-600 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{locale === 'vi' ? 'Hôm nay' : 'Today'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ period: 'yesterday', from: yesterdayStr, to: yesterdayStr });
                      setIsPickerOpen(false);
                    }}
                    className={`py-2 px-3 rounded-xl font-bold text-xs border text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      currentRange.from === yesterdayStr
                        ? 'bg-amber-500 text-white border-amber-600 font-black shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{locale === 'vi' ? 'Hôm qua' : 'Yesterday'}</span>
                  </button>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-1.5">
                    {locale === 'vi' ? 'Chọn ngày trên lịch' : 'Pick a Date'}
                  </label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      setTempFrom(val);
                      setTempTo(val);
                      const newPeriod: DatePeriod = val === todayStr ? 'today' : val === yesterdayStr ? 'yesterday' : 'day';
                      onChange({ period: newPeriod, from: val, to: val });
                      setIsPickerOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px] shadow-2xs cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* MODE: MONTH PICKER                                                  */}
            {/* =================================================================== */}
            {currentMode === 'month' && (
              <div className="space-y-3">
                {/* Year Header Navigator in Month Mode */}
                <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setMonthPickerYear((y) => y - 1)}
                    className="p-1 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-600 transition cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-extrabold text-xs text-slate-800">
                    {locale === 'vi' ? `Năm ${monthPickerYear}` : `Year ${monthPickerYear}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMonthPickerYear((y) => y + 1)}
                    className="p-1 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-600 transition cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* 12 Months Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const start = new Date(monthPickerYear, m - 1, 1);
                    const end = new Date(monthPickerYear, m, 0);
                    const startStr = getLocalDateStr(start);
                    const endStr = getLocalDateStr(end);
                    const isSelected = currentRange.from === startStr && currentRange.to === endStr;
                    const isCurrentMonth =
                      new Date().getFullYear() === monthPickerYear && new Date().getMonth() + 1 === m;

                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          onChange({
                            period: 'month',
                            from: startStr,
                            to: endStr,
                          });
                          setIsPickerOpen(false);
                        }}
                        className={`py-2.5 px-2 rounded-xl text-center font-bold text-xs transition cursor-pointer relative ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : isCurrentMonth
                            ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                        }`}
                      >
                        <span>{locale === 'vi' ? `Tháng ${m}` : `M${m}`}</span>
                        {isCurrentMonth && !isSelected && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* MODE: YEAR PICKER                                                   */}
            {/* =================================================================== */}
            {currentMode === 'year' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[-2, -1, 0, 1, 2, 3].map((offset) => {
                    const y = new Date().getFullYear() + offset;
                    const start = new Date(y, 0, 1);
                    const end = new Date(y, 11, 31);
                    const startStr = getLocalDateStr(start);
                    const isSelected = currentRange.from.startsWith(String(y));
                    const isThisYear = y === new Date().getFullYear();

                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          onChange({
                            period: 'year',
                            from: startStr,
                            to: getLocalDateStr(end),
                          });
                          setIsPickerOpen(false);
                        }}
                        className={`py-3 px-2 rounded-xl text-center font-bold text-xs transition cursor-pointer relative ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs font-black'
                            : isThisYear
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                        }`}
                      >
                        <div className="text-sm font-black">{y}</div>
                        {isThisYear && (
                          <div className="text-[9px] text-emerald-600 font-bold">
                            {locale === 'vi' ? 'Năm nay' : 'This year'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* MODE: CUSTOM RANGE PICKER                                           */}
            {/* =================================================================== */}
            {currentMode === 'custom' && (
              <div className="space-y-3">
                {/* Presets Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  {customPresets.map((preset, idx) => {
                    const r = preset.getRange();
                    const isSelected = currentRange.from === r.from && currentRange.to === r.to;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTempFrom(r.from);
                          setTempTo(r.to);
                          onChange({ period: 'custom', from: r.from, to: r.to });
                          setIsPickerOpen(false);
                        }}
                        className={`py-2 px-1.5 rounded-xl font-bold text-[11px] transition text-center flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-2xs font-black'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{locale === 'vi' ? preset.labelVi : preset.labelEn}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Inputs */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="min-w-0">
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase flex items-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block"></span>
                        {locale === 'vi' ? 'Từ ngày' : 'From Date'}
                      </label>
                      <input
                        type="date"
                        value={tempFrom}
                        onChange={(e) => setTempFrom(e.target.value)}
                        className="w-full min-w-0 px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[38px] shadow-2xs cursor-pointer"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase flex items-center gap-1 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        {locale === 'vi' ? 'Đến ngày' : 'To Date'}
                      </label>
                      <input
                        type="date"
                        value={tempTo}
                        onChange={(e) => setTempTo(e.target.value)}
                        className="w-full min-w-0 px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[38px] shadow-2xs cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onChange({ period: 'custom', from: tempFrom, to: tempTo });
                      setIsPickerOpen(false);
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-black py-2.5 px-3 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 text-xs cursor-pointer"
                  >
                    <span>{locale === 'vi' ? 'Áp dụng khoảng ngày' : 'Apply Range'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
