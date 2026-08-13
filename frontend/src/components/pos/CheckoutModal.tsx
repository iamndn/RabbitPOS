'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, Building2, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

interface Props {
  totalAmount: number;
  onClose: () => void;
  onConfirmCashPayment: (fundId: number) => Promise<void> | void;
  onSelectBankTransfer: (fundId: number) => void;
}

export default function CheckoutModal({
  totalAmount,
  onClose,
  onConfirmCashPayment,
  onSelectBankTransfer,
}: Props) {
  const { t } = useTranslation();
  const [funds, setFunds] = useState<Fund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const loadFunds = async () => {
      setLoading(true);
      const res = await fetchApi<Fund[]>('/funds');
      if (res.status === 'success' && res.data) {
        setFunds(res.data);
        if (res.data.length > 0) {
          setSelectedFundId(res.data[0].id);
        }
      }
      setLoading(false);
    };
    loadFunds();
  }, []);

  const selectedFund = funds.find((f) => f.id === selectedFundId);

  const handleProceed = async () => {
    if (!selectedFundId || !selectedFund || isSubmitting) return;

    if (selectedFund.fund_type === 'bank') {
      onSelectBankTransfer(selectedFundId);
    } else {
      setIsSubmitting(true);
      try {
        await onConfirmCashPayment(selectedFundId);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-bold text-lg text-slate-900">{t('pos.select_payment_method')}</h2>
            <p className="text-xs text-slate-500">{t('pos.choose_target_fund')}</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Amount Display */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
          <span className="text-xs font-semibold uppercase text-indigo-600 tracking-wider">{t('pos.total_payable')}</span>
          <div className="text-3xl font-extrabold text-indigo-900 mt-1">${totalAmount.toFixed(2)}</div>
        </div>

        {/* Fund Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">{t('pos.target_fund_method')}</label>
          {loading ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {funds.map((fund) => {
                const isSelected = selectedFundId === fund.id;
                const isBank = fund.fund_type === 'bank';

                return (
                  <button
                    key={fund.id}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setSelectedFundId(fund.id)}
                    className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2.5 rounded-xl ${isBank ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {isBank ? <Building2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                      </div>
                      <div>
                        <span className="block font-bold text-sm text-slate-900">
                          {isBank ? t('pos.bank_transfer') : t('pos.cash_drawer')} ({fund.name})
                        </span>
                        <span className="text-xs text-slate-500 capitalize">{fund.fund_type}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Proceed Action Button */}
        <div className="pt-2">
          <button
            onClick={handleProceed}
            disabled={!selectedFundId || isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('pos.processing')}</span>
              </>
            ) : (
              <>
                <span>
                  {selectedFund?.fund_type === 'bank'
                    ? t('pos.generate_vietqr')
                    : t('pos.complete_cash_payment')}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
