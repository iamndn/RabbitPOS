'use client';

import React from 'react';
import { ChevronDown, Package } from 'lucide-react';
import { PurchaseItem } from '@/types/purchase';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface PurchaseVoucherProps {
  items: PurchaseItem[];
  settings: SettingsMap | null;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Badge + inline expansion showing the itemized ingredient purchase voucher
 * attached to a ledger outflow transaction.
 */
export default function PurchaseVoucher({ items, settings, expanded, onToggle }: PurchaseVoucherProps) {
  const { t } = useTranslation();
  const label = t('tx.purchase_voucher', { count: items.length });

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 px-2 py-1 rounded-lg transition cursor-pointer"
      >
        <Package className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] tabular-nums">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left font-bold px-2.5 py-1.5">{t('tx.voucher_col_item')}</th>
                  <th className="text-right font-bold px-2.5 py-1.5">{t('tx.voucher_col_qty')}</th>
                  <th className="text-right font-bold px-2.5 py-1.5">{t('tx.voucher_col_price')}</th>
                  <th className="text-right font-bold px-2.5 py-1.5">{t('tx.voucher_col_loss')}</th>
                  <th className="text-right font-bold px-2.5 py-1.5">{t('tx.voucher_col_subtotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((pi, idx) => (
                  <tr key={pi.id ?? idx}>
                    <td className="px-2.5 py-1.5 font-semibold text-slate-800">{pi.ingredient?.name || pi.ingredient_name}</td>
                    <td className="px-2.5 py-1.5 text-right text-slate-700">
                      {pi.quantity} {pi.unit || pi.ingredient?.unit}
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-slate-700">{formatCurrency(pi.unit_price, settings)}</td>
                    <td className="px-2.5 py-1.5 text-right text-slate-500">
                      {pi.loss_rate ? `${pi.loss_rate}%` : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-bold text-slate-900">{formatCurrency(pi.subtotal, settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
