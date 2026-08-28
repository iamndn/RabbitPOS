'use client';

import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { CartItem } from './VariantSelectorModal';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi, getImageUrl } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';

export interface CompletedOrderData {
  order_code: string;
  created_at?: string;
  created_by?: string;
  cashier_name?: string;
  payment_method?: string;
  fund_name?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discount_amount?: number;
  promotion_discount?: number;
  promotion_name?: string;
  shipping_fee?: number;
  platform_fee_discount?: number;
  surcharge?: number;
  total: number;
  final_total?: number;
  note?: string;
  is_offline_provisional?: boolean;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CompletedOrderData | null;
  settings?: SettingsMap | null;
}

export default function ReceiptModal({ isOpen, onClose, order, settings: initialSettings }: ReceiptModalProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingsMap | null>(initialSettings || null);

  useEffect(() => {
    if (isOpen && !settings) {
      const loadSettings = async () => {
        const res = await fetchApi<any>('/settings');
        if (res.status === 'success' && res.data) {
          if (Array.isArray(res.data)) {
            const map: SettingsMap = {};
            res.data.forEach((s: any) => {
              if (s && s.key) map[s.key] = s.value;
            });
            setSettings(map);
          } else if (typeof res.data === 'object') {
            setSettings(res.data as SettingsMap);
          }
        }
      };
      loadSettings();
    }
  }, [isOpen, settings]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleString('vi-VN')
    : new Date().toLocaleString('vi-VN');

  const storeName = settings?.store_name || 'Thỏ Juice & Coffee';
  const storeAddress = settings?.store_address || '123 Vo Van Kiet, D1, HCMC';
  const storePhone = settings?.store_phone || '0901234567';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Container */}
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe hardware-accelerated">
        {/* Mobile Drag Indicator */}
        <div className="flex justify-center sm:hidden pt-0.5 pb-1 print:hidden">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Top Actions (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>{t('pos.order_completed')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE THERMAL RECEIPT (Targeted by CSS print) */}
        <div id="thermal-receipt" className="bg-white p-4 font-mono text-xs text-slate-900 leading-tight border border-dashed border-slate-300 rounded-2xl print:border-none print:p-0 print:m-0 print:shadow-none">
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            {/* Store logo */}
            {settings?.store_logo_url && (
              <div className="flex justify-center mb-2">
                <img
                  src={getImageUrl(settings.store_logo_url) || settings.store_logo_url}
                  alt="Store logo"
                  className="h-12 max-w-[120px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}
            <h2 className="text-base font-black tracking-tight uppercase text-slate-900">{storeName}</h2>
            <p className="text-[10px] text-slate-600">{storeAddress}</p>
            <p className="text-[10px] text-slate-600">Hotline: {storePhone}</p>
            <div className="pt-2">
              {order.is_offline_provisional ? (
                <div className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px] py-1 px-2 rounded-md my-1 text-center tracking-wider uppercase">
                  ⚠️ PHIẾU TẠM - CHƯA ĐỒNG BỘ
                </div>
              ) : (
                <span className="inline-block text-xs font-black tracking-widest uppercase border-y border-slate-800 py-0.5 my-1">
                  PHIẾU THANH TOÁN
                </span>
              )}
            </div>
            <div className="pt-1 text-[10px] text-slate-700 text-left space-y-0.5">
              <div className="flex justify-between">
                <span>Số phiếu:</span>
                <span className="font-bold">#{order.order_code}</span>
              </div>
              <div className="flex justify-between">
                <span>Ngày giờ:</span>
                <span>{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span>Thu ngân:</span>
                <span>{order.cashier_name || order.created_by || 'Nhân viên'}</span>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
            <div className="flex justify-between font-bold text-[10px] uppercase border-b border-slate-200 pb-1">
              <span>{t('pos.item')}</span>
              <span>{t('pos.qty_price')}</span>
              <span>{t('pos.line_total')}</span>
            </div>

            {(Array.isArray(order.items) ? order.items : []).map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span className="truncate max-w-[130px]">{item.product.name}</span>
                  <span className="text-[10px]">{item.quantity}x {formatCurrency(item.unitPrice, settings)}</span>
                  <span>{formatCurrency(item.lineTotal, settings)}</span>
                </div>
                <div className="text-[10px] text-slate-500 pl-2 space-y-0.5">
                  <span className="block">{t('pos.size', { size: item.selectedVariant.variant_name })}</span>
                  {/* Sugar & ice level display */}
                  {(item.sugarLevel || item.iceLevel) && (
                    <span className="block">
                      {item.sugarLevel ? `Đường: ${item.sugarLevel}%` : ''}
                      {item.sugarLevel && item.iceLevel ? ' · ' : ''}
                      {item.iceLevel ? `Đá: ${item.iceLevel}%` : ''}
                    </span>
                  )}
                  {/* Toppings display */}
                  {Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0 && (
                    <span className="block">
                      Topping: {item.selectedToppings.map((tp) => tp.name).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Order Note if present */}
          {order.note && (
            <div className="py-2 border-b border-dashed border-slate-300 text-left">
              <span className="font-bold text-[10px] uppercase text-slate-700 block mb-0.5">
                {t('common.notes')}:
              </span>
              <p className="text-[11px] text-slate-800 italic break-words pl-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                {order.note}
              </p>
            </div>
          )}

          {/* Totals & Discounts Breakdown */}
          <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-right">
            <div className="flex justify-between">
              <span className="text-slate-600">{t('pos.cart_total')}:</span>
              <span>{formatCurrency(order.subtotal, settings)}</span>
            </div>

            {order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{t('common.discount')}:</span>
                <span>-{formatCurrency(order.discount_amount, settings)}</span>
              </div>
            )}

            {order.promotion_discount && order.promotion_discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{order.promotion_name || t('pos.promotion_discount')}:</span>
                <span>-{formatCurrency(order.promotion_discount, settings)}</span>
              </div>
            )}

            {order.platform_fee_discount && order.platform_fee_discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{t('pos.platform_discount')}:</span>
                <span>-{formatCurrency(order.platform_fee_discount, settings)}</span>
              </div>
            )}

            {order.shipping_fee && order.shipping_fee > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{t('pos.shipping_fee')}:</span>
                <span>+{formatCurrency(order.shipping_fee, settings)}</span>
              </div>
            )}

            {order.surcharge && order.surcharge > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>{t('pos.surcharge')}:</span>
                <span>+{formatCurrency(order.surcharge, settings)}</span>
              </div>
            )}

            <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-800 text-slate-900">
              <span className="uppercase">{t('common.total_amount')}:</span>
              <span>{formatCurrency(order.final_total || order.total, settings)}</span>
            </div>

            {/* Payment Method Badge */}
            <div className="flex justify-between text-[10px] text-slate-500 pt-1">
              <span>{t('pos.payment_method_label')}:</span>
              <span className="font-semibold uppercase">
                {order.payment_method === 'bank' ? t('pos.bank_transfer') : t('pos.cash_drawer')}
                {order.fund_name ? ` (${order.fund_name})` : ''}
              </span>
            </div>
          </div>

          {/* Footer Thank You */}
          <div className="text-center pt-3 text-[10px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">{t('pos.thank_you_title')}</p>
            <p className="italic">{t('pos.thank_you_sub')}</p>
            {order.is_offline_provisional && (
              <p className="text-[9px] text-amber-800 font-bold pt-1 border-t border-dashed border-amber-200 mt-2">
                * Đơn hàng tạo ngoại tuyến và sẽ tự động đồng bộ khi có Internet.
              </p>
            )}
          </div>
        </div>

        {/* Bottom Actions (Hidden during print) */}
        <div className="flex space-x-2 pt-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>{t('pos.print_receipt')}</span>
          </button>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl text-xs transition active:scale-95"
          >
            {t('common.close')}
          </button>
        </div>
      </div>

      {/* Global CSS for Thermal Printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt, #thermal-receipt * {
            visibility: visible;
          }
          #thermal-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 0;
            margin: 0;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
}
