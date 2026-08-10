'use client';

import React from 'react';
import { X, Trash2, Minus, Plus, ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { CartItem } from './VariantSelectorModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQty: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  discountAmount: number;
  onDiscountChange: (amount: number) => void;
  onProceedCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  onRemoveItem,
  discountAmount,
  onDiscountChange,
  onProceedCheckout,
}: Props) {
  if (!isOpen) return null;

  const subtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const total = Math.max(0, subtotal - discountAmount);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-base">Current Order Cart</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {cartItems.reduce((acc, i) => acc + i.quantity, 0)} items
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <ShoppingBag className="w-16 h-16 opacity-30 mb-2" />
              <p className="font-semibold text-sm text-slate-600">Your cart is empty</p>
              <p className="text-xs text-slate-400 mt-1">Tap products on the menu grid to add items to your order.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between space-x-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{item.product.name}</h4>
                    <span className="font-bold text-slate-900 text-sm">${item.lineTotal.toFixed(2)}</span>
                  </div>

                  <div className="text-xs font-medium text-indigo-600 mt-0.5">
                    {item.selectedVariant.variant_name} (${item.selectedVariant.retail_price.toFixed(2)})
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 mt-0.5 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                      {item.notes}
                    </p>
                  )}

                  {/* Quantity Stepper & Remove */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-bold text-xs text-slate-900 px-1">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        className="w-6 h-6 rounded bg-white shadow-sm flex items-center justify-center text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            {/* Discount Row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-indigo-500" /> Discount ($)
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={discountAmount || ''}
                onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="w-24 p-1.5 text-right text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>

            {/* Totals */}
            <div className="space-y-1 pt-1 border-t border-slate-200/60 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 font-bold text-base pt-1 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-indigo-600">${total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={onProceedCheckout}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition flex items-center justify-center space-x-2 text-sm"
            >
              <span>Checkout Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
