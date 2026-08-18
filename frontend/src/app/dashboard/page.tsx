'use client';

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Award,
  Calendar,
  PieChart,
  Percent,
  Download,
  Receipt,
  ArrowRight,
  Layers,
  Coins,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Building2,
  Sparkles,
  HelpCircle,
  Package,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import AllProductsRankingModal from '@/components/dashboard/AllProductsRankingModal';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { exportToCsv } from '@/lib/exportCsv';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import {
  RevenueAnalyticsResponse,
  ProfitAnalyticsResponse,
  RevenueTimelinePoint,
  ProfitTimelinePoint,
} from '@/types/analytics';

export default function DashboardPage() {
  const { t } = useTranslation();

  // Active View Tab: 'revenue' | 'profit'
  const [activeTab, setActiveTab] = useState<'revenue' | 'profit'>('revenue');

  // Timeframe Filter
  const [period, setPeriod] = useState<'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState<string>(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().slice(0, 10));

  // Analytics Data States
  const [revenueData, setRevenueData] = useState<RevenueAnalyticsResponse | null>(null);
  const [profitData, setProfitData] = useState<ProfitAnalyticsResponse | null>(null);
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // All Products Modal
  const [isRankingModalOpen, setIsRankingModalOpen] = useState<boolean>(false);
  const [rankingSortBy, setRankingSortBy] = useState<'revenue' | 'profit' | 'quantity' | 'margin'>('revenue');

  // Hover Tooltip States for SVG Charts
  const [hoveredRevenueIndex, setHoveredRevenueIndex] = useState<number | null>(null);
  const [hoveredProfitIndex, setHoveredProfitIndex] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);

    let queryParams = `?period=${period}`;
    if (period === 'custom') {
      queryParams += `&from=${customFrom}&to=${customTo}`;
    }

    const [revRes, profitRes, settingsRes] = await Promise.all([
      fetchApi<RevenueAnalyticsResponse>(`/analytics/revenue${queryParams}`),
      fetchApi<ProfitAnalyticsResponse>(`/analytics/profit${queryParams}`),
      fetchApi<any>('/settings'),
    ]);

    if (settingsRes.status === 'success' && settingsRes.data) {
      if (Array.isArray(settingsRes.data)) {
        const map: SettingsMap = {};
        settingsRes.data.forEach((s: any) => {
          if (s && s.key) map[s.key] = s.value;
        });
        setSettings(map);
      } else if (typeof settingsRes.data === 'object') {
        setSettings(settingsRes.data as SettingsMap);
      }
    }

    if (revRes.status === 'success' && revRes.data) {
      setRevenueData(revRes.data);
    }
    if (profitRes.status === 'success' && profitRes.data) {
      setProfitData(profitRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [period, customFrom, customTo]);

  const handlePeriodChange = (newPeriod: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom') => {
    setPeriod(newPeriod);
    const now = new Date();
    if (newPeriod === 'today') {
      setCustomFrom(now.toISOString().slice(0, 10));
      setCustomTo(now.toISOString().slice(0, 10));
    } else if (newPeriod === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      setCustomFrom(y.toISOString().slice(0, 10));
      setCustomTo(y.toISOString().slice(0, 10));
    } else if (newPeriod === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now);
      mon.setDate(diff);
      setCustomFrom(mon.toISOString().slice(0, 10));
      setCustomTo(now.toISOString().slice(0, 10));
    } else if (newPeriod === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      setCustomFrom(start.toISOString().slice(0, 10));
      setCustomTo(now.toISOString().slice(0, 10));
    } else if (newPeriod === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      setCustomFrom(start.toISOString().slice(0, 10));
      setCustomTo(now.toISOString().slice(0, 10));
    }
  };

  const handleOpenRanking = (sortBy: 'revenue' | 'profit' | 'quantity' | 'margin') => {
    setRankingSortBy(sortBy);
    setIsRankingModalOpen(true);
  };

  const revSummary = revenueData?.summary;
  const pSummary = profitData?.summary;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
              {t('dashboard.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t('dashboard.subtitle')}</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenRanking('revenue')}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-indigo-200 flex items-center gap-1.5 transition"
            >
              <Award className="w-4 h-4 text-indigo-600" />
              {t('dashboard.products_ranking_btn')}
            </button>
            <button
              onClick={loadData}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 transition flex items-center gap-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Timeframe Selector Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            {(['today', 'yesterday', 'week', 'month', 'year', 'custom'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  period === p
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {t(`dashboard.period_${p}`)}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker Inputs */}
          {period === 'custom' && (
            <div className="flex items-center space-x-2 w-full sm:w-auto animate-in fade-in duration-200">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="p-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              <span className="text-xs text-slate-400 font-bold">{t('common.to')}</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="p-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          )}
        </div>

        {/* Dual Tab Navigation: Revenue vs Profit & Loss */}
        <div className="flex space-x-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('revenue')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'revenue'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            {t('dashboard.tab_revenue')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profit')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'profit'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Coins className="w-4 h-4" />
            {t('dashboard.tab_profit')}
          </button>
        </div>

        {/* ── TAB 1: REVENUE ANALYTICS ─────────────────────────────────── */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            {/* Primary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Net Revenue */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_net_revenue')}</span>
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-indigo-600">
                    {formatCurrency(revSummary?.net_revenue || 0, settings)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        (revSummary?.revenue_delta_pct || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {(revSummary?.revenue_delta_pct || 0) >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownLeft className="w-3 h-3" />
                      )}
                      {revSummary?.revenue_delta_pct || 0}%
                    </span>
                    <span className="text-[10px] text-slate-400">{t('dashboard.vs_previous_period')}</span>
                  </div>
                </div>
                {/* Micro Breakdown */}
                <div className="pt-2 border-t border-slate-100 space-y-0.5 text-[10px] text-slate-500">
                  <div className="flex justify-between">
                    <span>{t('dashboard.gross_sales')}:</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(revSummary?.total_gross_sales || 0, settings)}
                    </span>
                  </div>
                  <div className="flex justify-between text-rose-600">
                    <span>{t('dashboard.discounts')}:</span>
                    <span>-{formatCurrency(revSummary?.total_discounts || 0, settings)}</span>
                  </div>
                  <div className="flex justify-between text-cyan-600">
                    <span>{t('dashboard.shipping_surcharges')}:</span>
                    <span>
                      +{formatCurrency((revSummary?.total_shipping_fees || 0) + (revSummary?.total_surcharges || 0), settings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* AOV */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_aov')}</span>
                  <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
                    <Receipt className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {formatCurrency(revSummary?.average_order_value || 0, settings)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        (revSummary?.aov_delta_pct || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {(revSummary?.aov_delta_pct || 0) >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownLeft className="w-3 h-3" />
                      )}
                      {revSummary?.aov_delta_pct || 0}%
                    </span>
                    <span className="text-[10px] text-slate-400">{t('dashboard.vs_previous_period')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.aov_description')}
                </p>
              </div>

              {/* Completed Orders */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_completed_orders')}</span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    {revSummary?.completed_order_count || 0}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        (revSummary?.orders_delta_pct || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {(revSummary?.orders_delta_pct || 0) >= 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownLeft className="w-3 h-3" />
                      )}
                      {revSummary?.orders_delta_pct || 0}%
                    </span>
                    <span className="text-[10px] text-slate-400">{t('dashboard.vs_previous_period')}</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.completed_orders_description')}
                </p>
              </div>

              {/* Total Discounts */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_discounts')}</span>
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                    <Percent className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-rose-600">
                    -{formatCurrency(revSummary?.total_discounts || 0, settings)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {t('dashboard.discount_rate', {
                      rate:
                        revSummary?.total_gross_sales && revSummary.total_gross_sales > 0
                          ? ((revSummary.total_discounts / revSummary.total_gross_sales) * 100).toFixed(1)
                          : '0.0',
                    })}
                  </div>
                </div>
                {/* Sub Discounts */}
                <div className="pt-2 border-t border-slate-100 space-y-0.5 text-[10px] text-slate-500">
                  <div className="flex justify-between">
                    <span>{t('dashboard.promo_discount')}:</span>
                    <span className="font-semibold text-slate-700">
                      -{formatCurrency(revSummary?.promotion_discount || 0, settings)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('dashboard.platform_discount')}:</span>
                    <span>-{formatCurrency(revSummary?.platform_discount || 0, settings)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Trend Chart & Payment Methods Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Trend Chart (2 cols) */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{t('dashboard.revenue_trend_title')}</h3>
                    <p className="text-xs text-slate-400">{t('dashboard.revenue_trend_subtitle')}</p>
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      {t('dashboard.legend_revenue')}
                    </span>
                  </div>
                </div>

                {/* SVG Trend Area Chart */}
                <div className="relative h-64 w-full flex items-end pt-6">
                  {revenueData?.timeline && revenueData.timeline.length > 0 ? (
                    (() => {
                      const points = revenueData.timeline;
                      const maxVal = Math.max(...points.map((p) => p.net_revenue), 10000);
                      const chartHeight = 200;

                      return (
                        <div className="w-full h-full flex flex-col justify-between">
                          <div className="relative flex-1 flex items-end justify-between gap-1 sm:gap-2 px-2 border-b border-slate-200">
                            {points.map((p, idx) => {
                              const heightPct = Math.max(4, (p.net_revenue / maxVal) * 100);
                              const isHovered = hoveredRevenueIndex === idx;

                              return (
                                <div
                                  key={idx}
                                  onMouseEnter={() => setHoveredRevenueIndex(idx)}
                                  onMouseLeave={() => setHoveredRevenueIndex(null)}
                                  className="relative flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                                >
                                  {/* Tooltip */}
                                  {isHovered && (
                                    <div className="absolute -top-16 z-20 bg-slate-900 text-white text-[10px] p-2 rounded-xl shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none">
                                      <div className="font-bold">{p.date}</div>
                                      <div className="text-emerald-400 font-extrabold">
                                        {formatCurrency(p.net_revenue, settings)}
                                      </div>
                                      <div className="text-slate-300">{p.orders_count} đơn hàng</div>
                                    </div>
                                  )}

                                  {/* Bar / Area pillar */}
                                  <div
                                    style={{ height: `${heightPct}%` }}
                                    className={`w-full max-w-[32px] rounded-t-lg transition-all duration-200 ${
                                      isHovered
                                        ? 'bg-indigo-500 ring-2 ring-indigo-300'
                                        : 'bg-indigo-600 hover:bg-indigo-500'
                                    }`}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* X-axis labels */}
                          <div className="flex justify-between text-[10px] text-slate-400 pt-2 px-1">
                            <span>{points[0]?.date}</span>
                            {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.date}</span>}
                            <span>{points[points.length - 1]?.date}</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                      {t('dashboard.no_sales_data')}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Methods Breakdown (1 col) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    {t('dashboard.payment_methods_title')}
                  </h3>
                  <p className="text-xs text-slate-400">{t('dashboard.payment_methods_subtitle')}</p>
                </div>

                <div className="space-y-3">
                  {revenueData?.payment_methods && revenueData.payment_methods.length > 0 ? (
                    revenueData.payment_methods.map((pm, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                idx === 0
                                  ? 'bg-indigo-600'
                                  : idx === 1
                                  ? 'bg-emerald-500'
                                  : 'bg-violet-500'
                              }`}
                            />
                            {pm.fund_name}
                          </span>
                          <span className="font-extrabold text-slate-900">
                            {formatCurrency(pm.total_amount, settings)} ({pm.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            style={{ width: `${pm.percentage}%` }}
                            className={`h-full rounded-full ${
                              idx === 0
                                ? 'bg-indigo-600'
                                : idx === 1
                                ? 'bg-emerald-500'
                                : 'bg-violet-500'
                            }`}
                          />
                        </div>
                        <div className="text-[10px] text-slate-400 text-right">{pm.order_count} đơn</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 py-6 text-center">{t('dashboard.no_sales_data')}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{t('dashboard.total_payment_collected')}:</span>
                  <span className="font-extrabold text-indigo-600">
                    {formatCurrency(revSummary?.net_revenue || 0, settings)}
                  </span>
                </div>
              </div>
            </div>

            {/* Top 5 Products by Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    {t('dashboard.top_revenue_products_title')}
                  </h3>
                  <p className="text-xs text-slate-400">{t('dashboard.top_revenue_products_subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenRanking('revenue')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                >
                  {t('dashboard.view_all_ranking')} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {revenueData?.top_products && revenueData.top_products.length > 0 ? (
                  revenueData.top_products.map((tp, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                            {tp.percentage}%
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs mt-1 truncate">{tp.product_name}</h4>
                        <span className="text-[10px] text-slate-500">{tp.variant_name}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-600 font-semibold">{tp.quantity_sold} ly</span>
                        <span className="font-extrabold text-indigo-600 text-xs">
                          {formatCurrency(tp.total_revenue, settings)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-5 text-center text-slate-400 py-6 text-xs">{t('dashboard.no_sales_data')}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PROFIT & LOSS (P&L) ANALYTICS ─────────────────────── */}
        {activeTab === 'profit' && (
          <div className="space-y-6">
            {/* P&L Primary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Profit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_gross_profit')}</span>
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <Coins className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    {formatCurrency(pSummary?.gross_profit || 0, settings)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {t('dashboard.margin_badge', { margin: pSummary?.gross_margin_percentage || 0 })}
                    </span>
                    <span
                      className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        (pSummary?.gross_profit_delta_pct || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {(pSummary?.gross_profit_delta_pct || 0) >= 0 ? '+' : ''}
                      {pSummary?.gross_profit_delta_pct || 0}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.gross_profit_description')}
                </p>
              </div>

              {/* Net Profit */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_net_profit')}</span>
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div
                    className={`text-2xl font-extrabold ${
                      (pSummary?.net_profit || 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(pSummary?.net_profit || 0, settings)}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {t('dashboard.net_margin_badge', { margin: pSummary?.net_margin_percentage || 0 })}
                    </span>
                    <span
                      className={`inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                        (pSummary?.net_profit_delta_pct || 0) >= 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {(pSummary?.net_profit_delta_pct || 0) >= 0 ? '+' : ''}
                      {pSummary?.net_profit_delta_pct || 0}%
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.net_profit_description')}
                </p>
              </div>

              {/* Total COGS */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_cogs')}</span>
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {formatCurrency(pSummary?.total_cogs || 0, settings)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {t('dashboard.cogs_share', {
                      share:
                        pSummary?.net_revenue && pSummary.net_revenue > 0
                          ? ((pSummary.total_cogs / pSummary.net_revenue) * 100).toFixed(1)
                          : '0.0',
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.cogs_description')}
                </p>
              </div>

              {/* Operating Expenses */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">{t('dashboard.kpi_operating_expenses')}</span>
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-rose-600">
                    {formatCurrency(pSummary?.operating_expenses || 0, settings)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {t('dashboard.opex_share', {
                      share:
                        pSummary?.net_revenue && pSummary.net_revenue > 0
                          ? ((pSummary.operating_expenses / pSummary.net_revenue) * 100).toFixed(1)
                          : '0.0',
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                  {t('dashboard.operating_expenses_description')}
                </p>
              </div>
            </div>

            {/* Profit vs Revenue Multi-Series Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{t('dashboard.profit_trend_title')}</h3>
                  <p className="text-xs text-slate-400">{t('dashboard.profit_trend_subtitle')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    {t('dashboard.legend_revenue')}
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    {t('dashboard.legend_cogs')}
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    {t('dashboard.legend_profit')}
                  </span>
                </div>
              </div>

              {/* SVG Multi-Series Pillar Trend */}
              <div className="relative h-64 w-full flex items-end pt-6">
                {profitData?.timeline && profitData.timeline.length > 0 ? (
                  (() => {
                    const points = profitData.timeline;
                    const maxVal = Math.max(...points.map((p) => Math.max(p.revenue, p.cogs, p.gross_profit)), 10000);

                    return (
                      <div className="w-full h-full flex flex-col justify-between">
                        <div className="relative flex-1 flex items-end justify-between gap-1 sm:gap-2 px-2 border-b border-slate-200">
                          {points.map((p, idx) => {
                            const revHeight = Math.max(2, (p.revenue / maxVal) * 100);
                            const cogsHeight = Math.max(2, (p.cogs / maxVal) * 100);
                            const profitHeight = Math.max(2, (Math.max(0, p.net_profit) / maxVal) * 100);
                            const isHovered = hoveredProfitIndex === idx;

                            return (
                              <div
                                key={idx}
                                onMouseEnter={() => setHoveredProfitIndex(idx)}
                                onMouseLeave={() => setHoveredProfitIndex(null)}
                                className="relative flex-1 h-full flex items-end justify-center gap-0.5 sm:gap-1 group cursor-pointer"
                              >
                                {isHovered && (
                                  <div className="absolute -top-20 z-20 bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-xl whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none space-y-0.5">
                                    <div className="font-bold text-slate-300">{p.date}</div>
                                    <div className="text-indigo-400 font-bold">
                                      Thu: {formatCurrency(p.revenue, settings)}
                                    </div>
                                    <div className="text-amber-400 font-bold">
                                      Vốn: {formatCurrency(p.cogs, settings)}
                                    </div>
                                    <div className="text-emerald-400 font-extrabold">
                                      LN: {formatCurrency(p.net_profit, settings)}
                                    </div>
                                  </div>
                                )}

                                <div
                                  style={{ height: `${revHeight}%` }}
                                  className="w-1/3 max-w-[10px] bg-indigo-600 rounded-t-sm"
                                  title="Doanh thu"
                                />
                                <div
                                  style={{ height: `${cogsHeight}%` }}
                                  className="w-1/3 max-w-[10px] bg-amber-400 rounded-t-sm"
                                  title="Giá vốn COGS"
                                />
                                <div
                                  style={{ height: `${profitHeight}%` }}
                                  className="w-1/3 max-w-[10px] bg-emerald-500 rounded-t-sm"
                                  title="Lợi nhuận ròng"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* X-axis labels */}
                        <div className="flex justify-between text-[10px] text-slate-400 pt-2 px-1">
                          <span>{points[0]?.date}</span>
                          {points.length > 2 && <span>{points[Math.floor(points.length / 2)]?.date}</span>}
                          <span>{points[points.length - 1]?.date}</span>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                    {t('dashboard.no_sales_data')}
                  </div>
                )}
              </div>
            </div>

            {/* Financial P&L Statement & Top Profitable Products Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Statement Table (2 cols) */}
              <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      {t('dashboard.pnl_statement_title')}
                    </h3>
                    <p className="text-xs text-slate-400">{t('dashboard.pnl_statement_subtitle')}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">{t('dashboard.statement_item')}</th>
                        <th className="py-2.5 px-3 text-right">{t('dashboard.statement_amount')}</th>
                        <th className="py-2.5 px-3 text-right">% {t('dashboard.statement_share')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {(profitData?.statement || []).map((row, idx) => (
                        <tr
                          key={idx}
                          className={`${
                            row.is_total
                              ? 'bg-slate-50/80 font-extrabold text-slate-900 border-y border-slate-200'
                              : row.is_header
                              ? 'font-bold text-indigo-950 bg-indigo-50/30'
                              : 'text-slate-700'
                          }`}
                        >
                          <td className="py-2.5 px-3">{row.item_name}</td>
                          <td
                            className={`py-2.5 px-3 text-right ${
                              row.item_code === 'NP'
                                ? row.amount >= 0
                                  ? 'text-indigo-600 font-extrabold'
                                  : 'text-rose-600 font-extrabold'
                                : row.item_code === 'GP'
                                ? 'text-emerald-600'
                                : ''
                            }`}
                          >
                            {formatCurrency(row.amount, settings)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-600">
                            {row.percentage.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Profitable Products (1 col) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-600" />
                      {t('dashboard.top_profitable_products_title')}
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleOpenRanking('profit')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      {t('common.all')}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {profitData?.top_products && profitData.top_products.length > 0 ? (
                    profitData.top_products.map((tp, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-slate-900 block truncate">{tp.product_name}</span>
                          <span className="text-[10px] text-slate-500">
                            {tp.variant_name} · {tp.quantity_sold} ly
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-extrabold text-emerald-600 block">
                            +{formatCurrency(tp.total_profit, settings)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">{tp.margin_percentage}% LN</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-400 py-6 text-xs">{t('dashboard.no_sales_data')}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => handleOpenRanking('profit')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center justify-center gap-1 w-full py-1"
                  >
                    {t('dashboard.view_all_ranking')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Products Performance Ranking Modal */}
        <AllProductsRankingModal
          isOpen={isRankingModalOpen}
          onClose={() => setIsRankingModalOpen(false)}
          period={period}
          from={period === 'custom' ? customFrom : undefined}
          to={period === 'custom' ? customTo : undefined}
          initialSortBy={rankingSortBy}
          settings={settings}
        />
      </div>
    </AppShell>
  );
}
