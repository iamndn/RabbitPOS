'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Edit2,
  Truck,
  Check,
  FileText,
  Clock,
  Gift,
  Banknote,
  QrCode,
  Calculator,
  Settings,
} from 'lucide-react';
import { CartItem, Product, ProductVariant } from './VariantSelectorModal';
import { Promotion } from '@/types/promotion';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import GiftItemSelectorModal from './GiftItemSelectorModal';
import SalesChannelModal from '@/components/common/SalesChannelModal';
import { Badge, Button, IconButton, useOverlayLayer } from '@/components/ui';
import {
  SalesChannel,
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
  { id: 'dine_in', label: 'Tại quán', icon: '🏠', colorClass: 'text-purple-700', activeClass: 'bg-purple-700 text-white shadow-card' },
  { id: 'takeaway', label: 'Mang về', icon: '🛍️', colorClass: 'text-purple-700', activeClass: 'bg-purple-600 text-white shadow-card' },
  { id: 'shopeefood', label: 'ShopeeFood', icon: '🧡', colorClass: 'text-orange-700', activeClass: 'bg-orange-600 text-white shadow-card' },
  { id: 'grabfood', label: 'GrabFood', icon: '💚', colorClass: 'text-emerald-700', activeClass: 'bg-emerald-600 text-white shadow-card' },
  { id: 'befood', label: 'BeFood', icon: '💛', colorClass: 'text-amber-700', activeClass: 'bg-amber-500 text-white shadow-card' },
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
  const [mounted, setMounted] = useState(false);

  // Active Collapsible Adjustment Tab ('none' by default to maximize item space)
  const [activeTab, setActiveTab] = useState<AdjustmentTab>('none');

  // Sales Channels State
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Register CartDrawer at z-modal (50); demotes z-30 shell bars and demotes itself under z-60+ nested modals
  const { underHigherOverlay, isTopmost } = useOverlayLayer(
    mounted && isOpen,
    50,
    true
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isOpen || !isTopmost || isChannelModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!isSubmitting) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, isOpen, isTopmost, isChannelModalOpen, isSubmitting, onClose]);
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

  if (!mounted || !isOpen) return null;

  const isUnderNested = underHigherOverlay || isChannelModalOpen;

  return createPortal(
    <>
      <div className="fixed inset-0 z-modal flex items-end md:items-stretch md:justify-end font-sans">
        {/* Unblurred Backdrop Scrim (0px blur — Amendment A1) */}
        <div
          className="fixed inset-0 glass-scrim animate-fadeIn"
          onClick={() => !isSubmitting && onClose()}
          aria-hidden="true"
        />

        {/* Active Drawer / Mobile Sheet Platter (1 glass-thick blur pass; demotes under nested modal) */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('pos.view_cart')}
          data-under-nested-overlay={isUnderNested ? 'true' : undefined}
          className="relative glass-thick border-t md:border-t-0 md:border-l border-glass w-full md:max-w-[430px] h-[90dvh] md:h-full flex flex-col justify-between rounded-t-sheet md:rounded-none md:rounded-l-panel overflow-hidden animate-slideUp md:animate-fadeIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Sheet Grabber Pill */}
          <div className="pt-2.5 pb-0.5 flex justify-center md:hidden select-none shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300/90" />
          </div>

          {/* Top Header */}
          <div className="px-4 py-2.5 border-b border-hairline flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-field bg-brand-50 border border-brand-200/80 text-brand-700 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h2 className="font-semibold text-slate-900 text-title-3 truncate">
                {t('pos.view_cart')}
              </h2>
              <Badge variant="brand" size="sm" className="font-num">
                {t('pos.items_count', { count: totalItemCount })}
              </Badge>
            </div>
            <IconButton
              variant="ghost"
              size="md"
              disabled={isSubmitting}
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-slate-500 hover:text-slate-800 -mr-1"
            >
              <X className="w-4 h-4" />
            </IconButton>
          </div>

          {/* 1. SALES CHANNEL CAPSULE BAR (Opaque controls, 0px blur) */}
          <div className="px-3.5 py-2 bg-surface-grouped/85 border-b border-hairline shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 touch-pan-x">
              {activeChannels.map((ch) => {
                const isSelected = salesChannel === ch.id;
                const presetPct = getChannelDefaultPct(ch.id);
                const badgeInfo = getChannelBadge(ch.id, localChannelsList);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch.id)}
                    className={`shrink-0 min-h-[36px] md:min-h-[32px] px-3 rounded-full text-caption font-semibold transition-all duration-press ease-press flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] select-none ${
                      isSelected
                        ? `${badgeInfo.activeClasses} ring-2 ring-brand-500/25 ring-offset-1`
                        : 'bg-surface-card hover:bg-slate-50 text-slate-700 border border-card shadow-card'
                    }`}
                  >
                    <span className="text-xs leading-none">{ch.icon}</span>
                    <span>{ch.name}</span>
                    {presetPct > 0 && (
                      <span
                        className={`text-caption font-bold font-num px-1.5 py-0.5 rounded-full leading-none ${
                          isSelected
                            ? 'bg-black/20 text-white'
                            : 'bg-amber-100 text-amber-900 border border-amber-200/80'
                        }`}
                        title={t('pos.preset_commission_title', { pct: presetPct })}
                      >
                        -{presetPct}%
                      </span>
                    )}
                  </button>
                );
              })}

              <IconButton
                variant="secondary"
                size="sm"
                onClick={() => setIsChannelModalOpen(true)}
                title={t('pos.channel_settings_title')}
                aria-label={t('pos.channel_settings_title')}
              >
                <Settings className="w-3.5 h-3.5" />
              </IconButton>
            </div>

            {/* Auto-Commission Badge & 1-Tap Toggle/Override (If delivery channel) */}
            {isDeliveryAppChannel && (
              <div className="mt-2 p-2.5 rounded-card bg-surface-card border border-amber-200/80 shadow-card space-y-2 animate-fadeIn">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Badge variant="warning" size="sm">
                      {t('pos.channel_commission')}
                    </Badge>
                    {platformFeeDiscount > 0 ? (
                      <button
                        type="button"
                        onClick={handleToggleAutoCommission}
                        title={t('pos.toggle_commission_title')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300/80 font-semibold text-caption font-num transition active:scale-[0.97] cursor-pointer min-w-0 max-w-[210px] sm:max-w-none"
                      >
                        <span className="truncate">
                          ✓ -{platformCommissionPercent}% (-{formatCurrency(platformFeeDiscount, settings)})
                        </span>
                        <X className="w-3 h-3 text-amber-700 shrink-0" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleToggleAutoCommission}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-grouped hover:bg-slate-200/70 text-slate-700 border border-hairline font-semibold text-caption transition active:scale-[0.97] cursor-pointer shrink-0"
                      >
                        <span>{t('pos.apply_platform_pct')}</span>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200/80 text-caption font-semibold cursor-pointer transition active:scale-[0.97] whitespace-nowrap"
                      >
                        <span>{t('pos.edit_pct')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingCommission(false)}
                        className="w-7 h-7 rounded-full inline-flex items-center justify-center hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        title={t('pos.close_edit_commission')}
                        aria-label={t('pos.close_edit_commission')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Custom Override Expandable Panel (16px mobile input to prevent iOS zoom) */}
                {isEditingCommission && (
                  <div className="pt-2 border-t border-hairline flex flex-wrap items-center gap-1.5 animate-fadeIn">
                    <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        placeholder={t('pos.pct_or_amount_placeholder')}
                        value={customCommissionInput}
                        onChange={(e) => setCustomCommissionInput(e.target.value)}
                        className="w-full h-10 md:h-8 px-3 text-base md:text-xs font-semibold font-num border border-brand-300 rounded-full bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                        autoFocus
                      />
                      <Button variant="primary" size="sm" onClick={handleCustomCommissionApply}>
                        {t('common.save')}
                      </Button>
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
                          className="px-2.5 py-1 rounded-full bg-surface-grouped hover:bg-brand-50 hover:text-brand-700 border border-hairline text-caption font-semibold font-num text-slate-700 active:scale-[0.96]"
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

          {/* 2. Cart Item List (Opaque surface-card rows, maximizing vertical height) */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
            {safeCartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-surface-card border border-card shadow-card flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7 stroke-[1.5] text-slate-400" />
                </div>
                <p className="text-headline font-semibold text-slate-800">{t('pos.empty_cart')}</p>
                <p className="text-footnote text-slate-500 mt-1 max-w-[240px]">
                  {t('pos.empty_cart_hint')}
                </p>
              </div>
            ) : (
              safeCartItems.map((item) => {
                if (item.isGift) {
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col space-y-2 bg-amber-50/90 p-3 rounded-card border border-amber-300/80 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="warning" size="sm" className="gap-1">
                              <Gift className="w-3 h-3 text-amber-700" />
                              <span>{t('pos.gift_item_badge')}</span>
                            </Badge>
                            <h3 className="text-subhead font-semibold text-slate-900 leading-tight">
                              {item.product.name}
                            </h3>
                          </div>
                          <p className="text-caption text-slate-600 font-medium mt-0.5">
                            {item.selectedVariant.variant_name !== 'Default'
                              ? item.selectedVariant.variant_name
                              : t('pos.default_variant')}
                          </p>
                          {item.giftPromotionName && (
                            <p className="text-caption text-amber-900 font-semibold bg-amber-100/90 px-2 py-0.5 rounded-full mt-1 inline-block border border-amber-200/80">
                              {t('pos.promo_label_prefix', { name: item.giftPromotionName })}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-footnote font-bold text-brand-700">
                            {t('pos.free_0d')}
                          </div>
                          {item.originalUnitPrice && item.originalUnitPrice > 0 && (
                            <div className="text-caption text-slate-400 line-through font-num">
                              {formatCurrency(item.originalUnitPrice, settings)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-caption pt-1.5 border-t border-amber-200/70">
                        <button
                          type="button"
                          onClick={() => {
                            const promo = activePromotions.find((p) => p.name === item.giftPromotionName);
                            if (promo) {
                              setGiftPromoForModal(promo);
                              setIsGiftSelectorOpen(true);
                            }
                          }}
                          className="text-caption font-semibold text-amber-900 hover:text-amber-950 underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Gift className="w-3 h-3" />
                          <span>{t('pos.change_gift_btn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="w-7 h-7 rounded-full inline-flex items-center justify-center text-rose-600 hover:bg-rose-100/70 transition cursor-pointer"
                          title={t('pos.remove_gift_title')}
                          aria-label={t('pos.remove_gift_title')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                // Normal Item Row (Opaque surface-card)
                return (
                  <div
                    key={item.id}
                    className="bg-surface-card p-3 rounded-card border border-card shadow-card space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 pr-1">
                        <h3 className="text-subhead font-semibold text-slate-900 leading-snug">
                          {item.product.name}
                        </h3>
                        <div className="flex items-center gap-1 text-caption text-slate-500 font-medium mt-0.5">
                          <span>
                            {item.selectedVariant.variant_name !== 'Default'
                              ? item.selectedVariant.variant_name
                              : t('pos.default_variant')}
                          </span>
                          {item.notes && (
                            <span className="text-brand-700 font-semibold truncate">
                              · {item.notes}
                            </span>
                          )}
                        </div>

                        {/* Toppings if present */}
                        {Array.isArray(item.selectedToppings) && item.selectedToppings.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.selectedToppings.map((top) => (
                              <span
                                key={top.id}
                                className="text-caption bg-surface-grouped text-slate-600 px-2 py-0.5 rounded-full border border-hairline font-medium"
                              >
                                +{top.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Unit Price & Line Total */}
                      <div className="text-right shrink-0">
                        <div className="text-subhead font-bold text-slate-900 font-num">
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
                              className="w-24 h-9 md:h-7 px-2.5 text-right text-base md:text-xs font-semibold font-num border border-brand-400 rounded-full bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveUnitPrice(item.id)}
                              className="w-8 h-8 md:w-7 md:h-7 bg-brand-600 text-white rounded-full inline-flex items-center justify-center shrink-0"
                              aria-label={t('common.save')}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEditPrice(item)}
                            className="text-caption text-slate-500 hover:text-brand-700 inline-flex items-center gap-1 transition cursor-pointer font-num mt-0.5"
                          >
                            <span>{formatCurrency(item.unitPrice, settings)}</span>
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quantity & Delete Controls */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="inline-flex items-center gap-0.5 border border-hairline rounded-full bg-surface-grouped p-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, -1)}
                          aria-label={t('pos.decrease_qty')}
                          className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-surface-card border border-card hover:bg-slate-50 flex items-center justify-center text-slate-700 active:scale-[0.95] transition"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-semibold text-footnote text-slate-900 font-num">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          aria-label={t('pos.increase_qty')}
                          className="w-8 h-8 md:w-7 md:h-7 rounded-full bg-surface-card border border-card hover:bg-slate-50 flex items-center justify-center text-slate-700 active:scale-[0.95] transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveItem(item.id)}
                        className="w-8 h-8 md:w-7 md:h-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition cursor-pointer"
                        title={t('pos.remove_item')}
                        aria-label={t('pos.remove_item')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 3. COLLAPSIBLE ADJUSTMENTS & OPAQUE STICKY FOOTER (0px extra blur — Amendment A1) */}
          {safeCartItems.length > 0 && (
            <div className="border-t border-hairline bg-surface-card/95 p-3.5 space-y-2.5 pb-safe shrink-0">
              {/* ROW OF CAPSULE ADJUSTMENT TOGGLE CHIPS */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {/* Note Chip */}
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'note' ? 'none' : 'note')}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                    orderNote
                      ? 'bg-brand-50 text-brand-800 border border-brand-300'
                      : activeTab === 'note'
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-surface-grouped text-slate-700 hover:bg-slate-200/70 border border-hairline'
                  }`}
                >
                  <FileText className={`w-3.5 h-3.5 ${activeTab === 'note' && !orderNote ? 'text-white' : 'text-brand-600'}`} />
                  <span>
                    {orderNote
                      ? t('pos.chip_note_active', { text: orderNote.slice(0, 10) })
                      : t('pos.chip_note')}
                  </span>
                  {orderNote && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderNoteChange('');
                      }}
                      className="p-0.5 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>

                {/* Promo Chip */}
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'promo' ? 'none' : 'promo')}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                    selectedPromotion
                      ? 'bg-brand-50 text-brand-900 border border-brand-300'
                      : activeTab === 'promo'
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-surface-grouped text-slate-700 hover:bg-slate-200/70 border border-hairline'
                  }`}
                >
                  <Tag className={`w-3.5 h-3.5 ${activeTab === 'promo' && !selectedPromotion ? 'text-white' : 'text-brand-600'}`} />
                  <span className="font-num">
                    {selectedPromotion
                      ? `-${formatCurrency(promotionDiscount, settings)}`
                      : eligiblePromotions.length > 0
                      ? t('pos.chip_promo_count', { count: eligiblePromotions.length })
                      : t('pos.chip_promotion')}
                  </span>
                  {selectedPromotion && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPromotion(null);
                      }}
                      className="p-0.5 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>

                {/* Fees & Platform Chip */}
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'fees' ? 'none' : 'fees')}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                    platformFeeDiscount > 0 || shippingFee > 0 || discountAmount > 0
                      ? 'bg-amber-50 text-amber-900 border border-amber-300'
                      : activeTab === 'fees'
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-surface-grouped text-slate-700 hover:bg-slate-200/70 border border-hairline'
                  }`}
                >
                  <Truck className={`w-3.5 h-3.5 ${activeTab === 'fees' && !(platformFeeDiscount > 0 || shippingFee > 0 || discountAmount > 0) ? 'text-white' : 'text-amber-600'}`} />
                  <span className="font-num">
                    {platformFeeDiscount > 0
                      ? t('pos.chip_fee_platform', { amount: formatCurrency(platformFeeDiscount, settings) })
                      : shippingFee > 0
                      ? t('pos.chip_fee_ship', { amount: formatCurrency(shippingFee, settings) })
                      : discountAmount > 0
                      ? t('pos.chip_fee_discount', { amount: formatCurrency(discountAmount, settings) })
                      : t('pos.chip_platform_fee')}
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
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>

                {/* Surcharge Chip */}
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'surcharge' ? 'none' : 'surcharge')}
                  className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                    surcharge > 0
                      ? 'bg-brand-50 text-brand-900 border border-brand-300'
                      : activeTab === 'surcharge'
                      ? 'bg-slate-900 text-white border border-slate-900'
                      : 'bg-surface-grouped text-slate-700 hover:bg-slate-200/70 border border-hairline'
                  }`}
                >
                  <Plus className={`w-3.5 h-3.5 ${activeTab === 'surcharge' && surcharge <= 0 ? 'text-white' : 'text-brand-600'}`} />
                  <span className="font-num">
                    {surcharge > 0
                      ? t('pos.chip_surcharge_active', { amount: formatCurrency(surcharge, settings) })
                      : t('pos.chip_surcharge')}
                  </span>
                  {surcharge > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onSurchargeChange(0);
                      }}
                      className="p-0.5 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  )}
                </button>

                {/* Time Backdate Chip (Optional) */}
                {onOrderCreatedAtChange && (
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab === 'time' ? 'none' : 'time')}
                    className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.97] ${
                      orderCreatedAt
                        ? 'bg-brand-50 text-brand-900 border border-brand-300'
                        : activeTab === 'time'
                        ? 'bg-slate-900 text-white border border-slate-900'
                        : 'bg-surface-grouped text-slate-700 hover:bg-slate-200/70 border border-hairline'
                    }`}
                  >
                    <Clock className={`w-3.5 h-3.5 ${activeTab === 'time' && !orderCreatedAt ? 'text-white' : 'text-brand-600'}`} />
                    <span>{orderCreatedAt ? t('pos.chip_time_past') : t('pos.chip_time_label')}</span>
                    {orderCreatedAt && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          onOrderCreatedAtChange(null);
                        }}
                        className="p-0.5 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                )}
              </div>

              {/* EXPANDED ADJUSTMENT PANELS (16px mobile inputs to prevent iOS Safari zoom) */}
              {activeTab === 'note' && (
                <div className="p-3 rounded-card bg-surface-grouped border border-hairline space-y-2 animate-fadeIn text-footnote">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{t('pos.order_note')}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('none')}
                      className="text-caption font-semibold text-slate-500 hover:text-slate-800"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={t('pos.order_note_placeholder')}
                    value={orderNote}
                    onChange={(e) => onOrderNoteChange(e.target.value)}
                    className="w-full h-11 md:h-9 px-3.5 border border-slate-900/12 rounded-field text-base md:text-xs bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {FAST_NOTE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleToggleFastNote(preset)}
                        className="px-2.5 py-1 rounded-full text-caption font-medium bg-surface-card hover:bg-slate-50 border border-card text-slate-700 active:scale-[0.96] cursor-pointer"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'promo' && (
                <div className="p-3 rounded-card bg-brand-50/50 border border-brand-200/80 space-y-2 animate-fadeIn text-footnote max-h-48 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-950">{t('pos.eligible_promos_title')}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('none')}
                      className="text-caption font-semibold text-brand-700 hover:text-brand-900"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                  {eligiblePromotions.length > 0 ? (
                    eligiblePromotions.map((promo) => {
                      const isSelected = selectedPromotion?.id === promo.id;
                      return (
                        <div
                          key={promo.id}
                          className={`p-2.5 rounded-field border flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-brand-100/80 border-brand-300'
                              : 'bg-surface-card border-card'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-footnote truncate">
                              {promo.name}
                            </p>
                            <p className="text-caption text-brand-700 font-semibold font-num">
                              {promo.promo_type === 'discount_percent'
                                ? t('pos.promo_off_pct', { pct: promo.discount_value })
                                : promo.promo_type === 'discount_amount'
                                ? t('pos.promo_off_amount', {
                                    amount: formatCurrency(promo.discount_value, settings),
                                  })
                                : t('pos.promo_gift_item')}
                            </p>
                          </div>
                          <Button
                            variant={isSelected ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => handleApplyPromo(promo)}
                          >
                            {isSelected ? t('pos.selected_label') : t('common.apply')}
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-caption text-slate-500 py-2 text-center">
                      {t('pos.no_eligible_promos')}
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'fees' && (
                <div className="p-3 rounded-card bg-amber-50/55 border border-amber-200/80 space-y-2 animate-fadeIn text-footnote">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-950">{t('pos.fees_panel_title')}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('none')}
                      className="text-caption font-semibold text-amber-800 hover:text-amber-950"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-caption font-semibold text-slate-600 block mb-1">
                        {t('pos.manual_discount')}
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={discountAmount || ''}
                        onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
                        className="w-full h-11 md:h-8 px-3 border border-slate-900/12 rounded-field text-base md:text-xs font-semibold font-num bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-caption font-semibold text-slate-600 block mb-1">
                        {t('pos.platform_discount')}
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={platformFeeDiscount || ''}
                        onChange={(e) => onPlatformFeeDiscountChange(Number(e.target.value) || 0)}
                        className="w-full h-11 md:h-8 px-3 border border-slate-900/12 rounded-field text-base md:text-xs font-semibold font-num bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-caption font-semibold text-slate-600 block mb-1">
                        {t('pos.shipping_fee')}
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={shippingFee || ''}
                        onChange={(e) => onShippingFeeChange(Number(e.target.value) || 0)}
                        className="w-full h-11 md:h-8 px-3 border border-slate-900/12 rounded-field text-base md:text-xs font-semibold font-num bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'surcharge' && (
                <div className="p-3 rounded-card bg-brand-50/50 border border-brand-200/80 space-y-2 animate-fadeIn text-footnote">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-950">{t('pos.surcharge_panel_title')}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('none')}
                      className="text-caption font-semibold text-brand-700 hover:text-brand-900"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="1000"
                    value={surcharge || ''}
                    onChange={(e) => onSurchargeChange(Number(e.target.value) || 0)}
                    className="w-full h-11 md:h-8 px-3.5 border border-slate-900/12 rounded-field text-base md:text-xs font-semibold font-num bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                    placeholder={t('pos.surcharge_placeholder')}
                  />
                </div>
              )}

              {activeTab === 'time' && onOrderCreatedAtChange && (
                <div className="p-3 rounded-card bg-brand-50/50 border border-brand-200/80 space-y-2 animate-fadeIn text-footnote">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-950">{t('pos.backdate_panel_title')}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('none')}
                      className="text-caption font-semibold text-brand-700 hover:text-brand-900"
                    >
                      {t('common.close')}
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
                    className="w-full h-11 md:h-8 px-3.5 border border-slate-900/12 rounded-field text-base md:text-xs font-semibold font-num bg-surface-card focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                  />
                </div>
              )}

              {/* TOTALS SUMMARY DISPLAY */}
              <div className="space-y-1 pt-1.5 border-t border-hairline text-footnote">
                <div className="flex justify-between text-slate-500">
                  <span>{t('pos.subtotal')}:</span>
                  <span className="font-num font-medium">{formatCurrency(subtotal, settings)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>{t('pos.discount')}:</span>
                    <span className="font-num">-{formatCurrency(discountAmount, settings)}</span>
                  </div>
                )}

                {promotionDiscount > 0 && (
                  <div className="flex justify-between text-brand-700 font-medium">
                    <span className="truncate max-w-[210px]">
                      {selectedPromotion?.name || t('pos.promotion_discount')}:
                    </span>
                    <span className="font-num">-{formatCurrency(promotionDiscount, settings)}</span>
                  </div>
                )}

                {platformFeeDiscount > 0 && (
                  <div className="flex justify-between text-amber-700 font-medium">
                    <span>{t('pos.platform_discount')}:</span>
                    <span className="font-num">-{formatCurrency(platformFeeDiscount, settings)}</span>
                  </div>
                )}

                {shippingFee > 0 && (
                  <div className="flex justify-between text-sky-700 font-medium">
                    <span>{t('pos.shipping_fee')}:</span>
                    <span className="font-num">+{formatCurrency(shippingFee, settings)}</span>
                  </div>
                )}

                {surcharge > 0 && (
                  <div className="flex justify-between text-brand-700 font-medium">
                    <span>{t('pos.surcharge')}:</span>
                    <span className="font-num">+{formatCurrency(surcharge, settings)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-900 font-bold text-headline pt-1.5 border-t border-hairline">
                  <span>{t('pos.total')}:</span>
                  <span className="text-brand-800 text-lg sm:text-xl font-bold font-num">
                    {formatCurrency(finalTotal, settings)}
                  </span>
                </div>
              </div>

              {/* 4. SIDE-BY-SIDE 1-TAP CAPSULE CHECKOUT BUTTONS */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onOneTapCash || onProceedCheckout}
                  disabled={isSubmitting || safeCartItems.length === 0}
                  isLoading={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 border-emerald-700/20 text-subhead px-3"
                  leftIcon={!isSubmitting ? <Banknote className="w-4 h-4 shrink-0 text-emerald-100" /> : undefined}
                >
                  {t('pos.fast_cash_1tap')}
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={onOneTapVietQR || onProceedCheckout}
                  disabled={isSubmitting || safeCartItems.length === 0}
                  className="text-subhead px-3"
                  leftIcon={<QrCode className="w-4 h-4 shrink-0 text-brand-100" />}
                >
                  {t('pos.fast_vietqr_1tap')}
                </Button>
              </div>

              {/* Secondary Capsule Button: Calculate Change / Other Fund */}
              {onOpenCheckoutModal && (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={onOpenCheckoutModal}
                  disabled={isSubmitting || safeCartItems.length === 0}
                  leftIcon={<Calculator className="w-3.5 h-3.5 text-slate-500" />}
                >
                  {t('pos.calc_change_other_fund')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nested Modals Rendered as Siblings Outside Drawer Transform Stacking Context */}
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

      <SalesChannelModal
        isOpen={isChannelModalOpen}
        onClose={() => setIsChannelModalOpen(false)}
        channels={localChannelsList}
        onChannelsUpdated={(updated) => {
          setLocalChannelsList(updated);
        }}
      />
    </>,
    document.body
  );
}
