'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  X,
  Send,
  Calendar,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  TrendingDown,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { SettingsMap, formatCurrency } from '@/lib/utils';
import { getLocalDateStr } from '@/components/common/ModernDateRangePicker';
import { RevenueAnalyticsResponse, ProfitAnalyticsResponse } from '@/types/analytics';

interface EmailReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  settings?: SettingsMap | null;
  onSuccess?: (message: string) => void;
}

const DEFAULT_RECIPIENTS = [
  'nhanhdn.jfw@gmail.com',
  'candynhung754@gmail.com',
  '150498tranquangdat@gmail.com',
];

export default function EmailReportModal({
  isOpen,
  onClose,
  initialDate,
  settings,
  onSuccess,
}: EmailReportModalProps) {
  const { t } = useTranslation();

  const [emailDate, setEmailDate] = useState<string>(() => initialDate || getLocalDateStr());
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live KPI Preview States
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewRevenue, setPreviewRevenue] = useState<number>(0);
  const [previewOrders, setPreviewOrders] = useState<number>(0);
  const [previewExpense, setPreviewExpense] = useState<number>(0);
  const [previewProfit, setPreviewProfit] = useState<number>(0);

  // Initialize recipients from settings or fallback
  useEffect(() => {
    if (!isOpen) return;

    if (initialDate) {
      setEmailDate(initialDate);
    } else {
      setEmailDate(getLocalDateStr());
    }

    if (settings?.report_recipient_emails) {
      const parsed = settings.report_recipient_emails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
      if (parsed.length > 0) {
        setRecipients(parsed);
      } else {
        setRecipients([...DEFAULT_RECIPIENTS]);
      }
    } else {
      setRecipients([...DEFAULT_RECIPIENTS]);
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, settings, initialDate]);

  // Fetch Live KPI preview whenever emailDate changes
  useEffect(() => {
    if (!isOpen || !emailDate) return;

    let isMounted = true;
    const fetchPreviewData = async () => {
      setPreviewLoading(true);
      try {
        const query = `?period=day&from=${emailDate}&to=${emailDate}`;
        const [revRes, profitRes] = await Promise.all([
          fetchApi<RevenueAnalyticsResponse>(`/analytics/revenue${query}`),
          fetchApi<ProfitAnalyticsResponse>(`/analytics/profit${query}`),
        ]);

        if (!isMounted) return;

        if (revRes.status === 'success' && revRes.data?.summary) {
          setPreviewRevenue(revRes.data.summary.net_revenue || 0);
          setPreviewOrders(revRes.data.summary.completed_order_count || 0);
        } else {
          setPreviewRevenue(0);
          setPreviewOrders(0);
        }

        if (profitRes.status === 'success' && profitRes.data?.summary) {
          setPreviewProfit(profitRes.data.summary.net_profit || 0);
          setPreviewExpense(profitRes.data.summary.operating_expenses || 0);
        } else {
          setPreviewProfit(0);
          setPreviewExpense(0);
        }
      } catch (err) {
        console.warn('Failed to load preview for email report:', err);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    fetchPreviewData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, emailDate]);

  if (!isOpen) return null;

  const handleAddEmail = () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setErrorMsg('Địa chỉ email không đúng định dạng');
      return;
    }
    if (recipients.includes(trimmed)) {
      setErrorMsg('Email này đã có trong danh sách');
      return;
    }
    setRecipients([...recipients, trimmed]);
    setNewEmailInput('');
    setErrorMsg(null);
  };

  const handleRemoveEmail = (target: string) => {
    if (recipients.length <= 1) {
      setErrorMsg('Cần ít nhất 1 email nhận báo cáo');
      return;
    }
    setRecipients(recipients.filter((e) => e !== target));
    setErrorMsg(null);
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setErrorMsg('Vui lòng thêm ít nhất một email nhận báo cáo');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetchApi<any>('/analytics/send-daily-report-email', {
        method: 'POST',
        body: JSON.stringify({
          date: emailDate,
          recipients: recipients,
        }),
      });

      if (res.status === 'success') {
        const msg = `Báo cáo tài chính ngày ${emailDate} đã được gửi thành công đến ${recipients.length} email!`;
        setSuccessMsg(msg);
        if (onSuccess) onSuccess(msg);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Gửi email thất bại. Vui lòng kiểm tra lại cấu hình SMTP.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối khi gửi báo cáo qua email');
    } finally {
      setIsSending(false);
    }
  };

  const setQuickDate = (type: 'today' | 'yesterday') => {
    const now = new Date();
    if (type === 'yesterday') {
      now.setDate(now.getDate() - 1);
    }
    const dStr = now.toISOString().slice(0, 10);
    setEmailDate(dStr);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150 pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-2xs text-indigo-600">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">
                Gửi Báo Cáo Tài Chính Qua Email
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Tổng hợp doanh thu, chi phí và gửi báo cáo kết ca tự động
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Date Selector Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Ngày chốt báo cáo</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate('today')}
                  className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                >
                  Hôm nay
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('yesterday')}
                  className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                >
                  Hôm qua
                </button>
              </div>
            </div>
            <input
              type="date"
              value={emailDate}
              onChange={(e) => setEmailDate(e.target.value)}
              className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[42px]"
            />
          </div>

          {/* Live KPI Preview for Selected Date */}
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Số liệu tóm tắt ngày {emailDate}
              </span>
              {previewLoading && (
                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                  <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                  Đang tải...
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Doanh thu thuần</span>
                <span className="text-xs sm:text-sm font-black text-slate-900 mt-0.5 block">
                  {formatCurrency(previewRevenue, settings)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Số đơn hàng</span>
                <span className="text-xs sm:text-sm font-black text-indigo-600 mt-0.5 block">
                  {previewOrders} đơn
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Chi phí vận hành</span>
                <span className="text-xs sm:text-sm font-black text-rose-600 mt-0.5 block">
                  {formatCurrency(previewExpense, settings)}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-semibold block">Lợi nhuận ròng</span>
                <span
                  className={`text-xs sm:text-sm font-black mt-0.5 block ${
                    previewProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(previewProfit, settings)}
                </span>
              </div>
            </div>
          </div>

          {/* Recipients Management */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Danh sách email người nhận ({recipients.length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Quản trị & Quản lý</span>
            </label>

            {/* Email chips */}
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/60 rounded-xl border border-slate-200 min-h-[42px] items-center">
              {recipients.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 text-[11px] bg-white text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1 font-semibold shadow-2xs group"
                >
                  <span>{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="text-slate-400 hover:text-rose-600 transition cursor-pointer"
                    title="Xóa email này"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add new email input */}
            <div className="flex items-center gap-1.5">
              <input
                type="email"
                placeholder="Thêm email nhận khác (VD: quanly@email.com)..."
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEmail();
                  }
                }}
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[38px]"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer min-h-[38px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Nội dung email sẽ bao gồm bảng chi tiết doanh thu, chi phí, quỹ tiền và file đính kèm.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-2.5 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="w-full text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 py-2.5 rounded-xl transition cursor-pointer text-center justify-center flex items-center"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="w-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer shadow-xs text-center"
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang gửi báo cáo...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Gửi Báo Cáo Ngay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
