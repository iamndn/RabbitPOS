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
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { exportToCsv } from '@/lib/exportCsv';
import { formatCurrency, SettingsMap } from '@/lib/utils';

interface DashboardMetrics {
  total_revenue: number;
  total_cogs: number;
  total_outflow: number;
  gross_profit: number;
  net_profit: number;
  order_count: number;
  average_order_value: number;
  start_date: string;
  end_date: string;
}

interface TopProduct {
  variant_id: number;
  product_name: string;
  variant_name: string;
  quantity_sold: number;
  total_revenue: number;
  total_cogs: number;
  profit_margin: number;
}

interface CashFlowItem {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowItem[]>([]);
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Date Filter State
  const [shortcut, setShortcut] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const handleShortcutChange = (newShortcut: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setShortcut(newShortcut);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (newShortcut === 'today') {
      s = now;
      e = now;
    } else if (newShortcut === 'yesterday') {
      s = new Date(now.setDate(now.getDate() - 1));
      e = s;
    } else if (newShortcut === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      s = new Date(now.setDate(diff));
      e = new Date();
    } else if (newShortcut === 'month') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date();
    }

    if (newShortcut !== 'custom') {
      setStartDate(s.toISOString().slice(0, 10));
      setEndDate(e.toISOString().slice(0, 10));
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    const params = `?start_date=${startDate}&end_date=${endDate}`;

    const [metricsRes, topRes, cashFlowRes, settingsRes] = await Promise.all([
      fetchApi<DashboardMetrics>(`/analytics/dashboard${params}`),
      fetchApi<TopProduct[]>(`/analytics/top-products${params}&limit=5`),
      fetchApi<CashFlowItem[]>(`/analytics/cash-flow${params}`),
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

    if (metricsRes.status === 'success' && metricsRes.data) {
      setMetrics(metricsRes.data);
    }
    if (topRes.status === 'success') {
      const topList = Array.isArray(topRes.data)
        ? topRes.data
        : Array.isArray(topRes)
        ? (topRes as TopProduct[])
        : [];
      setTopProducts(topList);
    }
    if (cashFlowRes.status === 'success') {
      const flowList = Array.isArray(cashFlowRes.data)
        ? cashFlowRes.data
        : Array.isArray(cashFlowRes)
        ? (cashFlowRes as CashFlowItem[])
        : [];
      setCashFlow(flowList);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [startDate, endDate]);

  const handleExportTopProducts = () => {
    exportToCsv<TopProduct>('rabbitpos_top_products', topProducts, [
      { header: 'Product Name', accessor: (tp) => tp.product_name },
      { header: 'Variant Name', accessor: (tp) => tp.variant_name },
      { header: 'Quantity Sold', accessor: (tp) => tp.quantity_sold },
      { header: 'Total Revenue', accessor: (tp) => formatCurrency(tp.total_revenue, settings) },
      { header: 'Total COGS', accessor: (tp) => formatCurrency(tp.total_cogs, settings) },
      { header: 'Profit Margin (%)', accessor: (tp) => tp.profit_margin.toFixed(1) },
    ]);
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header & Date Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
              {t('dashboard.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('dashboard.subtitle')}
            </p>
          </div>

          {/* Quick Date Shortcuts & CSV Export */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportTopProducts}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> {t('common.export_csv')}
            </button>

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map((sc) => (
                <button
                  key={sc}
                  onClick={() => handleShortcutChange(sc)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    shortcut === sc
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t(`dashboard.shortcut_${sc}`)}
                </button>
              ))}
            </div>

            {shortcut === 'custom' && (
              <div className="flex items-center space-x-1 text-xs">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                />
                <span className="text-slate-400">{t('common.to')}</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                />
              </div>
            )}
          </div>
        </div>

        {/* KPI Cards Row */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Revenue */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">{t('dashboard.gross_revenue')}</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(metrics.total_revenue, settings)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t('dashboard.completed_orders')}</span>
                <span className="font-bold text-indigo-600">{metrics.order_count}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">{t('dashboard.gross_profit')}</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(metrics.gross_profit, settings)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t('dashboard.cogs_label')}</span>
                <span className="font-semibold text-slate-700">{formatCurrency(metrics.total_cogs, settings)}</span>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">{t('dashboard.net_profit')}</span>
              <div
                className={`text-2xl font-extrabold mt-1 ${
                  metrics.net_profit >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(metrics.net_profit, settings)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t('dashboard.after_outflows')}</span>
                <span className="font-semibold text-rose-600">-{formatCurrency(metrics.total_outflow, settings)}</span>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">{t('dashboard.aov')}</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {formatCurrency(metrics.average_order_value, settings)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t('dashboard.per_tx')}</span>
              </div>
            </div>

            {/* Total Outflow Expenses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">{t('dashboard.total_outflow_label')}</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">{formatCurrency(metrics.total_outflow, settings)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>{t('dashboard.outflow_sub')}</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Widgets Grid: Top Products & Cash Flow Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Drinks Ranking Widget */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.top_products')}</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">{t('dashboard.sold_units')}</span>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{t('dashboard.no_sales_data')}</p>
            ) : (
              <div className="space-y-3">
                {topProducts.map((tp, idx) => (
                  <div
                    key={tp.variant_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{tp.product_name}</h4>
                        <span className="text-[11px] text-slate-500">{t('dashboard.variant_label')} {tp.variant_name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block font-extrabold text-indigo-600 text-xs">{formatCurrency(tp.total_revenue, settings)}</span>
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {t('dashboard.sold_margin', { qty: tp.quantity_sold, margin: tp.profit_margin.toFixed(1) })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cash Flow Summary Widget */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">{t('dashboard.cash_flow_summary')}</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">{t('dashboard.inflow_vs_outflow')}</span>
            </div>

            {cashFlow.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">{t('dashboard.no_cashflow_data')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2 px-3">{t('common.date')}</th>
                      <th className="py-2 px-3 text-emerald-600">{t('dashboard.th_inflows')}</th>
                      <th className="py-2 px-3 text-rose-600">{t('dashboard.th_outflows')}</th>
                      <th className="py-2 px-3 text-right">{t('dashboard.th_net_flow')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashFlow.map((cf) => (
                      <tr key={cf.date} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{cf.date}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">+{formatCurrency(cf.inflow, settings)}</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600">-{formatCurrency(cf.outflow, settings)}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-extrabold ${
                            cf.net >= 0 ? 'text-indigo-600' : 'text-rose-600'
                          }`}
                        >
                          {formatCurrency(cf.net, settings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
