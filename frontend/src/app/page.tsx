'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, Coffee, RefreshCw, CheckCircle2, AlertCircle, Plus, Search, Check } from 'lucide-react';
import AppShell from '@/components/AppShell';
import VariantSelectorModal, { CartItem, Product } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import CheckoutModal from '@/components/pos/CheckoutModal';
import VietQRModal from '@/components/pos/VietQRModal';
import ReceiptModal, { CompletedOrderData } from '@/components/pos/ReceiptModal';
import { fetchApi, ApiResponse, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  image_url?: string;
  display_order: number;
}

export default function PosPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [settings, setSettings] = useState<SettingsMap | null>(null);

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

  // Receipt Modal State
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    const settingsRes = await fetchApi<any>('/settings');
    if (settingsRes.status === 'success' && settingsRes.data) {
      if (Array.isArray(settingsRes.data)) {
        const map: SettingsMap = {};
        settingsRes.data.forEach((s: any) => {
          if (s && s.key) map[s.key] = s.value;
        });
        setSettings(map);
      } else if (typeof settingsRes.data === 'object') {
        setSettings(settingsRes.data as SettingsMap);
      }
    }

    const catRes = await fetchApi<Category[]>('/categories');
    if (catRes.status === 'success') {
      const catList = Array.isArray(catRes.data)
        ? catRes.data
        : Array.isArray(catRes)
        ? (catRes as Category[])
        : [];
      setCategories(catList);
    }

    const prodRes = await fetchApi<Product[]>('/products');
    if (prodRes.status === 'success') {
      const prodList = Array.isArray(prodRes.data)
        ? prodRes.data
        : Array.isArray(prodRes)
        ? (prodRes as Product[])
        : [];
      setProducts(prodList);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();

    // 1. Restore Cart from LocalStorage (Offline Resiliency)
    try {
      const savedCart = localStorage.getItem('rabbitpos_active_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (parsed.cartItems && Array.isArray(parsed.cartItems)) {
          setCartItems(parsed.cartItems);
        }
        if (typeof parsed.discountAmount === 'number') {
          setDiscountAmount(parsed.discountAmount);
        }
      }
    } catch (e) {
      console.error('Failed to restore active cart', e);
    }
  }, []);

  // 2. Persist Active Cart to LocalStorage
  useEffect(() => {
    try {
      if (cartItems.length > 0 || discountAmount > 0) {
        localStorage.setItem(
          'rabbitpos_active_cart',
          JSON.stringify({ cartItems, discountAmount })
        );
      } else {
        localStorage.removeItem('rabbitpos_active_cart');
      }
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cartItems, discountAmount]);

  // Cart Handlers
  const handleAddToCart = (newItem: CartItem) => {
    setCartItems((prev) => [...prev, newItem]);
    setOrderSuccessMessage(t('pos.added_to_cart', { name: `${newItem.product.name} (${newItem.selectedVariant.variant_name})` }));
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
  const submitOrder = async (targetFundId: number) => {
    if (cartItems.length === 0) return;

    const fundIdNum = Number(targetFundId);
    if (!fundIdNum || isNaN(fundIdNum)) {
      alert(t('pos.order_failed', { message: 'Invalid payment fund selected' }));
      return;
    }

    const currentSubtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
    const currentTotal = Math.max(0, currentSubtotal - discountAmount);
    const orderCartSnapshot = [...cartItems];

    const payload = {
      fund_id: fundIdNum,
      discount_amount: Number(discountAmount) || 0,
      created_by: 'Cashier Staff',
      items: cartItems.map((ci) => ({
        product_variant_id: Number(ci.selectedVariant.id),
        quantity: Number(ci.quantity),
        unit_price: Number(ci.unitPrice),
        selected_toppings: ci.selectedToppings || [],
        toppings_price: Number(ci.toppingsPrice) || 0,
        notes: ci.notes || '',
      })),
    };

    try {
      const res = await fetchApi<any>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.status === 'success' && res.data) {
        const createdOrder = res.data;

        // Purge persisted cart
        localStorage.removeItem('rabbitpos_active_cart');
        setCartItems([]);
        setDiscountAmount(0);
        setIsCheckoutModalOpen(false);
        setIsVietQRModalOpen(false);
        setIsCartDrawerOpen(false);

        // Open Receipt Thermal Printing Modal
        setCompletedOrder({
          order_code: createdOrder.order_code,
          created_at: createdOrder.created_at,
          created_by: createdOrder.created_by || 'Cashier Staff',
          payment_method: fundIdNum === 2 ? 'VietQR Transfer' : 'Cash',
          items: orderCartSnapshot,
          subtotal: currentSubtotal,
          discount: discountAmount,
          total: currentTotal,
        });
        setIsReceiptModalOpen(true);
        setOrderSuccessMessage(t('pos.order_completed'));
        setTimeout(() => setOrderSuccessMessage(null), 4000);
      } else {
        alert(t('pos.order_failed', { message: res.message || 'Server error' }));
      }
    } catch (err: any) {
      alert(t('pos.order_failed', { message: err?.message || 'Network connection failed' }));
    }
  };

  const handleConfirmCashPayment = async (fundId: number) => {
    setSelectedFundId(fundId);
    await submitOrder(fundId);
  };

  const handleSelectBankTransfer = (fundId: number) => {
    setSelectedFundId(fundId);
    setIsCheckoutModalOpen(false);
    setIsVietQRModalOpen(true);
  };

  const handleConfirmVietQRPayment = async () => {
    if (selectedFundId) {
      await submitOrder(selectedFundId);
    }
  };

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  const filteredProducts = safeProducts.filter((p) => {
    const matchesCat = activeCategoryId ? p.category_id === activeCategoryId : true;
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const cartSubtotal = safeCartItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);
  const totalItemCount = safeCartItems.reduce((acc, item) => acc + item.quantity, 0);

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
              {t('pos.all_items')} ({safeProducts.length})
            </button>
            {safeCategories.map((cat) => (
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
              placeholder={t('pos.search_placeholder')}
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
            {t('pos.no_drinks')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((product) => {
              const startingPrice =
                Array.isArray(product.variants) && product.variants.length > 0
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
                      {getImageUrl(product.image_url) ? (
                        <img
                          src={getImageUrl(product.image_url)!}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                        />
                      ) : (
                        <Coffee className="w-8 h-8 opacity-40 text-slate-400" />
                      )}
                    </div>
                    {product.tag && product.tag !== 'none' && (
                      <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                        {product.tag === 'best_seller'
                          ? t('products.best_seller')
                          : product.tag === 'new'
                          ? t('products.new')
                          : product.tag.replace('_', ' ')}
                      </span>
                    )}
                    <h3 className="font-semibold text-slate-900 text-xs mt-1 leading-tight group-hover:text-indigo-600 transition">
                      {product.name}
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-indigo-600 text-xs">{formatCurrency(startingPrice, settings)}</span>
                    <span className="bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 text-xs font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5">
                      <Plus className="w-3.5 h-3.5" /> {t('pos.order_button')}
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
              <p className="text-[11px] text-slate-400 font-medium">{t('pos.cart_total')} ({t('pos.items_count', { count: totalItemCount })})</p>
              <p className="text-base font-bold text-white">{formatCurrency(cartTotal, settings)}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2.5 rounded-xl transition"
            >
              {t('pos.view_cart')}
            </button>
            <button
              disabled={cartItems.length === 0}
              onClick={() => setIsCheckoutModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition disabled:cursor-not-allowed"
            >
              {t('pos.checkout')}
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
          settings={settings}
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
        settings={settings}
      />

      {isCheckoutModalOpen && (
        <CheckoutModal
          totalAmount={cartTotal}
          onClose={() => setIsCheckoutModalOpen(false)}
          onConfirmCashPayment={handleConfirmCashPayment}
          onSelectBankTransfer={handleSelectBankTransfer}
          settings={settings}
        />
      )}

      {isVietQRModalOpen && (
        <VietQRModal
          totalAmount={cartTotal}
          onClose={() => setIsVietQRModalOpen(false)}
          onConfirmOrder={handleConfirmVietQRPayment}
          settings={settings}
        />
      )}

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={completedOrder}
        settings={settings}
      />
    </AppShell>
  );
}
