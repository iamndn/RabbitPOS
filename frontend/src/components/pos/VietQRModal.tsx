import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, QrCode, RefreshCw, Copy, Building2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';

interface VietQRData {
  order_code: string;
  bank_id: string;
  account_no: string;
  account_name: string;
  amount: number;
  qr_url: string;
}

interface Props {
  totalAmount: number;
  onClose: () => void;
  onConfirmOrder: () => Promise<void> | void;
  settings?: SettingsMap | null;
  salesChannel?: string;
}

export default function VietQRModal({ totalAmount, onClose, onConfirmOrder, settings, salesChannel }: Props) {
  const { t } = useTranslation();
  const [qrData, setQrData] = useState<VietQRData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const fetchQR = async () => {
      setLoading(true);
      const tempOrderCode = `ORD-${Date.now().toString().slice(-6)}`;
      const res = await fetchApi<VietQRData>(
        `/vietqr/generate?amount=${totalAmount}&order_code=${tempOrderCode}`
      );
      if (res.status === 'success' && res.data) {
        setQrData(res.data);
      }
      setLoading(false);
    };
    fetchQR();
  }, [totalAmount]);

  const copyAccount = () => {
    if (!qrData) return;
    navigator.clipboard.writeText(qrData.account_no);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmOrder();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 hardware-accelerated pb-safe max-h-[92dvh] overflow-y-auto">
        {/* Mobile Drag Indicator */}
        <div className="flex justify-center sm:hidden pt-0.5 pb-1">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2 text-indigo-700 font-bold text-sm">
            <QrCode className="w-5 h-5 text-indigo-600" />
            <span>{t('pos.scan_vietqr_to_pay')}</span>
            {salesChannel && salesChannel !== 'dine_in' && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                salesChannel === 'shopeefood'
                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                  : salesChannel === 'grabfood'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : salesChannel === 'befood'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {salesChannel === 'shopeefood'
                  ? 'ShopeeFood'
                  : salesChannel === 'grabfood'
                  ? 'GrabFood'
                  : salesChannel === 'befood'
                  ? 'BeFood'
                  : 'Mang về'}
              </span>
            )}
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50 active:scale-95 transition-transform">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center space-y-2 text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-700" />
              <span>{t('pos.generating_qr')}</span>
            </div>
          ) : qrData?.qr_url ? (
            <div className="space-y-2">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 inline-block">
                <img
                  src={qrData.qr_url}
                  alt="Napas 247 VietQR Code"
                  className="w-52 h-52 object-contain mx-auto"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">{t('pos.scan_banking_app')}</p>
            </div>
          ) : (
            <span className="text-xs text-rose-500 font-semibold">{t('pos.failed_qr')}</span>
          )}
        </div>

        {/* Account Details Card */}
        {qrData && (
          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.bank_name')}:</span>
              <span className="font-bold text-purple-950 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-purple-700" /> MBBank (Napas 247)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.account_no')}:</span>
              <button
                onClick={copyAccount}
                className="font-mono font-bold text-purple-700 flex items-center gap-1 hover:underline active:scale-95 transition-transform"
              >
                {qrData.account_no} {copied ? <span className="text-[10px] text-purple-600 font-bold">{t('pos.copied')}</span> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.account_name')}:</span>
              <span className="font-semibold text-slate-900 uppercase">{qrData.account_name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-purple-100 pt-1.5 font-bold">
              <span className="text-slate-700">{t('pos.amount')}:</span>
              <span className="text-purple-800 text-sm">{formatCurrency(qrData.amount, settings)}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full bg-purple-700 hover:bg-purple-800 disabled:bg-slate-300 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm active:scale-95"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>{t('pos.processing')}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>{t('pos.confirm_payment_received')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
