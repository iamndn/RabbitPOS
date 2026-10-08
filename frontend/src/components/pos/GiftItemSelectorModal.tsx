'use client';

import React, { useState, useMemo } from 'react';
import { X, Gift, Search, Sparkles, Check, Coffee } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { getImageUrl } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';
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
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-emerald-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                  {t('promotions.select_gift_modal_title') || 'Chọn món quà tặng'}
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  0đ Miễn phí
                </span>
              </div>
              <p className="text-xs text-amber-800 font-semibold truncate mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>CTKM: {promotion.name}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 space-y-2.5 bg-slate-50/50">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm món quà tặng theo tên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-10 pr-9 py-2 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                  selectedCategoryId === 'all'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                Tất cả ({allGiftOptions.length})
              </button>
              {categories.map((c) => {
                const count = allGiftOptions.filter((o) => o.product.category_id === c.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 ${
                      selectedCategoryId === c.id
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {c.name} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Gift Options Grid */}
        <div className="p-3.5 sm:p-5 overflow-y-auto flex-1 max-h-[50vh]">
          {filteredOptions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Gift className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
              <p className="text-xs font-semibold">Không tìm thấy món quà tặng phù hợp.</p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-bold text-amber-600 hover:underline cursor-pointer"
                >
                  Xóa bộ lọc tìm kiếm
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredOptions.map(({ product, variant }) => {
                const isCurrentSelected = selectedVariantId === variant.id;
                const imgUrl = getImageUrl(product.image_url);

                return (
                  <div
                    key={variant.id}
                    onClick={() => {
                      onSelectGift(variant, product);
                      onClose();
                    }}
                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer select-none active:scale-[0.98] ${
                      isCurrentSelected
                        ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Product Thumbnail */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200/60 relative">
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
                        <span className="absolute bottom-0 right-0 bg-amber-500 text-[9px] font-black text-white px-1 rounded-tl-md">
                          0đ
                        </span>
                      </div>

                      {/* Product Details */}
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                          {product.name}
                        </h4>
                        <div className="text-[11px] font-semibold text-slate-500 truncate">
                          {variant.variant_name !== 'Default' ? variant.variant_name : 'Mặc định'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 line-through">
                            {formatCurrency(variant.retail_price, settings)}
                          </span>
                          <span className="text-[11px] font-black text-emerald-600">
                            0đ (Tặng)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs ${
                        isCurrentSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {isCurrentSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Đang chọn</span>
                        </>
                      ) : (
                        <span>Chọn</span>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Có {filteredOptions.length} món quà tặng hợp lệ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
