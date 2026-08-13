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
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

export default function FundsPage() {
  const { t } = useTranslation();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Reconciliation Modal States
  const [selectedFundForReconcile, setSelectedFundForReconcile] = useState<Fund | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = useState<number>(0);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [reconciling, setReconciling] = useState<boolean>(false);

  const loadFunds = async () => {
    setLoading(true);

    // Load settings for currency formatting
    const settingsRes = await fetchApi<{ key: string; value: string }[]>('/settings');
    if (settingsRes.status === 'success' && settingsRes.data) {
      const map: SettingsMap = {};
      settingsRes.data.forEach((s) => { map[s.key] = s.value; });
      setSettings(map);
    }

    const res = await fetchApi<Fund[]>('/funds');
    if (res.status === 'success' && res.data) {
      setFunds(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFunds();
  }, []);

  const openReconcileModal = (fund: Fund) => {
    setSelectedFundForReconcile(fund);
    setActualBalanceInput(fund.current_balance);
    setReconcileNotes('');
  };

  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundForReconcile) return;

    setReconciling(true);
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
      loadFunds();
      alert(`✅ ${selectedFundForReconcile.name} balance reconciled successfully!`);
    } else {
      alert('Failed to reconcile balance: ' + res.message);
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

        {/* Funds Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {funds.map((fund) => {
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
                  step="0.01"
                  min="0"
                  required
                  value={actualBalanceInput}
                  onChange={(e) => setActualBalanceInput(parseFloat(e.target.value) || 0)}
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
                  placeholder="e.g. End of day cash drawer audit count..."
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

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
    </AppShell>
  );
}
