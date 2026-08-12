'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  X,
  Building2,
  Wallet,
  ShoppingBag,
  FileText,
  Download,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { exportToCsv } from '@/lib/exportCsv';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
}

interface Transaction {
  id: number;
  fund_id: number;
  fund?: Fund;
  transaction_type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  reference_order_id?: number;
  reference_order?: { order_code: string };
  description: string;
  created_by: string;
  created_at: string;
}

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [modalFundId, setModalFundId] = useState<number>(0);
  const [modalType, setModalType] = useState<'inflow' | 'outflow'>('outflow');
  const [modalCategory, setModalCategory] = useState<string>('ingredient_purchase');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalDescription, setModalDescription] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    const fundRes = await fetchApi<Fund[]>('/funds');
    if (fundRes.status === 'success' && fundRes.data) {
      setFunds(fundRes.data);
      if (fundRes.data.length > 0 && modalFundId === 0) {
        setModalFundId(fundRes.data[0].id);
      }
    }

    const txRes = await fetchApi<Transaction[]>('/transactions');
    if (txRes.status === 'success' && txRes.data) {
      setTransactions(txRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFundId || modalAmount <= 0) return;

    const res = await fetchApi<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        fund_id: modalFundId,
        transaction_type: modalType,
        category: modalCategory,
        amount: Number(modalAmount),
        description: modalDescription,
        created_by: 'Manager',
      }),
    });

    if (res.status === 'success') {
      setIsExpenseModalOpen(false);
      setModalAmount(0);
      setModalDescription('');
      loadData();
    } else {
      alert('Failed to log transaction: ' + res.message);
    }
  };

  const handleExportCsv = () => {
    exportToCsv<Transaction>('rabbitpos_transactions', filteredTransactions, [
      { header: 'ID', accessor: (tx) => tx.id },
      { header: 'Date', accessor: (tx) => new Date(tx.created_at).toLocaleString() },
      { header: 'Type', accessor: (tx) => tx.transaction_type },
      { header: 'Category', accessor: (tx) => tx.category },
      { header: 'Fund Account', accessor: (tx) => tx.fund?.name || tx.fund_id },
      { header: 'Amount ($)', accessor: (tx) => tx.amount.toFixed(2) },
      { header: 'Ref Order', accessor: (tx) => tx.reference_order?.order_code || '' },
      { header: 'Description', accessor: (tx) => tx.description },
      { header: 'Created By', accessor: (tx) => tx.created_by },
    ]);
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesFund = selectedFundId ? tx.fund_id === selectedFundId : true;
    const matchesType = selectedType !== 'all' ? tx.transaction_type === selectedType : true;
    const matchesCat = selectedCategory !== 'all' ? tx.category === selectedCategory : true;
    return matchesFund && matchesType && matchesCat;
  });

  const totalInflow = transactions
    .filter((tx) => tx.transaction_type === 'inflow')
    .reduce((acc, tx) => acc + tx.amount, 0);

  const totalOutflow = transactions
    .filter((tx) => tx.transaction_type === 'outflow')
    .reduce((acc, tx) => acc + tx.amount, 0);

  const netCashFlow = totalInflow - totalOutflow;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              {t('tx.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('tx.subtitle')}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4 text-slate-500" /> Export CSV
            </button>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('tx.add_expense')}
            </button>
          </div>
        </div>

        {/* KPI Summary Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('tx.inflows')}</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">${totalInflow.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('tx.outflows')}</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">${totalOutflow.toFixed(2)}</div>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('tx.net_cash_flow')}</span>
              <div className={`text-2xl font-extrabold mt-1 ${netCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                ${netCashFlow.toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedFundId || ''}
              onChange={(e) => setSelectedFundId(e.target.value ? Number(e.target.value) : null)}
              className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="">All Payment Funds</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="all">All Types</option>
              <option value="inflow">Inflows (+)</option>
              <option value="outflow">Outflows (-)</option>
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
            >
              <option value="all">All Categories</option>
              <option value="sale">Sales</option>
              <option value="ingredient_purchase">Ingredient Purchase</option>
              <option value="utility_bill">Utility Bill</option>
              <option value="reconciliation_variance">Reconciliation Variance</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Transaction History Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Fund</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description / Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No financial transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isInflow = tx.transaction_type === 'inflow';
                    const dateStr = new Date(tx.created_at).toLocaleString();

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4 text-slate-600 font-mono">{dateStr}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {tx.fund?.name || 'Unknown Fund'}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${
                              isInflow
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isInflow ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                            {isInflow ? 'Inflow (+)' : 'Outflow (-)'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {tx.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {tx.description}
                          {tx.reference_order?.order_code && (
                            <span className="ml-1.5 font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {tx.reference_order.order_code}
                            </span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-right font-extrabold text-sm ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isInflow ? '+' : '-'}${tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Expense / Inflow Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-lg text-slate-900">Log Manual Expense / Inflow</h2>
              <button onClick={() => setIsExpenseModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Transaction Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('outflow');
                      setModalCategory('ingredient_purchase');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      modalType === 'outflow'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Outflow Expense (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('inflow');
                      setModalCategory('other');
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      modalType === 'inflow'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Manual Inflow (+)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Target Fund *</label>
                <select
                  value={modalFundId}
                  onChange={(e) => setModalFundId(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.fund_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Category *</label>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {modalType === 'outflow' ? (
                    <>
                      <option value="ingredient_purchase">Ingredient Purchase (Milk, Ice, Coffee Beans)</option>
                      <option value="utility_bill">Utility Bill (Electricity, Water, Internet)</option>
                      <option value="other">Other Expense</option>
                    </>
                  ) : (
                    <>
                      <option value="sale">Manual Sale</option>
                      <option value="other">Other Manual Inflow</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={modalAmount || ''}
                  onChange={(e) => setModalAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Purchased 10L condensed milk..."
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
                >
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
