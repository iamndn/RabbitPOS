'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ShoppingBag, Coffee, RefreshCw, CheckCircle2, AlertCircle, Plus, Search, Check, Tag, X, Sparkles, SlidersHorizontal, Filter } from 'lucide-react';
import AppShell from '@/components/AppShell';
import type { CartItem, Product } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import type { CompletedOrderData } from '@/components/pos/ReceiptModal';
import { Promotion } from '@/types/promotion';
import { fetchApi, ApiResponse, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { CustomTag, DEFAULT_SYSTEM_TAGS, getTagBadgeStyle } from '@/components/products/TagManagerModal';

// Dynamic lazy-loaded modals for reduced bundle size and instant page responsiveness
const VariantSelectorModal = dynamic(() => import('@/components/pos/VariantSelectorModal'), { ssr: false });
const CheckoutModal = dynamic(() => import('@/components/pos/CheckoutModal'), { ssr: false });
const VietQRModal = dynamic(() => import('@/components/pos/VietQRModal'), { ssr: false });
const ReceiptModal = dynamic(() => import('@/components/pos/ReceiptModal'), { ssr: false });

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
  products: Product[];
  onSelectCategory: (id: number | null) => void;
  allLabel: string;
}

const CategoryTabs = React.memo(function CategoryTabs({
  categories,
  activeCategoryId,
  totalProductsCount,
  products,
  onSelectCategory,
  allLabel,
}: CategoryTabsProps) {
  return (
    <div className="flex overflow-x-auto space-x-2 pb-1 w-full sm:w-auto scrollbar-none no-scrollbar py-1">
      <button
        onClick={() => onSelectCategory(null)}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-xs transition active:scale-95 hardware-accelerated flex items-center gap-1.5 cursor-pointer ${
          activeCategoryId === null
            ? 'bg-emerald-800 text-white shadow-sm font-black ring-2 ring-emerald-600/30'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
        }`}
      >
        <span>{allLabel}</span>
        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
          activeCategoryId === null ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
        }`}>
          {totalProductsCount}
        </span>
      </button>
      {categories.map((cat) => {
        const catCount = products.filter((p) => p.is_active !== false && p.category_id === cat.id).length;
        const isSelected = activeCategoryId === cat.id;
        const catImg = getImageUrl(cat.image_url);
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-xs transition active:scale-95 hardware-accelerated flex items-center gap-1.5 cursor-pointer ${
              isSelected
                ? 'bg-emerald-800 text-white shadow-sm font-black ring-2 ring-emerald-600/30'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
            }`}
          >
            {catImg && (
              <img src={catImg} alt="" className="w-3.5 h-3.5 rounded object-cover shrink-0" />
            )}
            <span>{cat.name}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {catCount}
            </span>
          </button>
        );
      })}
    </div>
  );
});

// ── MEMOIZED PRODUCT CARD ────────────────────────────────────────────────────
interface ProductCardProps {
  product: Product;
  settings: SettingsMap | null;
  customTags: CustomTag[];
  onSelect: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  orderBtnLabel: string;
  t: (key: string, params?: any) => string;
}

const ProductCard = React.memo(function ProductCard({
  product,
  settings,
  customTags,
  onSelect,
  onQuickAdd,
  orderBtnLabel,
  t,
}: ProductCardProps) {
  const { showAlert } = useConfirm();
  const startingPrice = useMemo(() => {
    return Array.isArray(product.variants) && product.variants.length > 0
      ? Math.min(...product.variants.map((v) => v.retail_price))
      : 0;
  }, [product.variants]);

  const imageUrl = useMemo(() => getImageUrl(product.image_url), [product.image_url]);

  const isSuspended = product.tag === 'suspended';
  const isComingSoon = product.tag === 'coming_soon';
  const variantsCount = product.variants?.length || 0;
  const isSingleVariant = variantsCount === 1;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSuspended) {
      showAlert(t('common.info') || 'Thông báo', `${product.name} hiện đang tạm ngưng phục vụ.`, 'warning');
      return;
    }
    if (isComingSoon) {
      showAlert(t('common.info') || 'Thông báo', `${product.name} sắp ra mắt, quý khách vui lòng chờ nhé!`, 'info');
      return;
    }
    if (isSingleVariant) {
      onQuickAdd(product);
    } else {
      onSelect(product);
    }
  };

  const handleOpenCustomize = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSuspended || isComingSoon) return;
    onSelect(product);
  };

  const tagStyle = useMemo(() => {
    if (!product.tag || product.tag === 'none') return null;
    return getTagBadgeStyle(product.tag, customTags);
  }, [product.tag, customTags]);

  return (
    <div
      onClick={handleClick}
      className={`bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all active:scale-[0.98] flex flex-col justify-between cursor-pointer group hardware-accelerated min-w-0 w-full relative select-none ${
        isSuspended ? 'opacity-70 bg-slate-50/70' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="w-full aspect-square bg-slate-100 rounded-xl mb-1.5 flex items-center justify-center text-slate-400 overflow-hidden relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
            />
          ) : (
            <Coffee className="w-7 h-7 sm:w-8 sm:h-8 opacity-40 text-slate-400" />
          )}

          {/* Size / Variant Badge */}
          {variantsCount > 1 && (
            <span className="absolute bottom-1 right-1 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
              {variantsCount} size
            </span>
          )}
        </div>

        {/* Tag Badge */}
        {tagStyle && (
          <div className="mb-1">
            <span className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-0.5 max-w-full truncate ${tagStyle.badgeClasses}`}>
              <span>{tagStyle.icon}</span>
              <span className="truncate">{tagStyle.name}</span>
            </span>
          </div>
        )}

        <h3 className="font-bold text-slate-900 text-xs leading-snug group-hover:text-emerald-700 transition line-clamp-2 break-words">
          {product.name}
        </h3>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 min-w-0">
        <span className="font-black text-emerald-700 text-xs truncate min-w-0">{formatCurrency(startingPrice, settings)}</span>
        {isSuspended ? (
          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-slate-200 shrink-0">
            ⛔ {t('products.suspended') || 'Tạm ngưng'}
          </span>
        ) : isComingSoon ? (
          <span className="bg-sky-50 text-sky-600 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-sky-200 shrink-0">
            ⏳ {t('products.coming_soon') || 'Sắp có'}
          </span>
        ) : isSingleVariant ? (
          <button
            type="button"
            onClick={handleClick}
            className="bg-emerald-50 group-hover:bg-emerald-700 group-hover:text-white text-emerald-700 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5 shrink-0 active:scale-95 shadow-2xs"
            title="Thêm nhanh vào giỏ"
          >
            <Plus className="w-3.5 h-3.5" /> {orderBtnLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenCustomize}
            className="bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-700 text-[10px] font-bold px-2 py-1 rounded-lg transition flex items-center gap-0.5 shrink-0 active:scale-95"
            title="Tùy chọn size & topping"
          >
            <SlidersHorizontal className="w-3 h-3" /> Chọn size
          </button>
        )}
      </div>
    </div>
  );
});

export default function PosPage() {
  const { t } = useTranslation();
  const { showAlert } = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
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
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);

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

  // Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

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
        let map: SettingsMap = {};
        if (Array.isArray(settingsRes.data)) {
          settingsRes.data.forEach((s: any) => {
            if (s && s.key) map[s.key] = s.value;
          });
        } else if (typeof settingsRes.data === 'object') {
          map = settingsRes.data as SettingsMap;
        }
        setSettings(map);

        if (map.custom_product_tags) {
          try {
            const parsed = JSON.parse(map.custom_product_tags);
            if (Array.isArray(parsed)) {
              setCustomTags(parsed);
            }
          } catch (e) {
            console.error('Failed to parse custom_product_tags', e);
          }
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

  const handleQuickAdd = useCallback(
    (product: Product) => {
      if (!product.variants || product.variants.length === 0) return;
      const variant = product.variants[0];
      const newItem: CartItem = {
        id: `${product.id}-${variant.id}-${Date.now()}`,
        product: product,
        selectedVariant: variant,
        sugarLevel: '100%',
        iceLevel: '100%',
        selectedToppings: [],
        toppingsPrice: 0,
        quantity: 1,
        unitPrice: variant.retail_price,
        lineTotal: variant.retail_price,
        notes: '',
      };
      handleAddToCart(newItem);
    },
    [handleAddToCart]
  );

  const handleSelectCategory = useCallback((id: number | null) => {
    setActiveCategoryId(id);
  }, []);

  // Order Submission Logic
  const submitOrder = async (targetFundId: number) => {
    if (cartItems.length === 0) return;

    const fundIdNum = Number(targetFundId);
    if (!fundIdNum || isNaN(fundIdNum)) {
      showAlert(t('common.error') || 'Lỗi', t('pos.order_failed', { message: 'Invalid payment fund selected' }), 'danger');
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
      created_at: orderCreatedAt || undefined,
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
      setOrderCreatedAt(null);
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
      showAlert(t('common.error') || 'Lỗi', t('pos.order_failed', { message: res.message }), 'danger');
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

  const allAvailableTags = useMemo(() => {
    return [...DEFAULT_SYSTEM_TAGS, ...customTags];
  }, [customTags]);

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
      <div className="space-y-3 sm:space-y-4 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden">
        {/* Success Toast Banner */}
        {orderSuccessMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm flex items-center justify-between animate-in fade-in duration-150">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {orderSuccessMessage}
            </span>
          </div>
        )}

        {/* POS Search Bar & Filter Button */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('pos.search_placeholder') || 'Tìm món nhanh theo tên, mô tả...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-input pl-9 pr-24 py-2 text-xs placeholder:text-xs"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md pointer-events-none">
                {filteredProducts.length} món
              </span>
            )}
          </div>

          {/* Button Mở Popup Filter ngay bên phải ô tìm kiếm */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
              activeCategoryId !== null || activeTag !== null
                ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30 font-extrabold'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Bộ lọc</span>
            {(activeCategoryId !== null || activeTag !== null) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Active Filter Chips (if any filter is selected) */}
        {(activeCategoryId !== null || activeTag !== null) && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-slate-400 font-semibold text-[11px]">Đang lọc:</span>
            {activeCategoryId !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold">
                <span>Danh mục: {safeCategories.find((c) => c.id === activeCategoryId)?.name || 'Đã chọn'}</span>
                <button type="button" onClick={() => setActiveCategoryId(null)} className="hover:text-emerald-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeTag !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold">
                <span>Nhãn: {allAvailableTags.find((t) => t.id === activeTag)?.name || activeTag}</span>
                <button type="button" onClick={() => setActiveTag(null)} className="hover:text-indigo-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setActiveCategoryId(null);
                setActiveTag(null);
              }}
              className="text-rose-600 hover:text-rose-700 font-bold text-[11px] ml-1 underline cursor-pointer"
            >
              Xóa tất cả
            </button>
          </div>
        )}

        {/* Popup Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Bộ Lọc Thực Đơn POS</h3>
                    <p className="text-xs text-slate-400">Chọn danh mục và nhãn để lọc món nhanh</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Section 1: Danh Mục (Wrap) */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    📂 Danh Mục Món ({safeCategories.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveCategoryId(null)}
                      className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        activeCategoryId === null
                          ? 'bg-emerald-800 text-white shadow-sm font-black ring-2 ring-emerald-600/30'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>{t('pos.all_items')}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeCategoryId === null ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {safeProducts.filter((p) => p.is_active !== false).length}
                      </span>
                    </button>
                    {safeCategories.map((cat) => {
                      const count = safeProducts.filter((p) => p.is_active !== false && p.category_id === cat.id).length;
                      const isSelected = activeCategoryId === cat.id;
                      const catImg = getImageUrl(cat.image_url);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveCategoryId(isSelected ? null : cat.id)}
                          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? 'bg-emerald-800 text-white shadow-sm font-black ring-2 ring-emerald-600/30'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {catImg && <img src={catImg} alt="" className="w-3.5 h-3.5 rounded object-cover shrink-0" />}
                          <span>{cat.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider Ngăn Cách */}
                <hr className="border-slate-100" />

                {/* Section 2: Nhãn Sản Phẩm (Wrap) */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    🏷️ Nhãn Sản Phẩm ({allAvailableTags.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTag(null)}
                      className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        activeTag === null
                          ? 'bg-slate-900 text-white font-extrabold shadow-sm ring-1 ring-slate-700'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>{t('common.all')}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeTag === null ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {safeProducts.filter((p) => p.is_active !== false && (activeCategoryId === null || p.category_id === activeCategoryId)).length}
                      </span>
                    </button>
                    {allAvailableTags.map((tg) => {
                      const count = safeProducts.filter(
                        (p) => p.is_active !== false && p.tag === tg.id && (activeCategoryId === null || p.category_id === activeCategoryId)
                      ).length;
                      const isSelected = activeTag === tg.id;
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={() => setActiveTag(isSelected ? null : tg.id)}
                          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? 'bg-emerald-700 text-white font-extrabold shadow-sm ring-2 ring-emerald-500/30'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span>{tg.icon}</span>
                          <span>{tg.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(null);
                    setActiveTag(null);
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer px-3 py-2"
                >
                  Đặt lại bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  Áp dụng ({filteredProducts.length} món)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Card Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-2">
                <div className="w-full h-24 sm:h-28 bg-slate-200 rounded-xl" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs shadow-2xs">
            <Coffee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600">{t('pos.no_drinks')}</p>
            <p className="text-[11px] text-slate-400 mt-1">Thử chọn danh mục khác hoặc xóa bộ lọc tìm kiếm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5 pb-36 md:pb-24">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                settings={settings}
                customTags={customTags}
                onSelect={handleSelectProductForVariant}
                onQuickAdd={handleQuickAdd}
                orderBtnLabel={t('pos.order_button')}
                t={t}
              />
            ))}
          </div>
        )}

        {/* Mobile & Bottom Sticky Quick Cart Bar */}
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-2.5 right-2.5 sm:left-4 sm:right-4 max-w-7xl mx-auto z-30 bg-slate-900/95 backdrop-blur-md text-white p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between hardware-accelerated">
          <div
            onClick={() => setIsCartDrawerOpen(true)}
            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group active:scale-95 transition-transform min-w-0 flex-1 mr-2"
          >
            <div className="relative bg-emerald-700 p-2 sm:p-2.5 rounded-xl text-white shadow-sm shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              {totalItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {totalItemCount}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                {t('pos.cart_total')} ({t('pos.items_count', { count: totalItemCount })})
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm sm:text-base font-bold text-white truncate">{formatCurrency(cartTotal, settings)}</p>
                {discountAmount + promotionDiscount + platformFeeDiscount > 0 && (
                  <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1 py-0.5 rounded truncate">
                    -{formatCurrency(discountAmount + promotionDiscount + platformFeeDiscount, settings)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              disabled={cartItems.length === 0}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-[11px] sm:text-xs font-bold px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border border-slate-700 transition active:scale-95 whitespace-nowrap"
            >
              {t('pos.view_cart')}
            </button>
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
              disabled={cartItems.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white text-[11px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg transition active:scale-95 whitespace-nowrap"
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
          orderCreatedAt={orderCreatedAt}
          onOrderCreatedAtChange={setOrderCreatedAt}
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
