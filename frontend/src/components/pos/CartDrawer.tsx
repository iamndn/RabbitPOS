'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  ArrowRight,
  Tag,
  Edit2,
  ChevronDown,
  ChevronUp,
  Percent,
  Truck,
  Building,
  Sparkles,
  AlertCircle,
  Check,
  FileText,
  Clock,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { CartItem } from './VariantSelectorModal';
import { Promotion } from '@/types/promotion';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onUpdateUnitPrice: (id: string, newUnitPrice: number) => void;
  onRemoveItem: (id: string) => void;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  selectedPromotion: Promotion | null;
  onSelectPromotion: (promo: Promotion | null) => void;
  promotionDiscount: number;
  shippingFee: number;
  onShippingFeeChange: (amount: number) => void;
  platformFeeDiscount: number;
  onPlatformFeeDiscountChange: (amount: number) => void;
  surcharge: number;
  onSurchargeChange: (amount: number) => void;
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  orderCreatedAt?: string | null;
  onOrderCreatedAtChange?: (dateStr: string | null) => void;
  onProceedCheckout: () => void;
  settings?: SettingsMap | null;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onUpdateUnitPrice,
  onRemoveItem,
  discountAmount,
  onDiscountChange,
  selectedPromotion,
  onSelectPromotion,
  promotionDiscount,
  shippingFee,
  onShippingFeeChange,
  platformFeeDiscount,
  onPlatformFeeDiscountChange,
  surcharge,
  onSurchargeChange,
  orderNote,
  onOrderNoteChange,
  orderCreatedAt,
  onOrderCreatedAtChange,
  onProceedCheckout,
  settings,
}: Props) {
  const { t } = useTranslation();

  // Active Promotions for Cart
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [tempUnitPrice, setTempUnitPrice] = useState<number>(0);
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const fetchActivePromos = async () => {
        const res = await fetchApi<Promotion[]>('/promotions/active');
        if (res.status === 'success' && Array.isArray(res.data)) {
          setActivePromotions(res.data);
        }
      };
      fetchActivePromos();
    }
  }, [isOpen]);

  const safeCartItems = React.useMemo(() => (Array.isArray(cartItems) ? cartItems : []), [cartItems]);
  const subtotal = React.useMemo(() => safeCartItems.reduce((acc, item) => acc + (item?.lineTotal || 0), 0), [safeCartItems]);
  const totalItemCount = React.useMemo(() => safeCartItems.reduce((acc, i) => acc + (i?.quantity || 0), 0), [safeCartItems]);

  // Check promotion eligibility based on min_order_amount, min_quantity, date, usage, and scope
  const checkEligibility = React.useCallback((promo: Promotion): boolean => {
    if (promo.is_active === false) return false;

    const now = new Date();
    if (promo.start_date && new Date(promo.start_date) > now) return false;
    if (promo.end_date && new Date(promo.end_date) < now) return false;
    if (promo.usage_limit > 0 && promo.usage_count >= promo.usage_limit) return false;

    if (promo.min_order_amount > 0 && subtotal < promo.min_order_amount) return false;
    if (promo.min_quantity > 0 && totalItemCount < promo.min_quantity) return false;

    if (promo.scope === 'category' || promo.scope === 'product') {
      let targetIds: number[] = [];
      try {
        if (promo.target_ids) {
          targetIds = JSON.parse(promo.target_ids);
        }
      } catch {
        targetIds = [];
      }

      if (Array.isArray(targetIds) && targetIds.length > 0) {
        if (promo.scope === 'category') {
          const hasMatchingCat = safeCartItems.some((it) => it.product && targetIds.includes(it.product.category_id));
          if (!hasMatchingCat) return false;
        } else if (promo.scope === 'product') {
          const hasMatchingProd = safeCartItems.some((it) => it.product && targetIds.includes(it.product.id));
          if (!hasMatchingProd) return false;
        }
      }
    }

    return true;
  }, [subtotal, totalItemCount, safeCartItems]);

  // Find the single highest priority eligible promotion (sorted by display_order asc)
  const topEligiblePromotion = React.useMemo(() => {
    const eligible = activePromotions
      .filter((p) => checkEligibility(p))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    return eligible.length > 0 ? eligible[0] : null;
  }, [activePromotions, checkEligibility]);

  // Auto-sync or auto-unselect if current selectedPromotion is no longer eligible
  useEffect(() => {
    if (selectedPromotion) {
      const isStillEligible = checkEligibility(selectedPromotion);
      if (!isStillEligible) {
        onSelectPromotion(null);
      }
    }
  }, [selectedPromotion, checkEligibility, onSelectPromotion]);

  const finalTotal = Math.max(
    0,
    subtotal - discountAmount - promotionDiscount - platformFeeDiscount + shippingFee + surcharge
  );

  const handleStartEditPrice = (item: CartItem) => {
    setEditingPriceItemId(item.id);
    setTempUnitPrice(item.unitPrice);
  };

  const handleSaveUnitPrice = (itemId: string) => {
    onUpdateUnitPrice(itemId, tempUnitPrice);
    setEditingPriceItemId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-stretch md:justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full md:max-w-md h-[92dvh] md:h-full flex flex-col justify-between shadow-2xl rounded-t-3xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right duration-300 hardware-accelerated overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="pt-2 pb-1 flex justify-center md:hidden bg-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-emerald-800" />
            <h2 className="font-bold text-slate-900 text-base">{t('pos.view_cart')}</h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {t('pos.items_count', { count: totalItemCount })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {safeCartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
              <ShoppingBag className="w-12 h-12 stroke-[1.5] mb-2" />
              <p className="text-sm font-medium">{t('pos.empty_cart')}</p>
            </div>
          ) : (
            safeCartItems.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex flex-col space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">
                      {item.product.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.selectedVariant.variant_name}
                      {item.selectedToppings && item.selectedToppings.length > 0 && (
                        <span className="text-emerald-700 font-semibold block sm:inline sm:ml-1">
                          + {item.selectedToppings.map((t) => t.name).join(', ')}
                        </span>
                      )}
                    </p>
                    {item.notes && (
                      <p className="text-[11px] text-amber-700 italic font-medium bg-amber-50 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                        Ghi chú: {item.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-slate-900">
                      {formatCurrency(item.lineTotal, settings)}
                    </div>
                    {item.quantity > 1 && (
                      <div className="text-[10px] text-slate-400">
                        {formatCurrency(item.unitPrice, settings)} / ly
                      </div>
                    )}
                  </div>
                </div>

                {/* Price Modifier & Quantity Adjuster */}
                <div className="flex items-center justify-between text-xs pt-1">
                  {editingPriceItemId === item.id ? (
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={tempUnitPrice || ''}
                        onChange={(e) => setTempUnitPrice(Number(e.target.value))}
                        className="w-20 p-1 text-xs border border-emerald-600 rounded bg-emerald-50 focus:outline-none font-bold"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveUnitPrice(item.id)}
                        className="px-2 py-1 bg-emerald-700 text-white rounded text-[11px] font-bold"
                      >
                        Lưu
                      </button>
                      <button
                        onClick={() => setEditingPriceItemId(null)}
                        className="px-1.5 py-1 bg-slate-200 text-slate-600 rounded text-[11px]"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEditPrice(item)}
                      className="text-[11px] text-slate-400 hover:text-emerald-700 flex items-center gap-1 font-medium transition cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Sửa giá ({formatCurrency(item.unitPrice, settings)})</span>
                    </button>
                  )}

                  {/* Quantity Stepper */}
                  <div className="flex items-center space-x-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      onClick={() => onUpdateQty(item.id, -1)}
                      className="p-1 hover:bg-white rounded text-slate-600 transition active:scale-95 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold text-slate-800 text-xs">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => onUpdateQty(item.id, 1)}
                      className="p-1 hover:bg-white rounded text-slate-600 transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition active:scale-95 cursor-pointer ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary, Promotions, Adjustments & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3 pb-safe">
            {/* 1. Only Show 1 Eligible Promotion */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-emerald-700" />
                  {t('pos.apply_promotion')}
                </span>
                {topEligiblePromotion && (
                  <span className="text-[10px] text-emerald-700 font-semibold">
                    1 khuyến mãi phù hợp
                  </span>
                )}
              </label>

              {topEligiblePromotion ? (
                <div
                  className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    selectedPromotion?.id === topEligiblePromotion.id
                      ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        selectedPromotion?.id === topEligiblePromotion.id
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                        <span className="truncate">{topEligiblePromotion.name}</span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                          Đủ điều kiện
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-emerald-700 truncate">
                        {topEligiblePromotion.promo_type === 'discount_percent'
                          ? `Giảm -${topEligiblePromotion.discount_value}% (-${formatCurrency(
                              (subtotal * topEligiblePromotion.discount_value) / 100,
                              settings
                            )})`
                          : topEligiblePromotion.promo_type === 'discount_amount'
                          ? `Giảm -${formatCurrency(topEligiblePromotion.discount_value, settings)}`
                          : `Tặng: ${topEligiblePromotion.gift_variant?.variant_name || 'Quà tặng kèm'}`}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPromotion?.id === topEligiblePromotion.id) {
                        onSelectPromotion(null);
                      } else {
                        onSelectPromotion(topEligiblePromotion);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 active:scale-95 flex items-center gap-1 shadow-2xs ${
                      selectedPromotion?.id === topEligiblePromotion.id
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    {selectedPromotion?.id === topEligiblePromotion.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã áp dụng</span>
                      </>
                    ) : (
                      <span>Áp dụng</span>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/60 text-slate-400 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    <span>Không có khuyến mãi đủ điều kiện</span>
                  </div>
                  {activePromotions.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({activePromotions.length} CTKM)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. Order Notes (Text area) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                {t('pos.order_note')}
              </label>
              <input
                type="text"
                placeholder={t('pos.order_note_placeholder')}
                value={orderNote}
                onChange={(e) => onOrderNoteChange(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            {/* 3. Order Creation Time (Customizable) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  {t('pos.order_time')}
                </label>
                {orderCreatedAt ? (
                  <button
                    type="button"
                    onClick={() => onOrderCreatedAtChange?.(null)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition active:scale-95 border border-emerald-200"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{t('pos.order_time_reset')}</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {t('pos.order_time_auto')}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <input
                  type="datetime-local"
                  value={
                    orderCreatedAt
                      ? (() => {
                          try {
                            const d = new Date(orderCreatedAt);
                            if (isNaN(d.getTime())) return '';
                            const pad = (n: number) => n.toString().padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                          } catch {
                            return '';
                          }
                        })()
                      : ''
                  }
                  onChange={(e) => {
                    if (!e.target.value) {
                      onOrderCreatedAtChange?.(null);
                    } else {
                      onOrderCreatedAtChange?.(new Date(e.target.value).toISOString());
                    }
                  }}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                />

                {/* Quick Presets */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => onOrderCreatedAtChange?.(null)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition active:scale-95 whitespace-nowrap ${
                      !orderCreatedAt
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {t('pos.order_time_now')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() - 15 * 60 * 1000);
                      onOrderCreatedAtChange?.(d.toISOString());
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-200/70 text-slate-700 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                  >
                    {t('pos.order_time_minus_15m')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() - 60 * 60 * 1000);
                      onOrderCreatedAtChange?.(d.toISOString());
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-200/70 text-slate-700 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                  >
                    {t('pos.order_time_minus_1h')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
                      onOrderCreatedAtChange?.(d.toISOString());
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-200/70 text-slate-700 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                  >
                    {t('pos.order_time_yesterday')}
                  </button>
                </div>
              </div>
            </div>

            {/* Adjustments Collapsible Accordion (Discount, Fees, Surcharges) */}
            <div className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setIsAdjustmentsOpen(!isAdjustmentsOpen)}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-98"
              >
                <div className="flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{t('pos.order_adjustments')}</span>
                  {(discountAmount > 0 || shippingFee > 0 || surcharge > 0 || platformFeeDiscount > 0) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                  )}
                </div>
                {isAdjustmentsOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {isAdjustmentsOpen && (
                <div className="p-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50 text-xs">
                  {/* Manual Discount Amount */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-rose-500" /> {t('pos.manual_discount')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={discountAmount === 0 ? '' : discountAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        onDiscountChange(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="w-28 p-1.5 text-right font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  {/* Platform Fee Discount (Grab/Shopee/Be discount) */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-amber-500" /> {t('pos.platform_discount')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={platformFeeDiscount === 0 ? '' : platformFeeDiscount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        onPlatformFeeDiscountChange(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="w-28 p-1.5 text-right font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  {/* Shipping Fee */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-cyan-500" /> {t('pos.shipping_fee')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={shippingFee === 0 ? '' : shippingFee}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        onShippingFeeChange(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="w-28 p-1.5 text-right font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  {/* Surcharge (Holiday/Late Night) */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5 text-emerald-700" /> {t('pos.surcharge')}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={surcharge === 0 ? '' : surcharge}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        onSurchargeChange(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="w-28 p-1.5 text-right font-bold text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Totals Summary Breakdown */}
            <div className="space-y-1 pt-1 border-t border-slate-200/60 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{t('common.subtotal')}</span>
                <span>{formatCurrency(subtotal, settings)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>{t('common.discount')}</span>
                  <span>-{formatCurrency(discountAmount, settings)}</span>
                </div>
              )}

              {promotionDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span className="truncate max-w-[200px]">
                    {selectedPromotion?.name || t('pos.promotion_discount')}
                  </span>
                  <span>-{formatCurrency(promotionDiscount, settings)}</span>
                </div>
              )}

              {platformFeeDiscount > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>{t('pos.platform_discount')}</span>
                  <span>-{formatCurrency(platformFeeDiscount, settings)}</span>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex justify-between text-cyan-600 font-medium">
                  <span>{t('pos.shipping_fee')}</span>
                  <span>+{formatCurrency(shippingFee, settings)}</span>
                </div>
              )}

              {surcharge > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>{t('pos.surcharge')}</span>
                  <span>+{formatCurrency(surcharge, settings)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-900 font-bold text-base pt-1 border-t border-slate-200">
                <span>{t('common.total_amount')}</span>
                <span className="text-emerald-800">{formatCurrency(finalTotal, settings)}</span>
              </div>
            </div>

            {/* 4. Checkout Button */}
            <button
              onClick={onProceedCheckout}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg transition flex items-center justify-center space-x-2 text-sm active:scale-95"
            >
              <span>{t('pos.checkout')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
