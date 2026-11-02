'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  Minus,
  Plus,
  Equal,
  Percent,
  Coins,
  ShoppingBag,
  Truck,
  CheckCircle2,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { RevenueSummary } from '@/types/analytics';
import DiscountedOrdersModal from './DiscountedOrdersModal';

interface Props {
  revSummary?: RevenueSummary | null;
  settings?: SettingsMap | null;
  from?: string;
  to?: string;
  periodName?: string;
}

export default function WaterfallReconciliationWidget({
  revSummary,
  settings,
  from,
  to,
  periodName,
}: Props) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const grossSales = revSummary?.total_gross_sales || 0;
  const totalDiscounts = revSummary?.total_discounts || 0;
  const shippingFees = revSummary?.total_shipping_fees || 0;
  const surcharges = revSummary?.total_surcharges || 0;
  const totalExtra = shippingFees + surcharges;
  const netRevenue = revSummary?.net_revenue || 0;
  const completedOrders = revSummary?.completed_order_count || 0;
  const discountedOrders = revSummary?.discounted_order_count || 0;

  const discountRate = grossSales > 0 ? (totalDiscounts / grossSales) * 100 : 0;

  return (
    <>
      <div className="surface-card rounded-2xl border-card shadow-card p-4 sm:p-5 space-y-4 overflow-hidden relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-card pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-brand-purple rounded-xl border border-purple-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                <span>Đối Soát Doanh Thu vs Thực Thu</span>
                <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-purple-50 text-brand-purple border border-purple-200 flex items-center gap-1 font-num">
                  <CheckCircle2 className="w-3 h-3" />
                  Khớp Sổ Thu Chi
                </span>
              </h3>
              <p className="text-caption text-slate-400">
                Sơ đồ dòng chảy minh bạch: Từ giá niêm yết $\to$ Giảm giá $\to$ Tiền thực tế vào két & ngân hàng
              </p>
            </div>
          </div>

          {/* Quick Action Button to Open Modal */}
          {totalDiscounts > 0 && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-full transition shadow-card cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
            >
              <Percent className="w-3.5 h-3.5" />
              <span>Xem {discountedOrders > 0 ? `${discountedOrders} đơn` : 'các đơn'} được giảm giá</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </button>
          )}
        </div>

        {/* Waterfall Flow Visual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative items-stretch font-num">
          {/* Step 1: Gross Sales */}
          <div className="bg-slate-50/90 border border-card rounded-2xl p-3.5 flex flex-col justify-between space-y-2 relative group hover:border-slate-300 transition shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-slate-600 uppercase tracking-wider font-sans">
                1. Tổng Tiền Món
              </span>
              <div className="p-1.5 rounded-xl bg-white text-slate-700 shadow-card border border-border-hairline">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-slate-900 font-num">
                {formatCurrency(grossSales, settings)}
              </div>
              <div className="text-caption text-slate-500 font-medium mt-0.5 font-sans">
                Doanh số niêm yết ({completedOrders} đơn)
              </div>
            </div>
            <div className="text-caption text-slate-400 bg-white/80 px-2 py-1 rounded-full border border-border-hairline font-sans">
              Tổng giá niêm yết tất cả ly & topping
            </div>
          </div>

          {/* Step 2: Total Discounts */}
          <div className="bg-rose-50/70 border border-rose-200/90 rounded-2xl p-3.5 flex flex-col justify-between space-y-2 relative group hover:border-rose-300 transition shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1 font-sans">
                <Minus className="w-3 h-3 text-rose-600 stroke-[3]" />
                2. Giảm Giá & KM
              </span>
              <div className="p-1.5 rounded-xl bg-white text-rose-600 shadow-card border border-rose-200">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-rose-600 font-num">
                -{formatCurrency(totalDiscounts, settings)}
              </div>
              <div className="text-caption text-rose-700 font-bold mt-0.5 flex items-center gap-1.5 font-sans">
                <span>{discountedOrders > 0 ? `${discountedOrders} đơn được giảm` : 'Ưu đãi & Tặng ly'}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-caption font-bold font-num">
                  {discountRate.toFixed(1)}%
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-caption text-rose-700 font-bold bg-white hover:bg-rose-100/80 px-2.5 py-1 rounded-full border border-rose-200 transition flex items-center justify-between cursor-pointer w-full text-left font-sans"
            >
              <span>🔍 Xem {discountedOrders > 0 ? `${discountedOrders} đơn giảm` : 'chi tiết đơn'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Step 3: Shipping & Surcharge */}
          <div className="bg-cyan-50/60 border border-cyan-200/80 rounded-2xl p-3.5 flex flex-col justify-between space-y-2 relative group hover:border-cyan-300 transition shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-1 font-sans">
                <Plus className="w-3 h-3 text-cyan-600 stroke-[3]" />
                3. Phí Ship / Phụ Thu
              </span>
              <div className="p-1.5 rounded-xl bg-white text-cyan-700 shadow-card border border-cyan-200">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-cyan-700 font-num">
                +{formatCurrency(totalExtra, settings)}
              </div>
              <div className="text-caption text-cyan-800 font-medium mt-0.5 font-sans">
                Ship: {formatCurrency(shippingFees, settings)} | Phụ thu: {formatCurrency(surcharges, settings)}
              </div>
            </div>
            <div className="text-caption text-cyan-700/80 bg-white/80 px-2 py-1 rounded-full border border-cyan-200 font-sans">
              Các khoản phí mở rộng thu thêm
            </div>
          </div>

          {/* Step 4: Net Revenue / Cash Flow Inflow */}
          <div className="bg-purple-50/90 border-2 border-purple-300 rounded-2xl p-3.5 flex flex-col justify-between space-y-2 relative group hover:border-purple-400 transition shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-caption font-bold text-brand-purple uppercase tracking-wider flex items-center gap-1 font-sans">
                <Equal className="w-3 h-3 text-brand-purple stroke-[3]" />
                4. Thực Thu Vào Quỹ
              </span>
              <div className="p-1.5 rounded-xl bg-brand-purple text-white shadow-card">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-brand-purple font-num">
                {formatCurrency(netRevenue, settings)}
              </div>
              <div className="text-caption text-brand-purple font-bold mt-0.5 flex items-center gap-1 font-sans">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-purple" />
                <span>Khớp 100% Sổ Thu Chi</span>
              </div>
            </div>
            <div className="text-caption text-brand-purple bg-white px-2 py-1 rounded-full border border-purple-200 font-semibold font-sans">
              Tiền thực nhận vào két & ngân hàng
            </div>
          </div>
        </div>

        {/* Insight Equation Footer */}
        <div className="p-3 bg-slate-50 border border-card rounded-2xl text-xs text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-brand-purple shrink-0" />
            <div className="text-caption leading-relaxed">
              <span className="font-bold text-slate-900">Quy tắc kế toán đối soát:</span> Tiền thực tế vào két/ngân hàng đã được giảm trừ{' '}
              <span className="font-bold text-rose-600 font-num">{formatCurrency(totalDiscounts, settings)}</span> chiết khấu ngay tại quầy POS, giúp số dư quỹ trên hệ thống luôn khớp tuyệt đối với thực tế kiểm két.
            </div>
          </div>
          {totalDiscounts > 0 && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-caption font-bold text-brand-purple hover:text-purple-800 underline whitespace-nowrap cursor-pointer shrink-0"
            >
              Xem danh sách {discountedOrders > 0 ? `${discountedOrders} đơn` : ''} &rarr;
            </button>
          )}
        </div>
      </div>

      {/* Discounted Orders Modal */}
      <DiscountedOrdersModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        from={from}
        to={to}
        periodName={periodName}
        settings={settings}
        totalGrossSales={grossSales}
        totalCompletedOrders={completedOrders}
      />
    </>
  );
}
