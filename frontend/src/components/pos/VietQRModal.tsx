import React, { useEffect, useState } from 'react';
import { CheckCircle2, QrCode, RefreshCw, Copy, Building2 } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { Badge, Button, ModalShell } from '@/components/ui';

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

  const channelBadge =
    salesChannel && salesChannel !== 'dine_in' ? (
      <Badge
        variant={
          salesChannel === 'grabfood'
            ? 'success'
            : salesChannel === 'shopeefood' || salesChannel === 'befood'
            ? 'warning'
            : 'info'
        }
        size="sm"
      >
        {salesChannel === 'shopeefood'
          ? t('pos.channel_shopeefood')
          : salesChannel === 'grabfood'
          ? t('pos.channel_grabfood')
          : salesChannel === 'befood'
          ? t('pos.channel_befood')
          : t('pos.channel_takeaway')}
      </Badge>
    ) : null;

  return (
    <ModalShell
      isOpen={true}
      onClose={onClose}
      nested
      size="sm"
      preventClose={isSubmitting}
      icon={<QrCode className="w-5 h-5" />}
      title={t('pos.scan_vietqr_to_pay')}
      headerActions={channelBadge}
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          onClick={handleConfirm}
          leftIcon={<CheckCircle2 className="w-5 h-5" />}
        >
          {t('pos.confirm_payment_received')}
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Opaque White QR Code Stage (Maximum Camera Contrast — 0px blur behind QR) */}
        <div className="bg-surface-card p-4 rounded-card border border-card shadow-card flex flex-col items-center justify-center min-h-[248px] text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500 text-footnote">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
              <span>{t('pos.generating_qr')}</span>
            </div>
          ) : qrData?.qr_url ? (
            <div className="space-y-2.5">
              <div className="bg-white p-2.5 rounded-field border border-hairline inline-block">
                <img
                  src={qrData.qr_url}
                  alt="Napas 247 VietQR Code"
                  className="w-52 h-52 object-contain mx-auto"
                />
              </div>
              <p className="text-caption text-slate-500 font-medium max-w-xs mx-auto leading-snug">
                {t('pos.scan_banking_app')}
              </p>
            </div>
          ) : (
            <span className="text-footnote text-rose-600 font-semibold">{t('pos.failed_qr')}</span>
          )}
        </div>

        {/* Account Details Card */}
        {qrData && (
          <div className="bg-surface-card border border-card shadow-card rounded-card p-3.5 text-left text-footnote space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{t('pos.bank_name')}:</span>
              <span className="font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                <span>MBBank (Napas 247)</span>
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{t('pos.account_no')}:</span>
              <button
                type="button"
                onClick={copyAccount}
                className="font-num font-bold text-brand-700 inline-flex items-center gap-1.5 hover:underline active:scale-[0.97] transition-transform"
              >
                <span>{qrData.account_no}</span>
                {copied ? (
                  <span className="text-caption font-semibold text-emerald-600">
                    {t('pos.copied')}
                  </span>
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{t('pos.account_name')}:</span>
              <span className="font-semibold text-slate-900 uppercase truncate">
                {qrData.account_name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2 font-semibold">
              <span className="text-slate-700">{t('pos.amount')}:</span>
              <span className="text-brand-700 text-headline font-bold font-num">
                {formatCurrency(qrData.amount, settings)}
              </span>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
