'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ShoppingBag, Coffee, RefreshCw, CheckCircle2, AlertCircle, Plus, Search, Check, Tag } from 'lucide-react';
import AppShell from '@/components/AppShell';
import VariantSelectorModal, { CartItem, Product } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import CheckoutModal from '@/components/pos/CheckoutModal';
import VietQRModal from '@/components/pos/VietQRModal';
import ReceiptModal, { CompletedOrderData } from '@/components/pos/ReceiptModal';
import { Promotion } from '@/app/promotions/page';
import { fetchApi, ApiResponse, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';

interface Category {
  id: number;
  name: string;
  image_url?: string;
  display_order: number;
}

// ── MEMOIZED CATEGORY TABS ───────────────────────────────────────────────────
interface CategoryTabsProps {
  categories: Category[];
  activeCategoryId: number | null;
  totalProductsCount: number;
  onSelectCategory: (id: number | null) => void;
  allLabel: string;
}

const CategoryTabs = React.memo(function CategoryTabs({
  categories,
  activeCategoryId,
  totalProductsCount,
  onSelectCategory,
  allLabel,
}: CategoryTabsProps) {
  return (
    <div className="flex overflow-x-auto space-x-2 pb-1 w-full sm:w-auto scrollbar-none">
      <button
        onClick={() => onSelectCategory(null)}
        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shadow-sm transition ${
          activeCategoryId === null
            ? 'bg-indigo-600 text-white'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
        }`}
      >
        {allLabel} ({totalProductsCount})
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
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
  );
});

// ── MEMOIZED PRODUCT CARD ────────────────────────────────────────────────────
interface ProductCardProps {
  product: Product;
  settings: SettingsMap | null;
  onSelect: (product: Product) => void;
  orderBtnLabel: string;
  t: (key: string, params?: any) => string;
}

const ProductCard = React.memo(function ProductCard({
  product,
  settings,
  onSelect,
  orderBtnLabel,
  t,
}: ProductCardProps) {
  const startingPrice = useMemo(() => {
    return Array.isArray(product.variants) && product.variants.length > 0
      ? Math.min(...product.variants.map((v) => v.retail_price))
      : 0;
  }, [product.variants]);

  const imageUrl = useMemo(() => getImageUrl(product.image_url), [product.image_url]);

  const isSuspended = product.tag === 'suspended';
  const isComingSoon = product.tag === 'coming_soon';

  const handleClick = () => {
    if (isSuspended) {
      alert(`${product.name} hiện đang tạm ngưng phục vụ.`);
      return;
    }
    if (isComingSoon) {
      alert(`${product.name} sắp ra mắt, quý khách vui lòng chờ nhé!`);
      return;
    }
    onSelect(product);
  };

  return (
    <div
      onClick={handleClick}
      className={`bg-white p-3 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-200 transition flex flex-col justify-between cursor-pointer group ${
        isSuspended ? 'opacity-70' : ''
      }`}
    >
      <div>
        <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-slate-400 overflow-hidden relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            />
          ) : (
            <Coffee className="w-8 h-8 opacity-40 text-slate-400" />
          )}
        </div>
        {product.tag && product.tag !== 'none' && (
          <span
            className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border inline-block mb-1 ${
              product.tag === 'featured'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : product.tag === 'best_seller'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : product.tag === 'new'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : product.tag === 'coming_soon'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : product.tag === 'suspended'
                ? 'bg-slate-100 text-slate-700 border-slate-300'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            {product.tag === 'featured'
              ? '⭐ ' + (t('products.featured') || 'Nổi bật')
              : product.tag === 'best_seller'
              ? '🔥 ' + (t('products.best_seller') || 'Bán chạy')
              : product.tag === 'new'
              ? '✨ ' + (t('products.new') || 'Món mới')
              : product.tag === 'coming_soon'
              ? '⏳ ' + (t('products.coming_soon') || 'Sắp ra mắt')
              : product.tag === 'suspended'
              ? '⛔ ' + (t('products.suspended') || 'Tạm ngưng')
              : product.tag.replace('_', ' ')}
          </span>
        )}
        <h3 className="font-semibold text-slate-900 text-xs leading-tight group-hover:text-indigo-600 transition">
          {product.name}
        </h3>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-bold text-indigo-600 text-xs">{formatCurrency(startingPrice, settings)}</span>
        {isSuspended ? (
          <span className="bg-slate-100 text-slate-500 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200">
            ⛔ {t('products.suspended') || 'Tạm ngưng'}
          </span>
        ) : isComingSoon ? (
          <span className="bg-blue-50 text-blue-600 text-[11px] font-bold px-2 py-1 rounded-lg border border-blue-200">
            ⏳ {t('products.coming_soon') || 'Sắp có'}
          </span>
        ) : (
          <span className="bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 text-xs font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5">
            <Plus className="w-3.5 h-3.5" /> {orderBtnLabel}
          </span>
        )}
      </div>
    </div>
  );
});

export default function PosPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [promotionDiscount, setPromotionDiscount] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [platformFeeDiscount, setPlatformFeeDiscount] = useState<number>(0);
  const [surcharge, setSurcharge] = useState<number>(0);

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

  // 250ms Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Parallelized initial data loading with in-memory caching and automatic retry
  const loadData = useCallback(async (retryCount = 0) => {
    setLoading(true);

    try {
      const [settingsRes, catRes, prodRes] = await Promise.all([
        fetchApi<any>('/settings'),
        fetchApi<Category[]>('/categories'),
        fetchApi<Product[]>('/products'),
      ]);

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

      if (catRes.status === 'success') {
        const catList = Array.isArray(catRes.data)
          ? catRes.data
          : Array.isArray(catRes)
          ? (catRes as Category[])
          : [];
        setCategories(catList);
      }

      if (prodRes.status === 'success') {
        const prodList = Array.isArray(prodRes.data)
          ? prodRes.data
          : Array.isArray(prodRes)
          ? (prodRes as Product[])
          : [];
        setProducts(prodList);
      } else if (retryCount < 2) {
        // Cold-start retry
        setTimeout(() => loadData(retryCount + 1), 800);
        return;
      }
    } catch (err) {
      console.error('Failed to load POS catalog data:', err);
      if (retryCount < 2) {
        setTimeout(() => loadData(retryCount + 1), 800);
        return;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 1. Restore Cart & Adjustments from LocalStorage
    try {
      const savedCart = localStorage.getItem('rabbitpos_active_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (parsed.cartItems && Array.isArray(parsed.cartItems)) {
          setCartItems(parsed.cartItems);
        }
        if (typeof parsed.orderNote === 'string') {
          setOrderNote(parsed.orderNote);
        }
        if (typeof parsed.discountAmount === 'number') {
          setDiscountAmount(parsed.discountAmount);
        }
        if (parsed.selectedPromotion) {
          setSelectedPromotion(parsed.selectedPromotion);
        }
        if (typeof parsed.shippingFee === 'number') {
          setShippingFee(parsed.shippingFee);
        }
        if (typeof parsed.platformFeeDiscount === 'number') {
          setPlatformFeeDiscount(parsed.platformFeeDiscount);
        }
        if (typeof parsed.surcharge === 'number') {
          setSurcharge(parsed.surcharge);
        }
      }
    } catch (e) {
      console.error('Failed to restore active cart', e);
    }
  }, [loadData]);

  // 2. Persist Active Cart to LocalStorage
  useEffect(() => {
    try {
      if (
        cartItems.length > 0 ||
        orderNote.trim() !== '' ||
        discountAmount > 0 ||
        selectedPromotion ||
        shippingFee > 0 ||
        platformFeeDiscount > 0 ||
        surcharge > 0
      ) {
        localStorage.setItem(
          'rabbitpos_active_cart',
          JSON.stringify({
            cartItems,
            orderNote,
            discountAmount,
            selectedPromotion,
            shippingFee,
            platformFeeDiscount,
            surcharge,
          })
        );
      } else {
        localStorage.removeItem('rabbitpos_active_cart');
      }
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cartItems, orderNote, discountAmount, selectedPromotion, shippingFee, platformFeeDiscount, surcharge]);

  // 3. Dynamic Promotion Discount Evaluation
  useEffect(() => {
    if (!selectedPromotion) {
      setPromotionDiscount(0);
      return;
    }
    const currentSubtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
    const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

    if (selectedPromotion.min_order_amount > 0 && currentSubtotal < selectedPromotion.min_order_amount) {
      setPromotionDiscount(0);
      return;
    }
    if (selectedPromotion.min_quantity > 0 && totalQty < selectedPromotion.min_quantity) {
      setPromotionDiscount(0);
      return;
    }

    if (selectedPromotion.promo_type === 'discount_amount') {
      setPromotionDiscount(Math.min(currentSubtotal, selectedPromotion.discount_value));
    } else if (selectedPromotion.promo_type === 'discount_percent') {
      setPromotionDiscount((currentSubtotal * selectedPromotion.discount_value) / 100);
    } else {
      setPromotionDiscount(0);
    }
  }, [selectedPromotion, cartItems]);

  // Memoized Cart Handlers
  const handleAddToCart = useCallback((newItem: CartItem) => {
    setCartItems((prev) => [...prev, newItem]);
    setOrderSuccessMessage(
      t('pos.added_to_cart', { name: `${newItem.product.name} (${newItem.selectedVariant.variant_name})` })
    );
    setTimeout(() => setOrderSuccessMessage(null), 3000);
  }, [t]);

  const handleUpdateQty = useCallback((id: string, delta: number) => {
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
  }, []);

  const handleUpdateUnitPrice = useCallback((id: string, newUnitPrice: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            unitPrice: newUnitPrice,
            lineTotal: newUnitPrice * item.quantity,
          };
        }
        return item;
      })
    );
  }, []);

  const handleRemoveItem = useCallback((id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleSelectProductForVariant = useCallback((product: Product) => {
    setSelectedProductForVariant(product);
  }, []);

  const handleSelectCategory = useCallback((id: number | null) => {
    setActiveCategoryId(id);
  }, []);

  // Order Submission Logic
  const submitOrder = async (targetFundId: number) => {
    if (cartItems.length === 0) return;

    const fundIdNum = Number(targetFundId);
    if (!fundIdNum || isNaN(fundIdNum)) {
      alert(t('pos.order_failed', { message: 'Invalid payment fund selected' }));
      return;
    }

    const currentSubtotal = cartItems.reduce((acc, item) => acc + item.lineTotal, 0);
    const currentTotal = Math.max(
      0,
      currentSubtotal - discountAmount - promotionDiscount - platformFeeDiscount + shippingFee + surcharge
    );
    const orderCartSnapshot = [...cartItems];

    const payload = {
      fund_id: fundIdNum,
      subtotal: currentSubtotal,
      discount_amount: discountAmount,
      promotion_id: selectedPromotion ? selectedPromotion.id : null,
      promotion_discount: promotionDiscount,
      shipping_fee: shippingFee,
      platform_fee_discount: platformFeeDiscount,
      surcharge: surcharge,
      total_amount: currentTotal,
      note: orderNote,
      items: cartItems.map((item) => ({
        product_variant_id: item.selectedVariant.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        selected_toppings: item.selectedToppings || [],
        toppings_price: item.toppingsPrice || 0,
        notes: item.notes || '',
      })),
    };

    const res = await fetchApi<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 'success' && res.data) {
      setCartItems([]);
      setOrderNote('');
      setDiscountAmount(0);
      setSelectedPromotion(null);
      setPromotionDiscount(0);
      setShippingFee(0);
      setPlatformFeeDiscount(0);
      setSurcharge(0);
      setIsCheckoutModalOpen(false);
      setIsVietQRModalOpen(false);
      setIsCartDrawerOpen(false);

      const orderData: CompletedOrderData = {
        order_code: res.data.order_code,
        created_at: res.data.created_at || new Date().toISOString(),
        items: orderCartSnapshot,
        subtotal: currentSubtotal,
        discount: discountAmount,
        promotion_discount: promotionDiscount,
        platform_fee_discount: platformFeeDiscount,
        shipping_fee: shippingFee,
        surcharge: surcharge,
        total: currentTotal,
        payment_method: res.data.fund?.name || (fundIdNum === 1 ? 'Tiền mặt' : 'Chuyển khoản'),
        cashier_name: res.data.cashier_name || 'Thu ngân',
        note: orderNote,
      };

      setCompletedOrder(orderData);
      setIsReceiptModalOpen(true);
      setOrderSuccessMessage(t('pos.order_success', { code: res.data.order_code }));
      setTimeout(() => setOrderSuccessMessage(null), 5000);
    } else {
      alert(t('pos.order_failed', { message: res.message }));
    }
  };

  const handleInitiatePayment = (fundId: number) => {
    setSelectedFundId(fundId);
    if (fundId === 2) {
      setIsCheckoutModalOpen(false);
      setIsVietQRModalOpen(true);
    } else {
      submitOrder(fundId);
    }
  };

  // Safe Fallback for Arrays
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeCartItems = useMemo(() => (Array.isArray(cartItems) ? cartItems : []), [cartItems]);

  // Memoized Filtered Products
  const filteredProducts = useMemo(() => {
    return safeProducts.filter((p) => {
      // 1. Inactive products are completely hidden from POS
      if (p.is_active === false) return false;

      // 2. Category filter
      const matchesCategory = activeCategoryId === null || p.category_id === activeCategoryId;

      // 3. Tag filter
      const matchesTag = activeTag === null || p.tag === activeTag;

      // 4. Search filter
      const matchesSearch =
        debouncedSearch.trim() === '' ||
        p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(debouncedSearch.toLowerCase()));

      return matchesCategory && matchesTag && matchesSearch;
    });
  }, [safeProducts, activeCategoryId, activeTag, debouncedSearch]);

  const cartSubtotal = useMemo(
    () => safeCartItems.reduce((acc, item) => acc + item.lineTotal, 0),
    [safeCartItems]
  );
  const cartTotal = useMemo(
    () =>
      Math.max(
        0,
        cartSubtotal - discountAmount - promotionDiscount - platformFeeDiscount + shippingFee + surcharge
      ),
    [cartSubtotal, discountAmount, promotionDiscount, platformFeeDiscount, shippingFee, surcharge]
  );
  const totalItemCount = useMemo(
    () => safeCartItems.reduce((acc, item) => acc + item.quantity, 0),
    [safeCartItems]
  );

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
          <CategoryTabs
            categories={safeCategories}
            activeCategoryId={activeCategoryId}
            totalProductsCount={safeProducts.filter((p) => p.is_active !== false).length}
            onSelectCategory={handleSelectCategory}
            allLabel={t('pos.all_items')}
          />

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

        {/* Quick Tag Highlights Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
              activeTag === null
                ? 'bg-slate-800 text-white shadow-2xs font-semibold'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {t('common.all')} ({safeProducts.filter((p) => p.is_active !== false && (activeCategoryId === null || p.category_id === activeCategoryId)).length})
          </button>
          <button
            onClick={() => setActiveTag(activeTag === 'featured' ? null : 'featured')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
              activeTag === 'featured'
                ? 'bg-amber-500 text-white shadow-2xs font-semibold'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            ⭐ {t('products.featured') || 'Nổi bật'}
          </button>
          <button
            onClick={() => setActiveTag(activeTag === 'best_seller' ? null : 'best_seller')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
              activeTag === 'best_seller'
                ? 'bg-rose-500 text-white shadow-2xs font-semibold'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            🔥 {t('products.best_seller') || 'Bán chạy'}
          </button>
          <button
            onClick={() => setActiveTag(activeTag === 'new' ? null : 'new')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
              activeTag === 'new'
                ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            ✨ {t('products.new') || 'Món mới'}
          </button>
          <button
            onClick={() => setActiveTag(activeTag === 'coming_soon' ? null : 'coming_soon')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
              activeTag === 'coming_soon'
                ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            ⏳ {t('products.coming_soon') || 'Sắp ra mắt'}
          </button>
          <button
            onClick={() => setActiveTag(activeTag === 'suspended' ? null : 'suspended')}
            className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${
              activeTag === 'suspended'
                ? 'bg-slate-700 text-white shadow-2xs font-semibold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            ⛔ {t('products.suspended') || 'Tạm ngưng'}
          </button>
        </div>

        {/* Product Card Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-2">
                <div className="w-full h-28 bg-slate-200 rounded-xl" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
            {t('pos.no_drinks')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                settings={settings}
                onSelect={handleSelectProductForVariant}
                orderBtnLabel={t('pos.order_button')}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Mobile & Bottom Sticky Cart Bar */}
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
              <p className="text-[11px] text-slate-400 font-medium">
                {t('pos.cart_total')} ({t('pos.items_count', { count: totalItemCount })})
              </p>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">{formatCurrency(cartTotal, settings)}</p>
                {discountAmount + promotionDiscount + platformFeeDiscount > 0 && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded">
                    -{formatCurrency(discountAmount + promotionDiscount + platformFeeDiscount, settings)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              disabled={cartItems.length === 0}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
            >
              {t('pos.view_cart')}
            </button>
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={cartItems.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition"
            >
              {t('pos.checkout_now')}
            </button>
          </div>
        </div>

        {/* Modal Components */}
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
          cartItems={safeCartItems}
          onUpdateQty={handleUpdateQty}
          onUpdateUnitPrice={handleUpdateUnitPrice}
          onRemoveItem={handleRemoveItem}
          discountAmount={discountAmount}
          onDiscountChange={setDiscountAmount}
          selectedPromotion={selectedPromotion}
          onSelectPromotion={setSelectedPromotion}
          promotionDiscount={promotionDiscount}
          shippingFee={shippingFee}
          onShippingFeeChange={setShippingFee}
          platformFeeDiscount={platformFeeDiscount}
          onPlatformFeeDiscountChange={setPlatformFeeDiscount}
          surcharge={surcharge}
          onSurchargeChange={setSurcharge}
          orderNote={orderNote}
          onOrderNoteChange={setOrderNote}
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
            onConfirmCashPayment={(fundId) => submitOrder(fundId)}
            onSelectBankTransfer={(fundId) => {
              setSelectedFundId(fundId);
              setIsCheckoutModalOpen(false);
              setIsVietQRModalOpen(true);
            }}
            settings={settings}
          />
        )}

        {isVietQRModalOpen && (
          <VietQRModal
            totalAmount={cartTotal}
            onClose={() => setIsVietQRModalOpen(false)}
            onConfirmOrder={() => submitOrder(selectedFundId || 2)}
            settings={settings}
          />
        )}

        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setCompletedOrder(null);
          }}
          order={completedOrder}
          settings={settings}
        />
      </div>
    </AppShell>
  );
}
