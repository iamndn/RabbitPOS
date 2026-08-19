'use client';

import React, { useEffect, useState } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi, getImageUrl } from '@/lib/api';
import { formatCurrency, SettingsMap } from '@/lib/utils';

export interface ProductVariant {
  id: number;
  product_id: number;
  variant_name: string;
  cogs_price: number;
  retail_price: number;
  sku: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  image_url: string;
  tag: string;
  is_active?: boolean;
  variants: ProductVariant[];
}

// ToppingSnapshot is the denormalized topping stored in the order payload and receipt
export interface ToppingSnapshot {
  id: number;
  name: string;
  price: number;
}

// Topping as returned by the API
interface ApiTopping {
  id: number;
  name: string;
  price: number;
  cogs: number;
  category_id: number | null;
  is_active: boolean;
}

export interface CartItem {
  id: string; // Unique timestamp ID for cart entry
  product: Product;
  selectedVariant: ProductVariant;
  sugarLevel: string;
  iceLevel: string;
  selectedToppings: ToppingSnapshot[];
  toppingsPrice: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string;
}

interface Props {
  product: Product;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  settings?: SettingsMap | null;
}

// Standardized sugar level presets (100-70-50-30-0%)
const SUGAR_LEVELS = [
  { value: '100', label: '100% Đường' },
  { value: '70',  label: '70% Đường' },
  { value: '50',  label: '50% Đường' },
  { value: '30',  label: '30% Đường' },
  { value: '0',   label: 'Không Đường' },
];

// Standardized ice level presets (100-70-50-30-0%)
const ICE_LEVELS = [
  { value: '100', label: '100% Đá' },
  { value: '70',  label: '70% Đá' },
  { value: '50',  label: '50% Đá' },
  { value: '30',  label: '30% Đá' },
  { value: '0',   label: 'Không Đá / Đá Riêng' },
];

export default function VariantSelectorModal({ product, onClose, onAddToCart, settings }: Props) {
  const { t } = useTranslation();
  const safeVariants = Array.isArray(product?.variants) ? product.variants : [];
  const defaultVariant = safeVariants[0] || {
    id: 0,
    product_id: product?.id || 0,
    variant_name: 'Regular',
    cogs_price: 0,
    retail_price: 0,
    sku: '',
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(defaultVariant);
  const [sugarLevel, setSugarLevel] = useState<string>('100');
  const [iceLevel, setIceLevel] = useState<string>('100');
  const [selectedToppings, setSelectedToppings] = useState<ToppingSnapshot[]>([]);
  const [availableToppings, setAvailableToppings] = useState<ApiTopping[]>([]);
  const [loadingToppings, setLoadingToppings] = useState<boolean>(true);
  const [quantity, setQuantity] = useState<number>(1);

  // Fetch active toppings for this product's category on mount
  useEffect(() => {
    const fetchToppings = async () => {
      setLoadingToppings(true);
      const url = product.category_id
        ? `/toppings?category_id=${product.category_id}`
        : '/toppings';
      const res = await fetchApi<ApiTopping[]>(url);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setAvailableToppings(res.data);
      } else {
        setAvailableToppings([]);
      }
      setLoadingToppings(false);
    };
    fetchToppings();
  }, [product.id, product.category_id]);

  const toggleTopping = (topping: ApiTopping) => {
    const exists = selectedToppings.some((t) => t.id === topping.id);
    if (exists) {
      setSelectedToppings(selectedToppings.filter((t) => t.id !== topping.id));
    } else {
      setSelectedToppings([...selectedToppings, { id: topping.id, name: topping.name, price: topping.price }]);
    }
  };

  const toppingsPrice = selectedToppings.reduce((acc, t) => acc + t.price, 0);
  const unitPrice = selectedVariant.retail_price + toppingsPrice;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    const sugarLabel = SUGAR_LEVELS.find((s) => s.value === sugarLevel)?.label || `${sugarLevel}% Đường`;
    const iceLabel = ICE_LEVELS.find((i) => i.value === iceLevel)?.label || `${iceLevel}% Đá`;

    const notesArray = [
      sugarLabel,
      iceLabel,
      selectedToppings.length > 0 ? `Topping: ${selectedToppings.map((t) => t.name).join(', ')}` : '',
    ].filter(Boolean);

    const cartItem: CartItem = {
      id: `${product.id}-${selectedVariant.id}-${Date.now()}`,
      product,
      selectedVariant,
      sugarLevel,
      iceLevel,
      selectedToppings,
      toppingsPrice,
      quantity,
      unitPrice,
      lineTotal,
      notes: notesArray.join(' | '),
    };

    onAddToCart(cartItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 flex-shrink-0">
              {getImageUrl(product.image_url) ? (
                <img src={getImageUrl(product.image_url)!} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg">
                  {product.name[0]}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{product.name}</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{product.description || t('pos.select_variant')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Size / Variant Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">{t('pos.select_variant')}</label>
          <div className="grid grid-cols-2 gap-2">
            {safeVariants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVariant(v)}
                className={`p-3 rounded-xl border text-left transition flex items-center justify-between ${
                  selectedVariant.id === v.id
                    ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <span className="block text-xs font-bold text-slate-900">{v.variant_name}</span>
                  <span className="text-xs text-indigo-600 font-semibold">{formatCurrency(v.retail_price, settings)}</span>
                </div>
                {selectedVariant.id === v.id && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Sugar Level — 5 standardized presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">{t('pos.sugar_level')}</label>
          <div className="grid grid-cols-5 gap-1">
            {SUGAR_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => setSugarLevel(lvl.value)}
                className={`py-2 px-1 rounded-xl text-[10px] font-semibold border transition text-center leading-tight ${
                  sugarLevel === lvl.value
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Ice Level — 5 standardized presets */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">{t('pos.ice_level')}</label>
          <div className="grid grid-cols-5 gap-1">
            {ICE_LEVELS.map((lvl) => (
              <button
                key={lvl.value}
                type="button"
                onClick={() => setIceLevel(lvl.value)}
                className={`py-2 px-1 rounded-xl text-[10px] font-semibold border transition text-center leading-tight ${
                  iceLevel === lvl.value
                    ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Dynamic Toppings (fetched from API) */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">{t('pos.toppings')}</label>
          {loadingToppings ? (
            <p className="text-xs text-slate-400 py-2 text-center">{t('common.loading')}</p>
          ) : availableToppings.length === 0 ? (
            <p className="text-xs text-slate-400 py-2 text-center italic">Không có topping</p>
          ) : (
            <div className="space-y-1.5">
              {availableToppings.map((topping) => {
                const isSelected = selectedToppings.some((t) => t.id === topping.id);
                return (
                  <button
                    key={topping.id}
                    type="button"
                    onClick={() => toggleTopping(topping)}
                    className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition text-xs ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span>{topping.name}</span>
                      {topping.category_id === null && (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded">toàn cầu</span>
                      )}
                    </div>
                    <span className="text-indigo-600 font-bold">+{formatCurrency(topping.price, settings)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quantity Stepper & Submit Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center space-x-3">
          <div className="flex items-center space-x-3 border border-slate-200 rounded-xl p-1 bg-slate-50">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-900 text-sm px-1">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100 font-bold"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition flex items-center justify-between text-sm"
          >
            <span>{t('pos.add_to_order')}</span>
            <span>{formatCurrency(lineTotal, settings)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
