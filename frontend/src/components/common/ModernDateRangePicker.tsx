'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export type DatePeriod = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

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

export function toLocalDateStr(isoStr?: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr.slice(0, 10);
  return getLocalDateStr(d);
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
  if (period === 'week') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now);
    monday.setDate(diff);
    return { from: formatDate(monday), to: formatDate(now) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDate(start), to: formatDate(now) };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { from: formatDate(start), to: formatDate(now) };
  }
  return {
    from: customFrom || formatDate(now),
    to: customTo || formatDate(now),
  };
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function ModernDateRangePicker({
  period,
  customFrom,
  customTo,
  onChange,
  className = '',
  align = 'right',
}: ModernDateRangePickerProps) {
  const { t, locale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialRange = computeDateRange(period, customFrom, customTo);
  const [tempFrom, setTempFrom] = useState(initialRange.from);
  const [tempTo, setTempTo] = useState(initialRange.to);

  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo);
    setTempFrom(range.from);
    setTempTo(range.to);
  }, [period, customFrom, customTo]);

  // Click outside to dismiss popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const presets: { key: DatePeriod; labelVi: string; labelEn: string }[] = [
    { key: 'today', labelVi: 'Hôm nay', labelEn: 'Today' },
    { key: 'yesterday', labelVi: 'Hôm qua', labelEn: 'Yesterday' },
    { key: 'week', labelVi: 'Tuần này', labelEn: 'This Week' },
    { key: 'month', labelVi: 'Tháng này', labelEn: 'This Month' },
    { key: 'year', labelVi: 'Năm nay', labelEn: 'This Year' },
    { key: 'custom', labelVi: 'Tùy chỉnh', labelEn: 'Custom' },
  ];

  const handleSelectPreset = (p: DatePeriod) => {
    if (p === 'custom') {
      onChange({ period: 'custom', from: tempFrom, to: tempTo });
    } else {
      const range = computeDateRange(p);
      setTempFrom(range.from);
      setTempTo(range.to);
      onChange({ period: p, from: range.from, to: range.to });
      setIsOpen(false);
    }
  };

  const handleApplyCustom = () => {
    onChange({ period: 'custom', from: tempFrom, to: tempTo });
    setIsOpen(false);
  };

  // Compute label on trigger button
  const currentRange = computeDateRange(period, customFrom, customTo);
  const activePreset = presets.find((p) => p.key === period);
  const presetLabel = locale === 'vi' ? activePreset?.labelVi : activePreset?.labelEn;

  const displayString =
    period === 'today'
      ? `${presetLabel} (${formatDisplayDate(currentRange.from)})`
      : `${formatDisplayDate(currentRange.from)} – ${formatDisplayDate(currentRange.to)}`;

  return (
    <div className={`relative inline-block text-xs ${className}`} ref={containerRef}>
      {/* Popover Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl border border-slate-200 shadow-sm transition hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-full"
      >
        <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
          <Calendar className="w-3.5 h-3.5" />
        </div>
        <span className="text-slate-800 font-bold truncate max-w-[200px] sm:max-w-none text-xs">
          {displayString}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <>
          {/* Mobile backdrop for clean tap-outside and guaranteed focus */}
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs sm:hidden animate-in fade-in-0 duration-150"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`fixed inset-x-3 top-24 z-50 max-w-sm mx-auto sm:mx-0 sm:max-w-none sm:w-80 sm:absolute sm:top-auto sm:inset-x-auto ${
              align === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
            } mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800`}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
              <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                {locale === 'vi' ? 'Chọn khoảng thời gian' : 'Select Date Range'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{presetLabel}</span>
            </div>

            {/* Quick Presets Grid */}
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {presets.map((p) => {
                const isSelected = period === p.key;
                const label = locale === 'vi' ? p.labelVi : p.labelEn;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectPreset(p.key)}
                    className={`py-2 px-2 rounded-xl font-bold text-[11px] transition text-center flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Date Inputs Section */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    {locale === 'vi' ? 'Từ ngày' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={tempFrom}
                    onChange={(e) => setTempFrom(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    {locale === 'vi' ? 'Đến ngày' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={tempTo}
                    onChange={(e) => setTempTo(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplyCustom}
                className="w-full mt-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 text-xs"
              >
                <span>{locale === 'vi' ? 'Áp dụng khoảng ngày' : 'Apply Range'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
