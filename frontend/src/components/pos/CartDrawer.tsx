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
} from 'lucide-react';
import { CartItem } from './VariantSelectorModal';
import { Promotion } from '@/app/promotions/page';
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

  if (!isOpen) return null;

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const subtotal = safeCartItems.reduce((acc, item) => acc + (item?.lineTotal || 0), 0);
  const totalItemCount = safeCartItems.reduce((acc, i) => acc + (i?.quantity || 0), 0);

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
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {safeCartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <ShoppingBag className="w-16 h-16 opacity-30 mb-2" />
              <p className="font-semibold text-sm text-slate-600">{t('pos.no_drinks')}</p>
            </div>
          ) : (
            safeCartItems.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between space-x-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.product.name}</h4>
                    <span className="font-bold text-slate-900 text-sm">{formatCurrency(item.lineTotal, settings)}</span>
                  </div>

                  {/* Unit Price with Inline Editing */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {editingPriceItemId === item.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={tempUnitPrice}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setTempUnitPrice(raw === '' ? 0 : parseInt(raw, 10));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveUnitPrice(item.id);
                          }}
                          autoFocus
                          className="w-24 p-1 text-xs font-bold border border-emerald-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveUnitPrice(item.id)}
                          className="p-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEditPrice(item)}
                        className="group cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition active:scale-95"
                        title="Bấm để sửa đơn giá thủ công"
                      >
                        <span>{item.selectedVariant.variant_name}</span>
                        <span>({formatCurrency(item.unitPrice, settings)})</span>
                        <Edit2 className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
                      </div>
                    )}
                  </div>

                  {/* Customizations / Sugar & Ice / Toppings */}
                  {item.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                      {item.notes}
                    </p>
                  )}

                  {/* Quantity Stepper & Remove */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2 border border-slate-200 rounded-xl p-1 bg-slate-50">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-90 transition-transform font-bold"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold text-xs text-slate-900 px-2 min-w-[20px] text-center">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-8 h-8 rounded-lg bg-white shadow-xs flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-90 transition-transform font-bold"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-2 transition active:scale-90"
                      title={t('pos.remove_item')}
                    >
                      <Trash2 className="w-4 h-4" />
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
            {/* 1. Active Promotions Selector Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-emerald-700" />
                {t('pos.apply_promotion')}
              </label>
              <ModernSelect
                value={selectedPromotion?.id ?? ''}
                placeholder={`-- ${t('pos.no_promotion')} --`}
                searchable={activePromotions.length > 5}
                searchPlaceholder="Tìm khuyến mãi..."
                clearable={true}
                onChange={(val) => {
                  if (!val) {
                    onSelectPromotion(null);
                    return;
                  }
                  const promo = activePromotions.find((p) => p.id === Number(val));
                  if (promo) onSelectPromotion(promo);
                }}
                options={[
                  { value: '', label: `-- ${t('pos.no_promotion')} --` },
                  ...activePromotions.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${
                      p.promo_type === 'discount_percent'
                        ? `-${p.discount_value}%`
                        : p.promo_type === 'discount_amount'
                        ? `-${formatCurrency(p.discount_value, settings)}`
                        : 'Quà tặng'
                    })`,
                  })),
                ]}
              />
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
