'use client';

import React from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { CartItem } from './VariantSelectorModal';
import { useTranslation } from '@/lib/i18n/LanguageContext';

export interface CompletedOrderData {
  order_code: string;
  created_at?: string;
  created_by?: string;
  payment_method?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
}

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: CompletedOrderData | null;
}

export default function ReceiptModal({ isOpen, onClose, order }: ReceiptModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Container */}
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Top Actions (Hidden during print) */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center space-x-2 text-emerald-600 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>{t('pos.order_completed')}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRINTABLE THERMAL RECEIPT (Targeted by CSS print) */}
        <div id="thermal-receipt" className="bg-white p-4 font-mono text-xs text-slate-900 leading-tight border border-dashed border-slate-300 rounded-2xl print:border-none print:p-0 print:m-0 print:shadow-none">
          {/* Header */}
          <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
            <h2 className="text-base font-extrabold tracking-tight uppercase">Thỏ Juice & Coffee</h2>
            <p className="text-[10px] text-slate-600">123 Vo Van Kiet, D1, HCMC</p>
            <p className="text-[10px] text-slate-600">Tel: 0901-234-567</p>
            <div className="pt-2 text-[10px] font-bold text-slate-800">
              <p>{t('pos.receipt_no', { code: order.order_code })}</p>
              <p className="font-normal text-slate-500">{formattedDate}</p>
              <p className="font-normal text-slate-500">{t('pos.cashier', { name: order.created_by || 'Staff' })}</p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-2">
            <div className="flex justify-between font-bold text-[10px] uppercase border-b border-slate-200 pb-1">
              <span>{t('pos.item')}</span>
              <span>{t('pos.qty_price')}</span>
              <span>{t('pos.line_total')}</span>
            </div>

            {order.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span className="truncate max-w-[140px]">{item.product.name}</span>
                  <span className="text-[10px]">{item.quantity}x ${item.unitPrice.toFixed(2)}</span>
                  <span>${item.lineTotal.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-500 pl-2">
                  <span>{t('pos.size', { size: item.selectedVariant.variant_name })}</span>
                  {item.notes && <span className="block italic">{t('pos.note', { note: item.notes })}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-right">
            <div className="flex justify-between">
              <span>{t('pos.subtotal')}:</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>{t('common.discount')}:</span>
                <span>-${order.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-200 text-slate-900">
              <span>{t('common.total_amount')}:</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 pt-1">
              <span>{t('pos.payment')}:</span>
              <span className="font-bold uppercase">{order.payment_method || 'Cash'}</span>
            </div>
          </div>

          {/* Footer Thank You */}
          <div className="text-center pt-3 text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-700">{t('pos.thank_you_title')}</p>
            <p className="italic">{t('pos.thank_you_sub')}</p>
          </div>
        </div>

        {/* Bottom Actions (Hidden during print) */}
        <div className="flex space-x-2 pt-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-center space-x-2 text-xs"
          >
            <Printer className="w-4 h-4" />
            <span>{t('pos.print_receipt')}</span>
          </button>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl text-xs transition"
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
