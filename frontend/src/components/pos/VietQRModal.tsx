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
}

export default function VietQRModal({ totalAmount, onClose, onConfirmOrder, settings }: Props) {
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-1.5 text-indigo-600 font-bold text-sm">
            <QrCode className="w-5 h-5" />
            <span>{t('pos.scan_vietqr_to_pay')}</span>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center space-y-2 text-slate-400 text-xs">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
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
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-3 text-left text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.bank_name')}:</span>
              <span className="font-bold text-indigo-900 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" /> MBBank (Napas 247)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.account_no')}:</span>
              <button
                onClick={copyAccount}
                className="font-mono font-bold text-indigo-600 flex items-center gap-1 hover:underline"
              >
                {qrData.account_no} {copied ? <span className="text-[10px] text-emerald-600 font-bold">{t('pos.copied')}</span> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t('pos.account_name')}:</span>
              <span className="font-semibold text-slate-900 uppercase">{qrData.account_name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-100 pt-1.5 font-bold">
              <span className="text-slate-700">{t('pos.amount')}:</span>
              <span className="text-indigo-600 text-sm">{formatCurrency(qrData.amount, settings)}</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
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
