'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Coffee, RefreshCw, CheckCircle2, AlertCircle, Plus, Search, Check } from 'lucide-react';
import AppShell from '@/components/AppShell';
import VariantSelectorModal, { CartItem, Product } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import CheckoutModal from '@/components/pos/CheckoutModal';
import VietQRModal from '@/components/pos/VietQRModal';
import { fetchApi, ApiResponse } from '@/lib/api';

interface Category {
  id: number;
  name: string;
  display_order: number;
}

export default function PosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Modal Control States
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isVietQRModalOpen, setIsVietQRModalOpen] = useState<boolean>(false);
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const catRes = await fetchApi<Category[]>('/categories');
    if (catRes.status === 'success' && catRes.data) {
      setCategories(catRes.data);
    }

    const prodRes = await fetchApi<Product[]>('/products');
    if (prodRes.status === 'success' && prodRes.data) {
      setProducts(prodRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cart Handlers
  const handleAddToCart = (newItem: CartItem) => {
    setCartItems((prev) => [...prev, newItem]);
    setOrderSuccessMessage(`Added ${newItem.product.name} (${newItem.selectedVariant.variant_name}) to order`);
    setTimeout(() => setOrderSuccessMessage(null), 3000);
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              lineTotal: item.unitPrice * newQty,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Order Submission Logic
  const submitOrder = async (fundId: number) => {
    if (cartItems.length === 0) return;

    const payload = {
      fund_id: fundId,
      discount_amount: discountAmount,
      created_by: 'Cashier Staff',
      items: cartItems.map((ci) => ({
        product_variant_id: ci.selectedVariant.id,
        quantity: ci.quantity,
        unit_price: ci.unitPrice,
        notes: ci.notes,
      })),
    };

    const res = await fetchApi<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 'success' && res.data) {
      const createdOrder = res.data;
      setCartItems([]);
      setDiscountAmount(0);
      setIsCheckoutModalOpen(false);
      setIsVietQRModalOpen(false);
      setIsCartDrawerOpen(false);

      alert(`✅ Order ${createdOrder.order_code} completed successfully! Total: $${createdOrder.total_amount.toFixed(2)}`);
    } else {
      alert('Failed to submit order: ' + res.message);
    }
  };

  const handleConfirmCashPayment = (fundId: number) => {
    submitOrder(fundId);
  };

  const handleSelectBankTransfer = (fundId: number) => {
    setSelectedFundId(fundId);
    setIsCheckoutModalOpen(false);
    setIsVietQRModalOpen(true);
  };

  const handleConfirmVietQRPayment = () => {
    if (selectedFundId) {
      submitOrder(selectedFundId);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategoryId ? p.category_id === activeCategoryId : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartSubtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);
  const totalItemCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <AppShell>
      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Success Toast Banner */}
        {orderSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {orderSuccessMessage}
            </span>
          </div>
        )}

        {/* Category Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex overflow-x-auto space-x-2 pb-1 w-full sm:w-auto scrollbar-none">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-sm transition ${
                activeCategoryId === null
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              All Items ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-sm transition ${
                  activeCategoryId === cat.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search drinks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>
        </div>

        {/* Product Card Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
            No drinks found.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const startingPrice =
                product.variants && product.variants.length > 0
                  ? Math.min(...product.variants.map((v) => v.retail_price))
                  : 0;

              return (
                <div
                  key={product.id}
                  onClick={() => setSelectedProductForVariant(product)}
                  className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-slate-400 overflow-hidden relative">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <Coffee className="w-8 h-8 opacity-40 text-slate-400" />
                      )}
                    </div>
                    {product.tag && product.tag !== 'none' && (
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                        {product.tag.replace('_', ' ')}
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-900 text-xs mt-1 leading-tight group-hover:text-indigo-600 transition">
                      {product.name}
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-indigo-600 text-xs">${startingPrice.toFixed(2)}</span>
                    <span className="bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 text-xs font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5">
                      <Plus className="w-3.5 h-3.5" /> Order
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Mobile Sticky Cart Sheet Bar */}
        <div className="fixed bottom-14 md:bottom-4 left-4 right-4 max-w-7xl mx-auto z-20 bg-slate-900 text-white p-3 rounded-2xl shadow-xl flex items-center justify-between">
          <div
            onClick={() => setIsCartDrawerOpen(true)}
            className="flex items-center space-x-3 cursor-pointer"
          >
            <div className="relative bg-indigo-600 p-2.5 rounded-xl text-white">
              <ShoppingBag className="w-5 h-5" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItemCount}
                </span>
              )}
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Cart Total ({totalItemCount} items)</p>
              <p className="text-base font-bold text-white">${cartTotal.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
            >
              View Cart
            </button>
            <button
              disabled={cartItems.length === 0}
              onClick={() => setIsCheckoutModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition disabled:cursor-not-allowed"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedProductForVariant && (
        <VariantSelectorModal
          product={selectedProductForVariant}
          onClose={() => setSelectedProductForVariant(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        cartItems={cartItems}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        discountAmount={discountAmount}
        onDiscountChange={setDiscountAmount}
        onProceedCheckout={() => {
          setIsCartDrawerOpen(false);
          setIsCheckoutModalOpen(true);
        }}
      />

      {isCheckoutModalOpen && (
        <CheckoutModal
          totalAmount={cartTotal}
          onClose={() => setIsCheckoutModalOpen(false)}
          onConfirmCashPayment={handleConfirmCashPayment}
          onSelectBankTransfer={handleSelectBankTransfer}
        />
      )}

      {isVietQRModalOpen && (
        <VietQRModal
          totalAmount={cartTotal}
          onClose={() => setIsVietQRModalOpen(false)}
          onConfirmOrder={handleConfirmVietQRPayment}
        />
      )}
    </AppShell>
  );
}
