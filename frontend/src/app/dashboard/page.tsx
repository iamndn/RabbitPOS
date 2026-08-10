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
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';

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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowItem[]>([]);
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

    const [metricsRes, topRes, cashFlowRes] = await Promise.all([
      fetchApi<DashboardMetrics>(`/analytics/dashboard${params}`),
      fetchApi<TopProduct[]>(`/analytics/top-products${params}&limit=5`),
      fetchApi<CashFlowItem[]>(`/analytics/cash-flow${params}`),
    ]);

    if (metricsRes.status === 'success' && metricsRes.data) {
      setMetrics(metricsRes.data);
    }
    if (topRes.status === 'success' && topRes.data) {
      setTopProducts(topRes.data);
    }
    if (cashFlowRes.status === 'success' && cashFlowRes.data) {
      setCashFlow(cashFlowRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, [startDate, endDate]);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header & Date Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-indigo-600" />
              Executive Analytics Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time revenue, gross profit, net profit, top drink rankings, and daily cash flow.
            </p>
          </div>

          {/* Quick Date Shortcuts */}
          <div className="flex flex-wrap items-center gap-2">
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
                  {sc}
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
                <span className="text-slate-400">to</span>
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
              <span className="text-xs font-semibold text-slate-500">Total Revenue</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">${metrics.total_revenue.toFixed(2)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Completed Orders:</span>
                <span className="font-bold text-indigo-600">{metrics.order_count}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Gross Profit</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">${metrics.gross_profit.toFixed(2)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>COGS:</span>
                <span className="font-semibold text-slate-700">${metrics.total_cogs.toFixed(2)}</span>
              </div>
            </div>

            {/* Net Profit */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Net Profit</span>
              <div
                className={`text-2xl font-extrabold mt-1 ${
                  metrics.net_profit >= 0 ? 'text-indigo-600' : 'text-rose-600'
                }`}
              >
                ${metrics.net_profit.toFixed(2)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>After Outflows:</span>
                <span className="font-semibold text-rose-600">-${metrics.total_outflow.toFixed(2)}</span>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Avg Order Value (AOV)</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                ${metrics.average_order_value.toFixed(2)}
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Per Transaction</span>
              </div>
            </div>

            {/* Total Outflow Expenses */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-500">Total Outflow Expenses</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">${metrics.total_outflow.toFixed(2)}</div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                <span>Ingredients & Utilities</span>
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
                <h3 className="font-bold text-slate-900 text-sm">Top-Selling Drinks</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">By Quantity Sold</span>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No sales data for this period.</p>
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
                        <span className="text-[11px] text-slate-500">Variant: {tp.variant_name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="block font-extrabold text-indigo-600 text-xs">${tp.total_revenue.toFixed(2)}</span>
                      <span className="text-[10px] font-semibold text-emerald-600">
                        {tp.quantity_sold} sold ({tp.profit_margin.toFixed(1)}% margin)
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
                <h3 className="font-bold text-slate-900 text-sm">Cash Flow Activity</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">Inflows vs Outflows</span>
            </div>

            {cashFlow.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No cash flow activity for this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3 text-emerald-600">Inflows (+)</th>
                      <th className="py-2 px-3 text-rose-600">Outflows (-)</th>
                      <th className="py-2 px-3 text-right">Net Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cashFlow.map((cf) => (
                      <tr key={cf.date} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-700">{cf.date}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-600">+${cf.inflow.toFixed(2)}</td>
                        <td className="py-2.5 px-3 font-bold text-rose-600">-${cf.outflow.toFixed(2)}</td>
                        <td
                          className={`py-2.5 px-3 text-right font-extrabold ${
                            cf.net >= 0 ? 'text-indigo-600' : 'text-rose-600'
                          }`}
                        >
                          ${cf.net.toFixed(2)}
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
