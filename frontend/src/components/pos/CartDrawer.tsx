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
  Gift,
  Banknote,
  QrCode,
  Calculator,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { CartItem, Product, ProductVariant } from './VariantSelectorModal';
import { Promotion } from '@/types/promotion';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import HorizontalScroller from '@/components/common/HorizontalScroller';
import GiftItemSelectorModal from './GiftItemSelectorModal';
import SalesChannelModal from '@/components/common/SalesChannelModal';
import {
  SalesChannel,
  DEFAULT_SALES_CHANNELS,
  parseSalesChannels,
  getChannelBadge,
} from '@/types/sales_channel';

export interface SalesChannelOption {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
  activeClass: string;
}

export const SALES_CHANNELS: SalesChannelOption[] = [
  { id: 'dine_in', label: 'Tại quán', icon: '🏠', colorClass: 'text-purple-700', activeClass: 'bg-purple-700 text-white shadow-xs' },
  { id: 'takeaway', label: 'Mang về', icon: '🛍️', colorClass: 'text-indigo-700', activeClass: 'bg-indigo-600 text-white shadow-xs' },
  { id: 'shopeefood', label: 'ShopeeFood', icon: '🧡', colorClass: 'text-orange-700', activeClass: 'bg-orange-600 text-white shadow-xs' },
  { id: 'grabfood', label: 'GrabFood', icon: '💚', colorClass: 'text-emerald-700', activeClass: 'bg-emerald-600 text-white shadow-xs' },
  { id: 'befood', label: 'BeFood', icon: '💛', colorClass: 'text-amber-700', activeClass: 'bg-amber-500 text-white shadow-xs' },
];

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
  salesChannel?: string;
  onSalesChannelChange?: (channel: string) => void;
  platformCommissionPercent?: number;
  onPlatformCommissionPercentChange?: (pct: number) => void;
  surcharge: number;
  onSurchargeChange: (amount: number) => void;
  orderNote: string;
  onOrderNoteChange: (note: string) => void;
  orderCreatedAt?: string | null;
  onOrderCreatedAtChange?: (dateStr: string | null) => void;
  onProceedCheckout?: () => void;
  onOneTapCash?: () => Promise<void> | void;
  onOneTapVietQR?: () => void;
  onOpenCheckoutModal?: () => void;
  isSubmitting?: boolean;
  settings?: SettingsMap | null;
  products?: Product[];
  categories?: { id: number; name: string }[];
  onApplyGiftItem?: (promo: Promotion, variant: ProductVariant, product: Product) => void;
}

const FAST_NOTE_PRESETS = [
  'Mang về',
  'Uống tại bàn',
  'Ít ngọt',
  'Không đá',
  'Đá riêng',
  'Nhiều sữa',
  'Ít sữa',
];

type AdjustmentTab = 'none' | 'note' | 'promo' | 'fees' | 'surcharge' | 'time';

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
  salesChannel = 'dine_in',
  onSalesChannelChange,
  platformCommissionPercent = 0,
  onPlatformCommissionPercentChange,
  surcharge,
  onSurchargeChange,
  orderNote,
  onOrderNoteChange,
  orderCreatedAt,
  onOrderCreatedAtChange,
  onProceedCheckout,
  onOneTapCash,
  onOneTapVietQR,
  onOpenCheckoutModal,
  isSubmitting = false,
  settings,
  products = [],
  categories = [],
  onApplyGiftItem,
}: Props) {
  const { t } = useTranslation();

  // Active Collapsible Adjustment Tab ('none' by default to maximize item space)
  const [activeTab, setActiveTab] = useState<AdjustmentTab>('none');

  // Sales Channels State
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [localChannelsList, setLocalChannelsList] = useState<SalesChannel[]>(() => {
    return parseSalesChannels(settings?.sales_channels_config);
  });

  useEffect(() => {
    if (settings?.sales_channels_config) {
      setLocalChannelsList(parseSalesChannels(settings.sales_channels_config));
    }
  }, [settings?.sales_channels_config]);

  const activeChannels = localChannelsList.filter((c) => c.is_active !== false);

  // Custom commission override state (allow inline typing of custom % or custom VND)
  const [isEditingCommission, setIsEditingCommission] = useState<boolean>(false);
  const [customCommissionInput, setCustomCommissionInput] = useState<string>('');

  // Active Promotions for Cart
  const [activePromotions, setActivePromotions] = useState<Promotion[]>([]);
  const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
  const [tempUnitPrice, setTempUnitPrice] = useState<number>(0);
  const [showAllEligiblePromos, setShowAllEligiblePromos] = useState<boolean>(false);

  // Gift selector modal state
  const [isGiftSelectorOpen, setIsGiftSelectorOpen] = useState<boolean>(false);
  const [giftPromoForModal, setGiftPromoForModal] = useState<Promotion | null>(null);

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

  // Non-gift items used to check promo requirements
  const eligibleSubtotal = React.useMemo(
    () => safeCartItems.filter((i) => !i.isGift).reduce((acc, item) => acc + (item?.lineTotal || 0), 0),
    [safeCartItems]
  );
  const eligibleItemCount = React.useMemo(
    () => safeCartItems.filter((i) => !i.isGift).reduce((acc, i) => acc + (i?.quantity || 0), 0),
    [safeCartItems]
  );

  // Identify if any gift item is currently in cart
  const currentGiftCartItem = React.useMemo(() => {
    return safeCartItems.find((i) => i.isGift);
  }, [safeCartItems]);

  // Check if a promotion is currently eligible
  const checkEligibility = React.useCallback(
    (promo: Promotion): boolean => {
      if (!promo || !promo.is_active) return false;
      const minAmount = promo.min_order_amount ?? 0;
      const minQty = promo.min_quantity ?? 0;
      if (minAmount > 0 && eligibleSubtotal < minAmount) return false;
      if (minQty > 0 && eligibleItemCount < minQty) return false;
      return true;
    },
    [eligibleSubtotal, eligibleItemCount]
  );

  // Eligible promotions sorted by display order
  const eligiblePromotions = React.useMemo(() => {
    return activePromotions
      .filter((p) => checkEligibility(p))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [activePromotions, checkEligibility]);

  // Top eligible promotion
  const topEligiblePromotion = React.useMemo(() => {
    return eligiblePromotions.length > 0 ? eligiblePromotions[0] : null;
  }, [eligiblePromotions]);

  // Auto-sync or auto-unselect if current selectedPromotion is no longer eligible
  useEffect(() => {
    if (selectedPromotion) {
      const isStillEligible = checkEligibility(selectedPromotion);
      if (!isStillEligible) {
        onSelectPromotion(null);
      }
    }
  }, [selectedPromotion, checkEligibility, onSelectPromotion]);

  // Helper to get configured preset commission % for a delivery channel
  const getChannelDefaultPct = (channelId?: string): number => {
    const ch = localChannelsList.find((c) => c.id === channelId);
    if (ch && ch.default_commission_pct !== undefined) return ch.default_commission_pct;
    if (channelId === 'shopeefood') return parseFloat(settings?.commission_shopeefood_pct || '0');
    if (channelId === 'grabfood') return parseFloat(settings?.commission_grabfood_pct || '0');
    if (channelId === 'befood') return parseFloat(settings?.commission_befood_pct || '0');
    return 0;
  };

  // Handle Sales Channel Change & Auto Commission
  const handleSelectChannel = (channelId: string) => {
    onSalesChannelChange?.(channelId);

    // If delivery app channel, auto-calculate commission based on configured settings
    const defaultPct = getChannelDefaultPct(channelId);

    if (defaultPct > 0) {
      onPlatformCommissionPercentChange?.(defaultPct);
      const feeDiscount = Math.round((subtotal * defaultPct) / 100);
      onPlatformFeeDiscountChange(feeDiscount);
    } else {
      // Dine-in, Takeaway, or unconfigured delivery: reset commission discount
      onPlatformCommissionPercentChange?.(0);
      onPlatformFeeDiscountChange(0);
    }
    setIsEditingCommission(false);
  };

  // Toggle or clear auto-calculated commission
  const handleToggleAutoCommission = () => {
    if (platformFeeDiscount > 0 || (platformCommissionPercent && platformCommissionPercent > 0)) {
      onPlatformFeeDiscountChange(0);
      onPlatformCommissionPercentChange?.(0);
      setIsEditingCommission(false);
    } else {
      // Re-apply configured pct
      let defaultPct = getChannelDefaultPct(salesChannel);
      if (defaultPct <= 0) defaultPct = 20; // fallback standard 20%
      onPlatformCommissionPercentChange?.(defaultPct);
      onPlatformFeeDiscountChange(Math.round((subtotal * defaultPct) / 100));
    }
  };

  const handleCustomCommissionApply = () => {
    const val = parseFloat(customCommissionInput);
    if (!isNaN(val) && val >= 0) {
      if (val <= 100) {
        // Interpreted as percentage
        onPlatformCommissionPercentChange?.(val);
        onPlatformFeeDiscountChange(Math.round((subtotal * val) / 100));
      } else {
        // Interpreted as direct VND amount
        onPlatformFeeDiscountChange(Math.round(val));
        const computedPct = subtotal > 0 ? Math.round((val / subtotal) * 1000) / 10 : 0;
        onPlatformCommissionPercentChange?.(computedPct);
      }
    }
    setIsEditingCommission(false);
  };

  const handleToggleFastNote = (preset: string) => {
    if (!orderNote) {
      onOrderNoteChange(preset);
      return;
    }
    const parts = orderNote.split(',').map((p) => p.trim()).filter(Boolean);
    const existingIndex = parts.findIndex((p) => p.toLowerCase() === preset.toLowerCase());
    if (existingIndex >= 0) {
      parts.splice(existingIndex, 1);
    } else {
      parts.push(preset);
    }
    onOrderNoteChange(parts.join(', '));
  };

  const handleApplyPromo = (promo: Promotion) => {
    if (selectedPromotion?.id === promo.id) {
      onSelectPromotion(null);
      return;
    }

    if (promo.promo_type === 'gift_item') {
      if (promo.allow_select_gift) {
        setGiftPromoForModal(promo);
        setIsGiftSelectorOpen(true);
        return;
      }

      if (promo.gift_product_variant_id && Array.isArray(products)) {
        let foundV: ProductVariant | null = null;
        let foundP: Product | null = null;
        for (const p of products) {
          if (Array.isArray(p.variants)) {
            const v = p.variants.find((item) => item.id === promo.gift_product_variant_id);
            if (v) {
              foundV = v;
              foundP = p;
              break;
            }
          }
        }
        if (foundV && foundP && onApplyGiftItem) {
          onApplyGiftItem(promo, foundV, foundP);
          return;
        }
      }

      setGiftPromoForModal(promo);
      setIsGiftSelectorOpen(true);
      return;
    }

    onSelectPromotion(promo);
  };

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

  const currentChannelObj = localChannelsList.find((c) => c.id === salesChannel);
  const isDeliveryAppChannel = currentChannelObj
    ? currentChannelObj.is_delivery_app
    : ['shopeefood', 'grabfood', 'befood'].includes(salesChannel);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end md:items-stretch md:justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full md:max-w-md h-[92dvh] md:h-full flex flex-col justify-between shadow-2xl rounded-t-3xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right duration-300 hardware-accelerated overflow-hidden">
        {/* Mobile Drag Indicator */}
        <div className="pt-2 pb-1 flex justify-center md:hidden bg-slate-50">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Top Header */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-purple-800" />
            <h2 className="font-extrabold text-slate-900 text-base">{t('pos.view_cart')}</h2>
            <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">
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

        {/* 1. SALES CHANNEL SEGMENTED BAR */}
        <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 touch-pan-x -mx-1 px-1">
            {activeChannels.map((ch) => {
              const isSelected = salesChannel === ch.id;
              const presetPct = getChannelDefaultPct(ch.id);
              const badgeInfo = getChannelBadge(ch.id, localChannelsList);
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChannel(ch.id)}
                  className={`shrink-0 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 select-none ${
                    isSelected
                      ? `${badgeInfo.activeClasses} ring-2 ring-offset-1`
                      : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs leading-none">{ch.icon}</span>
                  <span className="text-[11px] font-extrabold tracking-tight">{ch.name}</span>
                  {presetPct > 0 && (
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md leading-none ${
                        isSelected
                          ? 'bg-black/20 text-white'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                      title={`Cài sẵn chiết khấu ${presetPct}%`}
                    >
                      -{presetPct}%
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsChannelModalOpen(true)}
              title="Cài đặt kênh bán hàng"
              className="shrink-0 p-1.5 rounded-xl text-slate-400 hover:text-purple-700 hover:bg-white border border-transparent hover:border-slate-200 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto-Commission Badge & 1-Tap Toggle/Override (If delivery channel) */}
          {isDeliveryAppChannel && (
            <div className="mt-2 p-2 rounded-xl bg-white/95 border border-amber-200/80 shadow-2xs space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-amber-900 bg-amber-100/90 border border-amber-200 px-1.5 py-0.5 rounded-md shrink-0">
                    Chiết khấu sàn
                  </span>
                  {platformFeeDiscount > 0 ? (
                    <button
                      type="button"
                      onClick={handleToggleAutoCommission}
                      title="Bấm để bật/tắt chiết khấu sàn"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-extrabold text-[11px] transition active:scale-95 cursor-pointer min-w-0 max-w-[210px] sm:max-w-none"
                    >
                      <span className="truncate">
                        ✓ -{platformCommissionPercent}% (-{formatCurrency(platformFeeDiscount, settings)})
                      </span>
                      <span className="text-amber-700 hover:text-amber-950 font-bold ml-0.5 shrink-0">✕</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleAutoCommission}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-[11px] transition active:scale-95 cursor-pointer shrink-0"
                    >
                      <span>+ Áp dụng % sàn</span>
                    </button>
                  )}
                </div>

                <div className="shrink-0">
                  {!isEditingCommission ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCommissionInput(
                          platformCommissionPercent > 0 ? platformCommissionPercent.toString() : ''
                        );
                        setIsEditingCommission(true);
                      }}
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold cursor-pointer transition active:scale-95 whitespace-nowrap"
                    >
                      <span>Sửa %</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingCommission(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      title="Đóng sửa chiết khấu"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Custom Override Expandable Panel */}
              {isEditingCommission && (
                <div className="pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1 flex-1 min-w-[120px]">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      placeholder="% hoặc đ"
                      value={customCommissionInput}
                      onChange={(e) => setCustomCommissionInput(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-bold border border-indigo-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCustomCommissionApply}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold hover:bg-indigo-700 active:scale-95 shrink-0"
                    >
                      Lưu
                    </button>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {[15, 20, 25].map((quickPct) => (
                      <button
                        key={quickPct}
                        type="button"
                        onClick={() => {
                          setCustomCommissionInput(quickPct.toString());
                          onPlatformCommissionPercentChange?.(quickPct);
                          onPlatformFeeDiscountChange(Math.round((subtotal * quickPct) / 100));
                          setIsEditingCommission(false);
                        }}
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 text-[10px] font-bold text-slate-700 active:scale-95"
                      >
                        {quickPct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Cart Item List (Maximizing vertical height) */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 divide-y divide-slate-100 custom-scrollbar">
          {safeCartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
              <ShoppingBag className="w-14 h-14 stroke-[1.3] text-slate-300 mb-2.5" />
              <p className="text-sm font-semibold">{t('pos.empty_cart') || 'Giỏ hàng đang trống'}</p>
              <p className="text-xs text-slate-400 mt-1">Chọn đồ uống từ thực đơn bên trái để bắt đầu</p>
            </div>
          ) : (
            safeCartItems.map((item) => {
              if (item.isGift) {
                return (
                  <div key={item.id} className="pt-2.5 first:pt-0 flex flex-col space-y-2 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 p-3 rounded-2xl border border-amber-300 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-1 shadow-2xs">
                            <Gift className="w-3 h-3 text-amber-700" />
                            <span>Món quà tặng</span>
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 leading-tight">
                            {item.product.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 font-semibold mt-0.5">
                          {item.selectedVariant.variant_name !== 'Default' ? item.selectedVariant.variant_name : 'Mặc định'}
                        </p>
                        {item.giftPromotionName && (
                          <p className="text-[10px] text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded-md mt-1 inline-block border border-amber-200">
                            🎁 CTKM: {item.giftPromotionName}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-purple-600">
                          0đ (Miễn phí)
                        </div>
                        {item.originalUnitPrice && item.originalUnitPrice > 0 && (
                          <div className="text-[10px] text-slate-400 line-through">
                            {formatCurrency(item.originalUnitPrice, settings)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          const promo = activePromotions.find((p) => p.name === item.giftPromotionName);
                          if (promo) {
                            setGiftPromoForModal(promo);
                            setIsGiftSelectorOpen(true);
                          }
                        }}
                        className="text-[11px] font-bold text-amber-900 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
                      >
                        <Gift className="w-3 h-3" />
                        <span>Đổi món quà</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                        title="Xóa món quà"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              }

              // Normal Item Row
              return (
                <div key={item.id} className="pt-2.5 first:pt-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-1">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {item.product.name}
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <span>{item.selectedVariant.variant_name !== 'Default' ? item.selectedVariant.variant_name : 'Mặc định'}</span>
                        {item.notes && <span className="text-purple-600 font-bold truncate">· {item.notes}</span>}
                      </div>

                      {/* Toppings if present */}
                      {Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.selectedToppings.map((top) => (
                            <span
                              key={top.id}
                              className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium"
                            >
                              +{top.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unit Price & Line Total */}
                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        {formatCurrency(item.lineTotal, settings)}
                      </div>
                      {editingPriceItemId === item.id ? (
                        <div className="flex items-center gap-1 mt-1 justify-end">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={tempUnitPrice}
                            onChange={(e) => setTempUnitPrice(Number(e.target.value) || 0)}
                            className="w-20 p-1 text-right text-xs font-bold border border-purple-400 rounded-md focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveUnitPrice(item.id)}
                            className="p-1 bg-purple-700 text-white rounded-md text-[10px]"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEditPrice(item)}
                          className="text-[10px] text-slate-400 hover:text-purple-700 inline-flex items-center gap-0.5 transition cursor-pointer"
                        >
                          <span>{formatCurrency(item.unitPrice, settings)}</span>
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quantity & Delete Controls */}
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50/70 p-0.5">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white shadow-2xs hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white shadow-2xs hover:bg-slate-100 flex items-center justify-center text-slate-600 font-bold active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Xóa món"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. COLLAPSIBLE ADJUSTMENTS & STICKY FOOTER (Requirements 3 & 4) */}
        {safeCartItems.length > 0 && (
          <div className="border-t border-slate-200/90 bg-white p-3.5 space-y-2.5 pb-safe shrink-0 shadow-lg">
            {/* ROW OF COMPACT ADJUSTMENT TOGGLE CHIPS */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* Note Chip */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'note' ? 'none' : 'note')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${orderNote
                  ? 'bg-purple-50 text-purple-800 border border-purple-300 ring-1 ring-purple-200'
                  : activeTab === 'note'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
              >
                <FileText className="w-3.5 h-3.5 text-purple-600" />
                <span>{orderNote ? `Ghi chú: ${orderNote.slice(0, 10)}...` : 'Ghi Chú'}</span>
                {orderNote && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOrderNoteChange('');
                    }}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                  >
                    ✕
                  </span>
                )}
              </button>

              {/* Promo Chip */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'promo' ? 'none' : 'promo')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${selectedPromotion
                  ? 'bg-purple-100 text-purple-900 border border-purple-300 ring-1 ring-purple-200'
                  : activeTab === 'promo'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
              >
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                <span>
                  {selectedPromotion
                    ? `🎟️ -${formatCurrency(promotionDiscount, settings)}`
                    : eligiblePromotions.length > 0
                      ? `🎟️ Khuyến mãi (${eligiblePromotions.length})`
                      : 'Khuyến mãi'}
                </span>
                {selectedPromotion && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPromotion(null);
                    }}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                  >
                    ✕
                  </span>
                )}
              </button>

              {/* Fees & Platform Chip */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'fees' ? 'none' : 'fees')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${platformFeeDiscount > 0 || shippingFee > 0 || discountAmount > 0
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 ring-1 ring-amber-200'
                  : activeTab === 'fees'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
              >
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {platformFeeDiscount > 0
                    ? `Sàn: -${formatCurrency(platformFeeDiscount, settings)}`
                    : shippingFee > 0
                      ? `Ship: +${formatCurrency(shippingFee, settings)}`
                      : discountAmount > 0
                        ? `Giảm: -${formatCurrency(discountAmount, settings)}`
                        : 'Phí sàn / Ship'}
                </span>
                {(platformFeeDiscount > 0 || shippingFee > 0 || discountAmount > 0) && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlatformFeeDiscountChange(0);
                      onShippingFeeChange(0);
                      onDiscountChange(0);
                    }}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                  >
                    ✕
                  </span>
                )}
              </button>

              {/* Surcharge Chip */}
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'surcharge' ? 'none' : 'surcharge')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${surcharge > 0
                  ? 'bg-violet-50 text-violet-900 border border-violet-300 ring-1 ring-violet-200'
                  : activeTab === 'surcharge'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                  }`}
              >
                <Plus className="w-3.5 h-3.5 text-violet-600" />
                <span>{surcharge > 0 ? `Phụ thu: +${formatCurrency(surcharge, settings)}` : 'Phụ thu'}</span>
                {surcharge > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onSurchargeChange(0);
                    }}
                    className="p-0.5 hover:text-rose-600 cursor-pointer"
                  >
                    ✕
                  </span>
                )}
              </button>

              {/* Time Backdate Chip (Optional) */}
              {onOrderCreatedAtChange && (
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'time' ? 'none' : 'time')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${orderCreatedAt
                    ? 'bg-indigo-50 text-indigo-900 border border-indigo-300 ring-1 ring-indigo-200'
                    : activeTab === 'time'
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
                    }`}
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{orderCreatedAt ? '🕒 Quá khứ' : 'Giờ tạo'}</span>
                  {orderCreatedAt && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderCreatedAtChange(null);
                      }}
                      className="p-0.5 hover:text-rose-600 cursor-pointer"
                    >
                      ✕
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* EXPANDED ADJUSTMENT PANELS (Only open when activeTab !== 'none') */}
            {activeTab === 'note' && (
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Ghi chú đơn hàng</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('none')}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Đóng [✕]
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Ghi chú chung cho đơn (mang về, ít ngọt...)"
                  value={orderNote}
                  onChange={(e) => onOrderNoteChange(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1">
                  {FAST_NOTE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleToggleFastNote(preset)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 active:scale-95 cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'promo' && (
              <div className="p-2.5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs max-h-48 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900">Khuyến mãi đủ điều kiện</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('none')}
                    className="text-[10px] text-purple-600 hover:text-purple-900"
                  >
                    Đóng [✕]
                  </button>
                </div>
                {eligiblePromotions.length > 0 ? (
                  eligiblePromotions.map((promo) => {
                    const isSelected = selectedPromotion?.id === promo.id;
                    return (
                      <div
                        key={promo.id}
                        className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${isSelected ? 'bg-purple-100 border-purple-300' : 'bg-white border-slate-200'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs truncate">{promo.name}</p>
                          <p className="text-[10px] text-purple-700 font-semibold">
                            {promo.promo_type === 'discount_percent'
                              ? `Giảm -${promo.discount_value}%`
                              : promo.promo_type === 'discount_amount'
                                ? `Giảm -${formatCurrency(promo.discount_value, settings)}`
                                : '🎁 Tặng món'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyPromo(promo)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition active:scale-95 ${isSelected ? 'bg-purple-700 text-white' : 'bg-slate-900 text-white'
                            }`}
                        >
                          {isSelected ? 'Đã chọn' : 'Áp dụng'}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-slate-400 py-2 text-center">Không có khuyến mãi nào đủ điều kiện</p>
                )}
              </div>
            )}

            {activeTab === 'fees' && (
              <div className="p-2.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950">Chiết khấu sàn, Phí ship & Giảm thủ công</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('none')}
                    className="text-[10px] text-amber-700 hover:text-amber-900"
                  >
                    Đóng [✕]
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Giảm giá thủ công (đ)</label>
                    <input
                      type="number"
                      step="1000"
                      value={discountAmount || ''}
                      onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Chiết khấu sàn (đ)</label>
                    <input
                      type="number"
                      step="1000"
                      value={platformFeeDiscount || ''}
                      onChange={(e) => onPlatformFeeDiscountChange(Number(e.target.value) || 0)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phí giao hàng / Ship (đ)</label>
                    <input
                      type="number"
                      step="1000"
                      value={shippingFee || ''}
                      onChange={(e) => onShippingFeeChange(Number(e.target.value) || 0)}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'surcharge' && (
              <div className="p-2.5 rounded-2xl bg-violet-50/60 border border-violet-200 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-violet-950">Phụ thu (Lễ tết, Đêm muộn)</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('none')}
                    className="text-[10px] text-violet-700 hover:text-violet-900"
                  >
                    Đóng [✕]
                  </button>
                </div>
                <input
                  type="number"
                  step="1000"
                  value={surcharge || ''}
                  onChange={(e) => onSurchargeChange(Number(e.target.value) || 0)}
                  className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                  placeholder="Nhập số tiền phụ thu (VD: 10000)"
                />
              </div>
            )}

            {activeTab === 'time' && onOrderCreatedAtChange && (
              <div className="p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 animate-in fade-in slide-in-from-top-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950">Chọn thời gian tạo đơn quá khứ</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('none')}
                    className="text-[10px] text-indigo-700 hover:text-indigo-900"
                  >
                    Đóng [✕]
                  </button>
                </div>
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
                    if (!e.target.value) onOrderCreatedAtChange(null);
                    else onOrderCreatedAtChange(new Date(e.target.value).toISOString());
                  }}
                  className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                />
              </div>
            )}

            {/* TOTALS SUMMARY DISPLAY */}
            <div className="space-y-1 pt-1.5 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>{t('common.subtotal') || 'Tạm tính'}:</span>
                <span>{formatCurrency(subtotal, settings)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>{t('common.discount') || 'Giảm giá'}:</span>
                  <span>-{formatCurrency(discountAmount, settings)}</span>
                </div>
              )}

              {promotionDiscount > 0 && (
                <div className="flex justify-between text-purple-600 font-medium">
                  <span className="truncate max-w-[200px]">
                    {selectedPromotion?.name || t('pos.promotion_discount') || 'Khuyến mãi'}:
                  </span>
                  <span>-{formatCurrency(promotionDiscount, settings)}</span>
                </div>
              )}

              {platformFeeDiscount > 0 && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>{t('pos.platform_discount') || 'Chiết khấu sàn'}:</span>
                  <span>-{formatCurrency(platformFeeDiscount, settings)}</span>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex justify-between text-cyan-600 font-medium">
                  <span>{t('pos.shipping_fee') || 'Phí vận chuyển'}:</span>
                  <span>+{formatCurrency(shippingFee, settings)}</span>
                </div>
              )}

              {surcharge > 0 && (
                <div className="flex justify-between text-purple-700 font-medium">
                  <span>{t('pos.surcharge') || 'Phụ thu'}:</span>
                  <span>+{formatCurrency(surcharge, settings)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-900 font-extrabold text-base pt-1.5 border-t border-slate-200">
                <span>{t('common.total_amount') || 'Tổng thanh toán'}:</span>
                <span className="text-purple-900 text-lg sm:text-xl font-black">
                  {formatCurrency(finalTotal, settings)}
                </span>
              </div>
            </div>

            {/* 4. SIDE-BY-SIDE 1-TAP CHECKOUT ACTION BUTTONS (Requirement 4) */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* 1-Tap Cash Button (Emerald Green) */}
              <button
                type="button"
                onClick={onOneTapCash || onProceedCheckout}
                disabled={isSubmitting || safeCartItems.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold py-3 px-2 rounded-2xl shadow-md hover:shadow-lg transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Banknote className="w-4 h-4 shrink-0 text-emerald-100" />
                )}
                <span className="truncate">{t('pos.fast_cash_1tap') || '💵 Tiền Mặt (1-Chạm)'}</span>
              </button>

              {/* 1-Tap VietQR Button (Blue/Indigo) */}
              <button
                type="button"
                onClick={onOneTapVietQR || onProceedCheckout}
                disabled={isSubmitting || safeCartItems.length === 0}
                className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold py-3 px-2 rounded-2xl shadow-md hover:shadow-lg transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                <QrCode className="w-4 h-4 shrink-0 text-blue-100" />
                <span className="truncate">{t('pos.fast_vietqr_1tap') || '📲 QR Nhanh'}</span>
              </button>
            </div>

            {/* Secondary Button: Calculate Change / Other Fund */}
            {onOpenCheckoutModal && (
              <button
                type="button"
                onClick={onOpenCheckoutModal}
                disabled={isSubmitting || safeCartItems.length === 0}
                className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <Calculator className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('pos.calc_change_other_fund') || '🧮 Tính tiền thừa / Quỹ khác'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Gift Item Selector Modal */}
      {isGiftSelectorOpen && giftPromoForModal && (
        <GiftItemSelectorModal
          isOpen={isGiftSelectorOpen}
          onClose={() => {
            setIsGiftSelectorOpen(false);
            setGiftPromoForModal(null);
          }}
          promotion={giftPromoForModal}
          products={products || []}
          categories={categories || []}
          selectedVariantId={currentGiftCartItem?.selectedVariant.id}
          onSelectGift={(variant, product) => {
            if (onApplyGiftItem) {
              onApplyGiftItem(giftPromoForModal, variant, product);
            }
            setIsGiftSelectorOpen(false);
            setGiftPromoForModal(null);
          }}
          settings={settings}
        />
      )}

      {/* Sales Channel Management Modal */}
      <SalesChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channels={localChannelsList}
        onChannelsUpdated={(updated) => {
          setLocalChannelsList(updated);
        }}
      />
    </div>
  );
}
