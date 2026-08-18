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
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportCsv';

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.all_products_ranking_title')}</h2>
              <p className="text-xs text-slate-500">{t('dashboard.all_products_ranking_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={t('dashboard.search_product_placeholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setPage(1);
              }}
              className="p-2 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">{t('dashboard.all_categories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By & Export Buttons */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSortBy('revenue')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  sortBy === 'revenue' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('dashboard.sort_revenue')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('profit')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  sortBy === 'profit' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('dashboard.sort_profit')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('quantity')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  sortBy === 'quantity' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('dashboard.sort_quantity')}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('margin')}
                className={`px-2.5 py-1 rounded-lg font-bold transition ${
                  sortBy === 'margin' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('dashboard.sort_margin')}
              </button>
            </div>

            <button
              onClick={handleExportCsv}
              className="p-2 bg-white text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              title={t('common.export_csv')}
            >
              <Download className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl shadow-sm">
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
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-600">
                        +{formatCurrency(it.total_profit, settings)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            it.margin_percentage >= 50
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
