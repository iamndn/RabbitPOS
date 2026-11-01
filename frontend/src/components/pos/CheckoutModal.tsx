import React, { useState, useEffect } from 'react';
import { Wallet, Building2, Check, ArrowRight, RefreshCw } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { Button, ModalShell } from '@/components/ui';

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
  settings?: SettingsMap | null;
}

export default function CheckoutModal({
  totalAmount,
  onClose,
  onConfirmCashPayment,
  onSelectBankTransfer,
  settings,
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
      if (res.status === 'success') {
        const fundList = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res)
          ? (res as Fund[])
          : [];
        setFunds(fundList);
        if (fundList.length > 0) {
          setSelectedFundId(fundList[0].id);
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
    <ModalShell
      isOpen={true}
      onClose={onClose}
      nested
      size="sm"
      preventClose={isSubmitting}
      icon={<Wallet className="w-5 h-5" />}
      title={t('pos.select_payment_method')}
      description={t('pos.choose_target_fund')}
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          disabled={!selectedFundId || isSubmitting}
          onClick={handleProceed}
          rightIcon={<ArrowRight className="w-4 h-4" />}
        >
          {selectedFund?.fund_type === 'bank'
            ? t('pos.generate_vietqr')
            : t('pos.complete_cash_payment')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Total Amount Display */}
        <div className="bg-brand-50/85 border border-brand-200/80 rounded-card p-4 text-center">
          <span className="text-footnote font-semibold text-brand-700 block">
            {t('pos.total_payable')}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-brand-950 font-num mt-1">
            {formatCurrency(totalAmount, settings)}
          </div>
        </div>

        {/* Fund Selection */}
        <div className="space-y-2">
          <label className="text-footnote font-semibold text-slate-700 block">
            {t('pos.target_fund_method')}
          </label>
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 text-brand-600 animate-spin" />
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
                    className={`w-full min-h-[58px] p-3.5 rounded-card border text-left flex items-center justify-between gap-3 transition-all duration-press ease-press active:scale-[0.98] disabled:opacity-45 ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50/75 ring-2 ring-brand-500/20'
                        : 'bg-surface-card border-card shadow-card hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-field flex items-center justify-center shrink-0 ${
                          isBank
                            ? 'bg-sky-50 text-sky-700 border border-sky-200/80'
                            : 'bg-brand-50 text-brand-700 border border-brand-200/80'
                        }`}
                      >
                        {isBank ? <Building2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <span className="block font-semibold text-subhead text-slate-900 truncate">
                          {isBank ? t('pos.bank_transfer') : t('pos.cash_drawer')} ({fund.name})
                        </span>
                        <span className="text-footnote text-slate-500 capitalize">
                          {fund.fund_type}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-brand-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
