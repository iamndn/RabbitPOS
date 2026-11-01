'use client';

import React, { useState, useMemo } from 'react';
import { X, Gift, Search, Sparkles, Check, Coffee } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { getImageUrl } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { Badge, Button, Chip, ModalShell } from '@/components/ui';
import { Promotion } from '@/types/promotion';
import { Product, ProductVariant } from './VariantSelectorModal';

interface CategoryItem {
  id: number;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  promotion: Promotion;
  products: Product[];
  categories?: CategoryItem[];
  selectedVariantId?: number | null;
  onSelectGift: (variant: ProductVariant, product: Product) => void;
  settings?: SettingsMap | null;
}

interface GiftOption {
  product: Product;
  variant: ProductVariant;
}

export default function GiftItemSelectorModal({
  isOpen,
  onClose,
  promotion,
  products,
  categories = [],
  selectedVariantId,
  onSelectGift,
  settings,
}: Props) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | 'all'>('all');

  // Parse allowed gift variant IDs if restricted
  const allowedVariantIds = useMemo(() => {
    if (!promotion.allow_select_gift) {
      if (promotion.gift_product_variant_id) {
        return [promotion.gift_product_variant_id];
      }
      return [];
    }

    if (promotion.gift_target_ids) {
      try {
        const parsed = JSON.parse(promotion.gift_target_ids);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((id) => Number(id));
        }
      } catch {
        // Fallback to all
      }
    }
    return null; // null means all variants are allowed
  }, [promotion]);

  // Flatten all active product variants into gift options
  const allGiftOptions = useMemo(() => {
    const list: GiftOption[] = [];
    if (!Array.isArray(products)) return list;

    products.forEach((prod) => {
      if (!prod || prod.is_active === false) return;
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v) => {
          if (!v) return;
          // If restrictions exist, filter by allowedVariantIds
          if (allowedVariantIds !== null && !allowedVariantIds.includes(v.id)) {
            return;
          }
          list.push({ product: prod, variant: v });
        });
      }
    });
    return list;
  }, [products, allowedVariantIds]);

  // Filter gift options based on category and search
  const filteredOptions = useMemo(() => {
    return allGiftOptions.filter(({ product, variant }) => {
      const matchesCategory =
        selectedCategoryId === 'all' || product.category_id === selectedCategoryId;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        variant.variant_name.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allGiftOptions, selectedCategoryId, searchQuery]);

  if (!isOpen) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      nested
      size="lg"
      icon={<Gift className="w-5 h-5 text-amber-600" />}
      title={t('promotions.select_gift_modal_title')}
      description={
        <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="truncate">{t('pos.promo_label_prefix', { name: promotion.name })}</span>
        </span>
      }
      headerActions={
        <Badge variant="brand" size="sm">
          {t('pos.free_0d')}
        </Badge>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-footnote text-slate-600 font-medium font-num">
            {t('pos.gift_valid_count', { count: filteredOptions.length })}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Categories Bar (16px mobile capsule input to prevent iOS Safari zoom) */}
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('pos.gift_search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 md:h-9 bg-surface-card border border-slate-900/12 pl-10 pr-10 rounded-full text-base md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('pos.clear_search')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Chips (Opaque capsule chips, 0px blur) */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              <Chip
                size="sm"
                active={selectedCategoryId === 'all'}
                count={allGiftOptions.length}
                onClick={() => setSelectedCategoryId('all')}
              >
                {t('pos.queue_tab_all')}
              </Chip>
              {categories.map((c) => {
                const count = allGiftOptions.filter((o) => o.product.category_id === c.id).length;
                if (count === 0) return null;
                return (
                  <Chip
                    key={c.id}
                    size="sm"
                    active={selectedCategoryId === c.id}
                    count={count}
                    onClick={() => setSelectedCategoryId(c.id)}
                  >
                    {c.name}
                  </Chip>
                );
              })}
            </div>
          )}
        </div>

        {/* Gift Options Grid */}
        {filteredOptions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2.5 bg-surface-card rounded-card border border-card shadow-card">
            <Gift className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
            <p className="text-subhead font-medium text-slate-600">{t('pos.gift_empty')}</p>
            {searchQuery && (
              <Button variant="soft" size="sm" onClick={() => setSearchQuery('')}>
                {t('pos.clear_search_filter')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredOptions.map(({ product, variant }) => {
              const isCurrentSelected = selectedVariantId === variant.id;
              const imgUrl = getImageUrl(product.image_url);

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => {
                    onSelectGift(variant, product);
                    onClose();
                  }}
                  className={`p-3 rounded-card border text-left transition-all duration-press ease-press flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.98] ${
                    isCurrentSelected
                      ? 'bg-brand-50/75 border-brand-500 ring-2 ring-brand-500/20'
                      : 'bg-surface-card border-card shadow-card hover:border-brand-300 hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Product Thumbnail */}
                    <div className="w-12 h-12 rounded-field bg-surface-grouped flex items-center justify-center shrink-0 overflow-hidden border border-hairline relative">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Coffee className="w-5 h-5 text-slate-400" />
                      )}
                      <span className="absolute bottom-0 right-0 bg-amber-500 text-caption font-bold text-white px-1.5 rounded-tl-md font-num">
                        0đ
                      </span>
                    </div>

                    {/* Product Details */}
                    <div className="min-w-0">
                      <h4 className="text-subhead font-semibold text-slate-900 truncate">
                        {product.name}
                      </h4>
                      <div className="text-caption font-medium text-slate-500 truncate">
                        {variant.variant_name !== 'Default'
                          ? variant.variant_name
                          : t('pos.default_variant')}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-caption text-slate-400 line-through font-medium font-num">
                          {formatCurrency(variant.retail_price, settings)}
                        </span>
                        <span className="text-caption font-bold text-brand-700">
                          {t('pos.free_gift_short')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Capsule Action Pill */}
                  <span
                    className={`px-3 py-1.5 rounded-full text-caption font-semibold transition shrink-0 inline-flex items-center gap-1 ${
                      isCurrentSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {isCurrentSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('pos.selected_label')}</span>
                      </>
                    ) : (
                      <span>{t('pos.choose_label')}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
