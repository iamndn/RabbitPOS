'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Search,
  ArrowUpDown,
  Download,
  TrendingUp,
  Coins,
  Package,
  Layers,
  Percent,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';
import { exportProductsRankingToExcel } from '@/lib/exportExcel';
import ModernSelect from '@/components/common/ModernSelect';
import { FilterBar, Chip } from '@/components/ui';

export interface ProductRankingItem {
  product_id: number;
  product_name: string;
  category_name: string;
  variant_name: string;
  quantity_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_percentage: number;
}

interface ProductsRankingResponse {
  items: ProductRankingItem[];
  total_items: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface Category {
  id: number;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  period: string;
  from?: string;
  to?: string;
  initialSortBy?: 'revenue' | 'profit' | 'quantity' | 'margin';
  settings?: SettingsMap | null;
}

export default function AllProductsRankingModal({
  isOpen,
  onClose,
  period,
  from,
  to,
  initialSortBy = 'revenue',
  settings,
}: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ProductRankingItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'revenue' | 'profit' | 'quantity' | 'margin'>(initialSortBy);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);



  useEffect(() => {
    if (isOpen) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadRanking();
    }
  }, [isOpen, period, from, to, sortBy, selectedCategoryId, page]);

  // Debounced Search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      setPage(1);
      loadRanking();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCategories = async () => {
    const res = await fetchApi<Category[]>('/categories');
    if (res.status === 'success' && Array.isArray(res.data)) {
      setCategories(res.data);
    }
  };

  const loadRanking = async () => {
    setLoading(true);
    let url = `/analytics/products-ranking?period=${period}&sort_by=${sortBy}&page=${page}&limit=${limit}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;
    if (selectedCategoryId) url += `&category_id=${selectedCategoryId}`;
    if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

    const res = await fetchApi<ProductsRankingResponse>(url);
    if (res.status === 'success' && res.data) {
      setItems(res.data.items || []);
      setTotalPages(res.data.total_pages || 1);
      setTotalItems(res.data.total_items || 0);
    }
    setLoading(false);
  };

  const [exportingExcel, setExportingExcel] = useState<boolean>(false);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportProductsRankingToExcel(items, settings);
    } catch (e) {
      console.error(e);
      handleExportCsv();
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCsv = () => {
    exportToCsv<ProductRankingItem>('rabbitpos_product_rankings', items, [
      { header: 'Product Name', accessor: (it) => it.product_name },
      { header: 'Variant', accessor: (it) => it.variant_name },
      { header: 'Category', accessor: (it) => it.category_name },
      { header: 'Quantity Sold', accessor: (it) => it.quantity_sold },
      { header: 'Total Revenue', accessor: (it) => formatCurrency(it.total_revenue, settings) },
      { header: 'Total COGS', accessor: (it) => formatCurrency(it.total_cogs, settings) },
      { header: 'Total Profit', accessor: (it) => formatCurrency(it.total_profit, settings) },
      { header: 'Margin %', accessor: (it) => `${it.margin_percentage}%` },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-6 border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0 pr-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{t('dashboard.all_products_ranking_title')}</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">{t('dashboard.all_products_ranking_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Filter Controls */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('dashboard.search_product_placeholder')}
          activeFiltersCount={(selectedCategoryId ? 1 : 0) + (sortBy !== 'revenue' ? 1 : 0)}
          sheetTitle="Bộ Lọc Bảng Xếp Hạng"
          onReset={() => {
            setSortBy('revenue');
            setSelectedCategoryId('');
            setPage(1);
          }}
          filters={
            <div className="flex flex-col md:flex-row md:items-center gap-2.5 w-full md:w-auto">
              <div className="w-full md:w-44">
                <label className="text-caption font-bold text-slate-500 uppercase block mb-1 md:hidden">
                  Sắp xếp theo
                </label>
                <ModernSelect
                  value={sortBy}
                  onChange={(val) => {
                    setSortBy(val as any);
                    setPage(1);
                  }}
                  options={[
                    { value: 'revenue', label: 'Doanh thu' },
                    { value: 'profit', label: 'Lợi nhuận' },
                    { value: 'quantity', label: 'Số lượng' },
                    { value: 'margin', label: 'Tỷ suất LN %' },
                  ]}
                  size="sm"
                />
              </div>
              <div className="w-full md:w-48">
                <label className="text-caption font-bold text-slate-500 uppercase block mb-1 md:hidden">
                  Danh mục
                </label>
                <ModernSelect
                  value={selectedCategoryId}
                  onChange={(val) => {
                    setSelectedCategoryId(val);
                    setPage(1);
                  }}
                  options={[
                    { value: '', label: 'Tất cả danh mục' },
                    ...categories.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    })),
                  ]}
                  size="sm"
                />
              </div>
            </div>
          }
          actionsSlot={
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              className="bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold px-3 py-2 rounded-xl border border-purple-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-2xs disabled:opacity-50"
              title="Xuất file Excel (.xlsx)"
            >
              {exportingExcel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />}
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
          }
          chipsSlot={
            (selectedCategoryId || sortBy !== 'revenue') ? (
              <>
                {sortBy !== 'revenue' && (
                  <Chip
                    variant="brand"
                    onRemove={() => { setSortBy('revenue'); setPage(1); }}
                  >
                    Sắp xếp: {sortBy === 'profit' ? 'Lợi nhuận' : sortBy === 'quantity' ? 'Số lượng' : 'Tỷ suất LN %'}
                  </Chip>
                )}
                {selectedCategoryId && (
                  <Chip
                    variant="default"
                    onRemove={() => { setSelectedCategoryId(''); setPage(1); }}
                  >
                    Danh mục: {categories.find((c) => String(c.id) === selectedCategoryId)?.name || selectedCategoryId}
                  </Chip>
                )}
              </>
            ) : undefined
          }
        />


        {/* Table & Mobile Cards Content */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl shadow-sm">
          {/* 1. Desktop Table View (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">{t('dashboard.col_product')}</th>
                  <th className="py-3 px-4">{t('dashboard.col_category')}</th>
                  <th className="py-3 px-4 text-right">{t('dashboard.col_sold_qty')}</th>
                  <th className="py-3 px-4 text-right">{t('dashboard.col_revenue')}</th>
                  <th className="py-3 px-4 text-right">{t('dashboard.col_cogs')}</th>
                  <th className="py-3 px-4 text-right">{t('dashboard.col_profit')}</th>
                  <th className="py-3 px-4 text-right">{t('dashboard.col_margin')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      {t('dashboard.no_ranking_data')}
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const rank = (page - 1) * limit + idx + 1;
                    return (
                      <tr key={`${it.product_id}-${it.variant_name}`} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-center font-bold text-slate-400">
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{it.product_name}</span>
                          <span className="text-[11px] text-indigo-600 font-medium">{it.variant_name}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                            {it.category_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900">{it.quantity_sold} ly</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          {formatCurrency(it.total_revenue, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500 font-medium">
                          {formatCurrency(it.total_cogs, settings)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-purple-600">
                          +{formatCurrency(it.total_profit, settings)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              it.margin_percentage >= 50
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : it.margin_percentage >= 30
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {it.margin_percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 2. Mobile Cards View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {t('common.loading')}
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {t('dashboard.no_ranking_data')}
              </div>
            ) : (
              items.map((it, idx) => {
                const rank = (page - 1) * limit + idx + 1;
                return (
                  <div key={`${it.product_id}-${it.variant_name}`} className="p-3.5 space-y-2.5 bg-white">
                    {/* Header: Rank + Product + Variant + Category + Margin */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-extrabold text-[11px] shrink-0 ${
                          rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          rank === 2 ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                          rank === 3 ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                          'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate text-xs">{it.product_name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-indigo-600 font-semibold">{it.variant_name}</span>
                            <span className="text-[10px] text-slate-400">•</span>
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                              {it.category_name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 inline-block px-2 py-0.5 rounded-lg font-bold text-[10px] border ${
                          it.margin_percentage >= 50
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : it.margin_percentage >= 30
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {it.margin_percentage}% LN
                      </span>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Doanh thu & Số lượng</span>
                        <div className="font-extrabold text-slate-900 text-xs">
                          {formatCurrency(it.total_revenue, settings)}
                        </div>
                        <span className="text-[11px] text-indigo-600 font-medium">
                          {it.quantity_sold} ly
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Lợi nhuận gộp</span>
                        <div className="font-extrabold text-purple-600 text-xs">
                          +{formatCurrency(it.total_profit, settings)}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          Vốn: {formatCurrency(it.total_cogs, settings)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer & Pagination */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-500">
            {t('dashboard.pagination_info', { count: totalItems, page: page, pages: totalPages })}
          </span>

          <div className="flex items-center space-x-1.5">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-bold text-slate-800 bg-slate-100 rounded-lg">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
