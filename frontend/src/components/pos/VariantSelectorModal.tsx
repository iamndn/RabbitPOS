'use client';

import React, { useState } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';

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
  variants: ProductVariant[];
}

export interface CartItem {
  id: string; // Unique timestamp ID for cart entry
  product: Product;
  selectedVariant: ProductVariant;
  sugarLevel: string;
  iceLevel: string;
  selectedToppings: string[];
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
}

export default function VariantSelectorModal({ product, onClose, onAddToCart }: Props) {
  const { t } = useTranslation();
  const defaultVariant = product.variants?.[0] || {
    id: 0,
    product_id: product.id,
    variant_name: 'Regular',
    cogs_price: 0,
    retail_price: 0,
    sku: '',
  };

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(defaultVariant);
  const [sugarLevel, setSugarLevel] = useState<string>('100%');
  const [iceLevel, setIceLevel] = useState<string>('100%');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState<number>(1);

  const availableToppings = [
    { name: 'Boba Tapioca', price: 0.5 },
    { name: 'Cream Cheese Foam', price: 0.75 },
    { name: 'Egg Pudding', price: 0.5 },
  ];

  const toggleTopping = (toppingName: string) => {
    if (selectedToppings.includes(toppingName)) {
      setSelectedToppings(selectedToppings.filter((t) => t !== toppingName));
    } else {
      setSelectedToppings([...selectedToppings, toppingName]);
    }
  };

  const toppingsPrice = selectedToppings.reduce((acc, tName) => {
    const found = availableToppings.find((t) => t.name === tName);
    return acc + (found ? found.price : 0);
  }, 0);

  const unitPrice = selectedVariant.retail_price + toppingsPrice;
  const lineTotal = unitPrice * quantity;

  const handleAdd = () => {
    const notesArray = [
      `Sugar: ${sugarLevel}`,
      `Ice: ${iceLevel}`,
      selectedToppings.length > 0 ? `Toppings: ${selectedToppings.join(', ')}` : '',
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
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
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
            {product.variants?.map((v) => (
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
                  <span className="text-xs text-indigo-600 font-semibold">${v.retail_price.toFixed(2)}</span>
                </div>
                {selectedVariant.id === v.id && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Sugar Level */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Sugar / Đường</label>
          <div className="grid grid-cols-4 gap-1.5">
            {['100%', '70%', '50%', '30%'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSugarLevel(lvl)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  sugarLevel === lvl
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Ice Level */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Ice / Đá</label>
          <div className="grid grid-cols-4 gap-1.5">
            {['100%', '70%', '50%', '30%'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setIceLevel(lvl)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  iceLevel === lvl
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Extra Toppings */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Toppings</label>
          <div className="space-y-1.5">
            {availableToppings.map((topping) => {
              const isSelected = selectedToppings.includes(topping.name);
              return (
                <button
                  key={topping.name}
                  type="button"
                  onClick={() => toggleTopping(topping.name)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition text-xs ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{topping.name}</span>
                  <span className="text-indigo-600 font-bold">+${topping.price.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
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
            <span>${lineTotal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
