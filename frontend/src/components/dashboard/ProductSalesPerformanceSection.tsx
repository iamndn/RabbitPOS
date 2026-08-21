'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Trophy,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Download,
  Search,
  Package,
  BarChart3,
  RefreshCw,
  Tag,
} from 'lucide-react';
import ModernDateRangePicker, { DatePeriod, DateRangeChangeParams, getLocalDateStr } from '@/components/common/ModernDateRangePicker';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { exportToCsv } from '@/lib/exportCsv';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import {
  ProductSalesPerformanceItem,
  ProductSalesPerformanceResponse,
} from '@/types/analytics';

interface ProductSalesPerformanceSectionProps {
  initialPeriod: DatePeriod;
  initialFrom?: string;
  initialTo?: string;
  settings: SettingsMap | null;
}

type SortField = 'quantity_sold' | 'total_revenue' | 'total_cogs' | 'total_profit' | 'margin_percentage';
type SortDir = 'asc' | 'desc';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function marginBadgeClass(margin: number): string {
  if (margin >= 60) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (margin >= 40) return 'bg-teal-50 text-teal-700 border-teal-200';
  if (margin >= 20) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

export default function ProductSalesPerformanceSection({
  initialPeriod,
  initialFrom,
  initialTo,
  settings,
}: ProductSalesPerformanceSectionProps) {
  const { t } = useTranslation();

  const [period, setPeriod] = useState<DatePeriod>(initialPeriod);
  const [customFrom, setCustomFrom] = useState<string>(() => initialFrom ?? getLocalDateStr());
  const [customTo, setCustomTo] = useState<string>(() => initialTo ?? getLocalDateStr());

  const [searchInput, setSearchInput] = useState<string>('');
  const debouncedSearch = useDebounce(searchInput, 250);
  const [categoryFilter, setCategoryFilter] = useState<string | number | null>(null);

  const [sortField, setSortField] = useState<SortField>('total_revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [data, setData] = useState<ProductSalesPerformanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [categories, setCategories] = useState<ModernSelectOption[]>([]);

  useEffect(() => {
    fetchApi<any>('/categories').then((res) => {
      if (res.status === 'success' && Array.isArray(res.data)) {
        const opts: ModernSelectOption[] = res.data.map((c: any) => ({
          value: String(c.id),
          label: c.name,
        }));
        setCategories(opts);
      }
    });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?period=${period}`;
      if (period === 'custom') {
        qs += `&from=${customFrom}&to=${customTo}`;
      }
      if (categoryFilter) {
        qs += `&category_id=${categoryFilter}`;
      }
      if (debouncedSearch.trim()) {
        qs += `&search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      const res = await fetchApi<ProductSalesPerformanceResponse>(
        `/analytics/products-sales-performance${qs}`
      );
      if (res.status === 'success' && res.data) {
        setData(res.data);
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, categoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPeriod(initialPeriod);
    if (initialFrom) setCustomFrom(initialFrom);
    if (initialTo) setCustomTo(initialTo);
  }, [initialPeriod, initialFrom, initialTo]);

  const handleDateChange = ({ period: newP, from, to }: DateRangeChangeParams) => {
    setPeriod(newP);
    setCustomFrom(from);
    setCustomTo(to);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedItems = React.useMemo<ProductSalesPerformanceItem[]>(() => {
    if (!data?.items) return [];
    const copy = [...data.items];
    copy.sort((a, b) => {
      const av = a[sortField] as number;
      const bv = b[sortField] as number;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [data, sortField, sortDir]);

  const handleExportCsv = () => {
    if (!data?.items?.length) return;
    exportToCsv('product_sales_performance', sortedItems, [
      { header: t('product_perf.col_product'), accessor: (i: ProductSalesPerformanceItem) => i.product_name },
      { header: t('product_perf.col_category'), accessor: (i: ProductSalesPerformanceItem) => i.category_name },
      { header: t('product_perf.col_qty'), accessor: (i: ProductSalesPerformanceItem) => i.quantity_sold },
      { header: t('product_perf.col_revenue'), accessor: (i: ProductSalesPerformanceItem) => i.total_revenue },
      { header: t('product_perf.col_cogs'), accessor: (i: ProductSalesPerformanceItem) => i.total_cogs },
      { header: t('product_perf.col_profit'), accessor: (i: ProductSalesPerformanceItem) => i.total_profit },
      { header: t('product_perf.col_margin'), accessor: (i: ProductSalesPerformanceItem) => `${i.margin_percentage}%` },
      { header: t('product_perf.col_rev_share'), accessor: (i: ProductSalesPerformanceItem) => `${i.revenue_share_percentage}%` },
    ]);
  };

  const SortHeader = ({
    field,
    label,
    className = '',
  }: {
    field: SortField;
    label: string;
    className?: string;
  }) => {
    const isActive = sortField === field;
    return (
      <th
        className={`py-2.5 px-3 text-right cursor-pointer select-none group whitespace-nowrap ${className}`}
        onClick={() => handleSort(field)}
      >
        <span className={`inline-flex items-center justify-end gap-1 text-[11px] font-bold uppercase transition-colors ${
          isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-700'
        }`}>
          {label}
          {isActive ? (
            sortDir === 'desc' ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-60" />
          )}
        </span>
      </th>
    );
  };

  const summary = data?.summary;
  const skeletonRows = Array.from({ length: 6 });

  return (
    <section className="space-y-4">
      {/* Section Header & Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        {/* Title Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                {t('product_perf.section_title')}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t('product_perf.section_subtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!data?.items?.length}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              {t('product_perf.export_csv')}
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap gap-2.5 sm:gap-3 items-center p-3.5 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <ModernDateRangePicker
            period={period}
            customFrom={customFrom}
            customTo={customTo}
            onChange={handleDateChange}
            align="left"
          />
          <div className="relative flex-1 min-w-[130px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('product_perf.search_placeholder')}
              className="w-full pl-8 pr-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
            />
          </div>
          <div className="w-full sm:w-auto flex-1 min-w-[130px] sm:max-w-xs">
            <ModernSelect
              options={categories}
              value={categoryFilter}
              onChange={setCategoryFilter}
              placeholder={t('product_perf.all_categories')}
              clearable
              size="sm"
              leadingIcon={<Tag className="w-3.5 h-3.5" />}
            />
          </div>
        </div>

        {/* KPI Banner — 4 cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-slate-100">
          {/* Units Sold */}
          <div className="p-4 sm:p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {t('product_perf.kpi_units_sold')}
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-slate-200 rounded w-24 animate-pulse mt-1" />
            ) : (
              <div className="text-2xl font-extrabold text-indigo-600">
                {(summary?.total_units_sold ?? 0).toLocaleString()}
                <span className="text-sm font-semibold text-slate-400 ml-1">{t('product_perf.unit_label')}</span>
              </div>
            )}
          </div>

          {/* Revenue */}
          <div className="p-4 sm:p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {t('product_perf.kpi_revenue')}
              </span>
              <div className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-slate-200 rounded w-28 animate-pulse mt-1" />
            ) : (
              <div className="text-2xl font-extrabold text-violet-600">
                {formatCurrency(summary?.total_products_revenue ?? 0, settings)}
              </div>
            )}
          </div>

          {/* Gross Profit */}
          <div className="p-4 sm:p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {t('product_perf.kpi_profit')}
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-slate-200 rounded w-28 animate-pulse mt-1" />
            ) : (
              <>
                <div className="text-2xl font-extrabold text-emerald-600">
                  {formatCurrency(summary?.total_products_profit ?? 0, settings)}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {t('product_perf.avg_margin_label', {
                    margin: summary?.average_margin_percentage ?? 0,
                  })}
                </span>
              </>
            )}
          </div>

          {/* Top Profit Product */}
          <div className="p-4 sm:p-5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {t('product_perf.kpi_top_profit')}
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            {loading ? (
              <div className="h-7 bg-slate-200 rounded w-32 animate-pulse mt-1" />
            ) : (
              <>
                <div className="text-sm font-extrabold text-slate-900 truncate leading-tight">
                  {summary?.top_profit_product || '—'}
                </div>
                <span className="text-[11px] text-slate-400 truncate">
                  {t('product_perf.top_revenue_label')}: {summary?.top_revenue_product || '—'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Performance Data Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* 1. Desktop Table View (md and up) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[820px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap w-10">#</th>
                <th className="py-2.5 px-3 text-left text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap">
                  {t('product_perf.col_product')}
                </th>
                <SortHeader field="quantity_sold" label={t('product_perf.col_qty')} />
                <SortHeader field="total_revenue" label={t('product_perf.col_revenue')} />
                <th className="py-2.5 px-3 text-right text-[11px] font-bold uppercase text-slate-500 whitespace-nowrap">
                  {t('product_perf.col_rev_share')}
                </th>
                <SortHeader field="total_cogs" label={t('product_perf.col_cogs')} />
                <SortHeader field="total_profit" label={t('product_perf.col_profit')} />
                <SortHeader field="margin_percentage" label={t('product_perf.col_margin')} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                skeletonRows.map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3 px-3"><div className="h-3 bg-slate-200 rounded w-4" /></td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-200 rounded-lg flex-shrink-0" />
                        <div className="space-y-1.5">
                          <div className="h-3 bg-slate-200 rounded w-28" />
                          <div className="h-2.5 bg-slate-100 rounded w-16" />
                        </div>
                      </div>
                    </td>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="py-3 px-3"><div className="h-3 bg-slate-200 rounded w-16 ml-auto" /></td>
                    ))}
                  </tr>
                ))
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Package className="w-10 h-10 opacity-40" />
                      <p className="text-sm font-semibold">{t('product_perf.empty_state')}</p>
                      <p className="text-xs">{t('product_perf.empty_state_hint')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedItems.map((item, idx) => (
                  <tr key={item.product_id} className="hover:bg-indigo-50/30 transition-colors">
                    {/* Rank */}
                    <td className="py-3 px-3">
                      <span className={`text-[11px] font-extrabold ${
                        idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-slate-300'
                      }`}>{idx + 1}</span>
                    </td>

                    {/* Product */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate leading-tight text-xs">{item.product_name}</p>
                          <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full block w-fit max-w-[120px] truncate">
                            {item.category_name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-block font-extrabold text-xs px-2 py-0.5 rounded-lg ${
                        sortField === 'quantity_sold' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {item.quantity_sold.toLocaleString()}
                      </span>
                    </td>

                    {/* Revenue */}
                    <td className={`py-3 px-3 text-right font-bold text-xs ${sortField === 'total_revenue' ? 'text-indigo-600' : 'text-slate-800'}`}>
                      {formatCurrency(item.total_revenue, settings)}
                    </td>

                    {/* Revenue Share % */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[11px] font-bold text-slate-600">{item.revenue_share_percentage.toFixed(1)}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.revenue_share_percentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* COGS */}
                    <td className={`py-3 px-3 text-right text-xs ${sortField === 'total_cogs' ? 'text-amber-600 font-bold' : 'text-slate-500 font-medium'}`}>
                      {formatCurrency(item.total_cogs, settings)}
                    </td>

                    {/* Profit */}
                    <td className={`py-3 px-3 text-right text-xs font-extrabold ${item.total_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.total_profit >= 0 ? '+' : ''}{formatCurrency(item.total_profit, settings)}
                    </td>

                    {/* Margin % */}
                    <td className="py-3 px-3 text-right">
                      <span className={`inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${marginBadgeClass(item.margin_percentage)}`}>
                        {item.margin_percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 2. Mobile Cards View (< md) */}
        <div className="md:hidden divide-y divide-slate-100">
          {/* Quick Sort Bar for Mobile */}
          <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
            <span className="text-slate-400 font-semibold shrink-0">Sắp xếp theo:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleSort('total_profit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  sortField === 'total_profit' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Lợi nhuận
                {sortField === 'total_profit' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
              </button>
              <button
                type="button"
                onClick={() => handleSort('total_revenue')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  sortField === 'total_revenue' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Doanh thu
                {sortField === 'total_revenue' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
              </button>
              <button
                type="button"
                onClick={() => handleSort('quantity_sold')}
                className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                  sortField === 'quantity_sold' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                SL bán
                {sortField === 'quantity_sold' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
              </button>
            </div>
          </div>

          {loading ? (
            skeletonRows.map((_, i) => (
              <div key={i} className="p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-32" />
                    <div className="h-3 bg-slate-100 rounded w-20" />
                  </div>
                </div>
                <div className="h-12 bg-slate-50 rounded-xl" />
              </div>
            ))
          ) : sortedItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              {t('product_perf.empty_state')}
            </div>
          ) : (
            sortedItems.map((item, idx) => (
              <div key={item.product_id} className="p-4 space-y-3 bg-white">
                {/* Header: Rank + Image + Name + Category + Margin */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Rank Badge */}
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] shrink-0 ${
                      idx === 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      idx === 1 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                      idx === 2 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                      'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </span>

                    {/* Product Image */}
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate leading-tight text-xs">{item.product_name}</p>
                      <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                        {item.category_name}
                      </span>
                    </div>
                  </div>

                  {/* Margin % Badge */}
                  <span className={`shrink-0 inline-flex items-center text-[11px] font-extrabold px-2 py-0.5 rounded-lg border ${marginBadgeClass(item.margin_percentage)}`}>
                    {item.margin_percentage.toFixed(1)}% LN
                  </span>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Doanh thu & SL bán</span>
                    <div className="font-extrabold text-slate-900 text-sm">
                      {formatCurrency(item.total_revenue, settings)}
                    </div>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      Đã bán: {item.quantity_sold.toLocaleString()} ly
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Lợi nhuận gộp</span>
                    <div className={`font-extrabold text-sm ${item.total_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.total_profit >= 0 ? '+' : ''}{formatCurrency(item.total_profit, settings)}
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Vốn: {formatCurrency(item.total_cogs, settings)}
                    </span>
                  </div>
                </div>

                {/* Revenue Share Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Tỷ trọng doanh thu</span>
                    <span className="font-bold text-slate-700">{item.revenue_share_percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(100, item.revenue_share_percentage)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && sortedItems.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between bg-slate-50/50">
            <span>{t('product_perf.row_count', { count: sortedItems.length })}</span>
            <span className="text-indigo-600 font-bold">
              {t('product_perf.period_label')}: {data?.from} → {data?.to}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
