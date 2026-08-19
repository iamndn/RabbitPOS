'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  History,
  Scale,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Coins,
  ChevronDown,
  ChevronUp,
  Mail,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import ModernDateRangePicker, { DatePeriod, computeDateRange } from '@/components/common/ModernDateRangePicker';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { FundsPeriodSummaryResponse } from '@/types/analytics';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

export default function FundsPage() {
  const { t } = useTranslation();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [periodSummary, setPeriodSummary] = useState<FundsPeriodSummaryResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [period, setPeriod] = useState<DatePeriod>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => computeDateRange('month').from);
  const [customTo, setCustomTo] = useState<string>(() => computeDateRange('month').to);
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Reconciliation Modal States
  const [selectedFundForReconcile, setSelectedFundForReconcile] = useState<Fund | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = useState<number>(0);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [reconciling, setReconciling] = useState<boolean>(false);
  // Email prompt after successful reconciliation
  const [sendEmailAfterReconcile, setSendEmailAfterReconcile] = useState<boolean>(false);
  const [reconcileToast, setReconcileToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setReconcileToast({ type, message });
    setTimeout(() => setReconcileToast(null), 5000);
  };

  const loadFunds = async () => {
    setLoading(true);

    // Load settings for currency formatting
    const settingsRes = await fetchApi<any>('/settings');
    if (settingsRes.status === 'success' && settingsRes.data) {
      if (Array.isArray(settingsRes.data)) {
        const map: SettingsMap = {};
        settingsRes.data.forEach((s: any) => {
          if (s && s.key) {
            map[s.key] = s.value;
          }
        });
        setSettings(map);
      } else if (typeof settingsRes.data === 'object') {
        setSettings(settingsRes.data as SettingsMap);
      }
    }

    const res = await fetchApi<Fund[]>('/funds');
    if (res.status === 'success') {
      const fundList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res)
        ? (res as Fund[])
        : [];
      setFunds(fundList);
    }
    setLoading(false);
  };

  const loadPeriodSummary = async () => {
    setSummaryLoading(true);
    const res = await fetchApi<FundsPeriodSummaryResponse>(`/funds/period-summary?month=${selectedMonth}`);
    if (res.status === 'success' && res.data) {
      setPeriodSummary(res.data);
    }
    setSummaryLoading(false);
  };

  useEffect(() => {
    loadFunds();
  }, []);

  useEffect(() => {
    loadPeriodSummary();
  }, [selectedMonth]);

  const openReconcileModal = (fund: Fund) => {
    setSelectedFundForReconcile(fund);
    setActualBalanceInput(fund.current_balance);
    setReconcileNotes('');
  };

  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundForReconcile) return;

    setReconciling(true);
    const fundName = selectedFundForReconcile.name;
    const res = await fetchApi<any>(`/funds/${selectedFundForReconcile.id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({
        actual_balance: Number(actualBalanceInput),
        notes: reconcileNotes,
        created_by: 'Store Manager',
      }),
    });

    if (res.status === 'success') {
      setSelectedFundForReconcile(null);
      await loadFunds();
      await loadPeriodSummary();
      showToast('success', t('funds.reconcile_success', { name: fundName }));

      // Optionally dispatch an end-of-shift email report
      if (sendEmailAfterReconcile) {
        const today = new Date().toISOString().slice(0, 10);
        fetchApi<any>('/analytics/send-daily-report-email', {
          method: 'POST',
          body: JSON.stringify({ date: today }),
        }).then((emailRes) => {
          if (emailRes.status !== 'success') {
            console.warn('[FundsPage] Email report dispatch failed after reconciliation:', emailRes.message);
          }
        }).catch(console.warn);
      }
      setSendEmailAfterReconcile(false);
    } else {
      showToast('error', t('funds.reconcile_failed', { error: res.message }));
    }
    setReconciling(false);
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-indigo-600" />
              {t('funds.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('funds.subtitle')}
            </p>
          </div>
        </div>

        {/* Funds Real-Time Balance Cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(funds) ? funds : []).map((fund) => {
              const isBank = fund.fund_type === 'bank';

              return (
                <div
                  key={fund.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-200 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 rounded-2xl ${isBank ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isBank ? <Building2 className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{fund.name}</h3>
                        <span className="text-xs font-semibold text-slate-400 capitalize">
                          {t('funds.fund_type_label', { type: fund.fund_type })}
                        </span>
                      </div>
                    </div>

                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t('funds.active_badge')}
                    </span>
                  </div>

                  {/* Balance Display */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500 font-medium">{t('funds.theoretical_balance')}</span>
                      <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                        {formatCurrency(fund.current_balance, settings)}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => openReconcileModal(fund)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Scale className="w-4 h-4" /> {t('funds.reconcile_count')}
                    </button>
                    <Link
                      href={`/transactions?fund_id=${fund.id}`}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-3 rounded-xl flex items-center gap-1 transition"
                    >
                      <History className="w-4 h-4" /> {t('funds.history')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PERIODIC BALANCE SUMMARY (Opening vs Closing Period Audit) ─── */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-indigo-600" />
                {t('funds.period_summary_title')}
              </h2>
              <p className="text-xs text-slate-500">{t('funds.period_summary_subtitle')}</p>
            </div>

            {/* Modern Date Range / Month Picker */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-600">{t('funds.select_month')}:</span>
              <ModernDateRangePicker
                period={period}
                customFrom={customFrom}
                customTo={customTo}
                onChange={({ period: newP, from, to }) => {
                  setPeriod(newP);
                  setCustomFrom(from);
                  setCustomTo(to);
                  setSelectedMonth(from.slice(0, 7));
                }}
                align="right"
              />
            </div>
          </div>

          {/* Period Summary Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">{t('funds.fund_name')}</th>
                  <th className="py-3 px-4 text-right">{t('funds.opening_balance')}</th>
                  <th className="py-3 px-4 text-right text-emerald-600">(+) {t('funds.period_inflow')}</th>
                  <th className="py-3 px-4 text-right text-rose-600">(-) {t('funds.period_outflow')}</th>
                  <th className="py-3 px-4 text-right">{t('funds.closing_balance')}</th>
                  <th className="py-3 px-4 text-right">{t('funds.prev_closing_balance')}</th>
                  <th className="py-3 px-4 text-right">{t('funds.growth_rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : periodSummary?.funds && periodSummary.funds.length > 0 ? (
                  <>
                    {periodSummary.funds.map((f) => (
                      <tr key={f.fund_id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              f.fund_type === 'bank' ? 'bg-blue-500' : 'bg-emerald-500'
                            }`}
                          />
                          {f.fund_name}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-600 font-medium">
                          {formatCurrency(f.current_month.opening_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                          +{formatCurrency(f.current_month.total_inflow, settings)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-rose-600">
                          -{formatCurrency(f.current_month.total_outflow, settings)}
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                          {formatCurrency(f.current_month.closing_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          {formatCurrency(f.prev_month.closing_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              f.growth_pct >= 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {f.growth_pct >= 0 ? '+' : ''}
                            {f.growth_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Totals Row */}
                    {periodSummary?.totals && (
                      <tr className="bg-slate-50 font-extrabold text-slate-900 border-t-2 border-slate-200">
                        <td className="py-3 px-4 uppercase">{t('common.all')}</td>
                        <td className="py-3 px-4 text-right">
                          {formatCurrency(periodSummary.totals.current_month.opening_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-emerald-600">
                          +{formatCurrency(periodSummary.totals.current_month.total_inflow, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-rose-600">
                          -{formatCurrency(periodSummary.totals.current_month.total_outflow, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-indigo-600 text-sm">
                          {formatCurrency(periodSummary.totals.current_month.closing_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-500">
                          {formatCurrency(periodSummary.totals.prev_month.closing_balance, settings)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              periodSummary.totals.growth_pct >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {periodSummary.totals.growth_pct >= 0 ? '+' : ''}
                            {periodSummary.totals.growth_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {t('funds.no_summary_data')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reconcile Dialog Modal */}
      {selectedFundForReconcile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Scale className="w-5 h-5" />
                <h2 className="font-bold text-base text-slate-900">
                  {t('funds.reconcile_fund_title', { name: selectedFundForReconcile.name })}
                </h2>
              </div>
              <button
                onClick={() => setSelectedFundForReconcile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReconciliation} className="space-y-4 text-xs">
              {/* Theoretical Balance Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">{t('funds.theoretical_balance_label')}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(selectedFundForReconcile.current_balance, settings)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-800 mb-1 block">{t('funds.actual_balance_label')}</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  placeholder="500.000"
                  value={actualBalanceInput === 0 ? '' : actualBalanceInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setActualBalanceInput(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-base font-extrabold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Live Variance Calculation */}
              {(() => {
                const variance = actualBalanceInput - selectedFundForReconcile.current_balance;
                if (variance === 0) {
                  return (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{t('funds.variance_none')}</span>
                    </div>
                  );
                } else if (variance > 0) {
                  return (
                    <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{t('funds.variance_surplus', { amount: formatCurrency(variance, settings) })}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-rose-50 text-rose-900 rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{t('funds.variance_deficit', { amount: formatCurrency(Math.abs(variance), settings) })}</span>
                    </div>
                  );
                }
              })()}

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('funds.reconcile_notes_label')}</label>
                <textarea
                  rows={2}
                  placeholder={t('funds.reconcile_notes_placeholder')}
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email report option after reconciliation */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={sendEmailAfterReconcile}
                  onChange={(e) => setSendEmailAfterReconcile(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <Mail className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800">{t('email_report.funds_prompt_label')}</span>
              </label>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedFundForReconcile(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={reconciling}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {reconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('funds.submit_reconcile')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Toast Notification */}
      {reconcileToast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold ${
          reconcileToast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {reconcileToast.message}
        </div>
      )}
    </AppShell>
  );
}
