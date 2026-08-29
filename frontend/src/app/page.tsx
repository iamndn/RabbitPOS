'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  ShoppingBag,
  Coffee,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Check,
  Tag,
  X,
  Sparkles,
  SlidersHorizontal,
  Filter,
  ArrowUpAZ,
  ArrowDownAZ,
  FolderTree,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import type { CartItem, Product } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import type { CompletedOrderData } from '@/components/pos/ReceiptModal';
import { Promotion } from '@/types/promotion';
import { fetchApi, ApiResponse, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { useToast } from '@/context/ToastContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  saveCatalogToOfflineCache,
  loadCatalogFromOfflineCache,
  saveCartToOfflineCache,
  loadCartFromOfflineCache,
  clearCartFromOfflineCache,
  getDeviceId,
  Category,
  Topping,
} from '@/lib/offline/catalog';
import {
  enqueueOfflineOrder,
  getOfflineQueueStats,
  OfflineQueueStats,
  OfflineOrder,
} from '@/lib/offline/orders';
import { syncOfflineOrders } from '@/lib/offline/sync';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { CustomTag, DEFAULT_SYSTEM_TAGS, getTagBadgeStyle } from '@/components/products/TagManagerModal';

// ── VIETNAMESE FUZZY SEARCH HELPER ──────────────────────────────────────────
/**
 * Chuẩn hoá chuỗi: bỏ dấu + lowercase + loại ký tự thừa.
 * Ví dụ: "Lưu Ý Khách" → "luu y khach"
 */
const normalizeVi = (str: string): string =>
  str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // xoá dấu tổ hợp (accents)
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

/**
 * Kiểm tra xem `text` có chứa tất cả các "token" (từng từ tách bởi khoảng trắng) của `query` không.
 * Hỗ trợ:
 *   - Không dấu: "luu" → tìm "Lưu"
 *   - Từng phần: "lu y" → tìm "Lưu Ý Khách"
 *   - Substring: "pho" → tìm "Phở bò"
 */
const fuzzyMatchVi = (text: string, query: string): boolean => {
  const normText = normalizeVi(text);
  const tokens = normalizeVi(query).split(/\s+/).filter(Boolean);
  return tokens.every((token) => normText.includes(token));
};

// Dynamic lazy-loaded modals for reduced bundle size and instant page responsiveness
const VariantSelectorModal = dynamic(() => import('@/components/pos/VariantSelectorModal'), { ssr: false });
const CheckoutModal = dynamic(() => import('@/components/pos/CheckoutModal'), { ssr: false });
const VietQRModal = dynamic(() => import('@/components/pos/VietQRModal'), { ssr: false });
const ReceiptModal = dynamic(() => import('@/components/pos/ReceiptModal'), { ssr: false });
const OfflineQueueModal = dynamic(() => import('@/components/pos/OfflineQueueModal'), { ssr: false });



export type ProductSortOption = 'default' | 'name-asc' | 'name-desc' | 'category' | 'tag' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { id: ProductSortOption; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'default', label: 'Mặc định', icon: <RefreshCw className="w-3.5 h-3.5 text-slate-500" />, desc: 'Thứ tự ban đầu' },
  { id: 'name-asc', label: 'Tên: A → Z', icon: <ArrowUpAZ className="w-3.5 h-3.5 text-indigo-500" />, desc: 'Bảng chữ cái từ A đến Z' },
  { id: 'name-desc', label: 'Tên: Z → A', icon: <ArrowDownAZ className="w-3.5 h-3.5 text-indigo-500" />, desc: 'Bảng chữ cái từ Z đến A' },
  { id: 'category', label: 'Theo Danh mục', icon: <FolderTree className="w-3.5 h-3.5 text-emerald-500" />, desc: 'Nhóm theo danh mục món' },
  { id: 'tag', label: 'Theo Nhãn', icon: <Tag className="w-3.5 h-3.5 text-amber-500" />, desc: 'Nhóm theo nhãn sản phẩm' },
  { id: 'price-asc', label: 'Giá: Thấp → Cao', icon: <TrendingUp className="w-3.5 h-3.5 text-teal-500" />, desc: 'Từ giá rẻ nhất' },
  { id: 'price-desc', label: 'Giá: Cao → Thấp', icon: <TrendingDown className="w-3.5 h-3.5 text-rose-500" />, desc: 'Từ giá cao nhất' },
];

// ── MEMOIZED CATEGORY SIDEBAR (vertical sticky column) ───────────────────────
interface CategorySidebarProps {
  categories: Category[];
  activeCategoryId: number | null;
  totalProductsCount: number;
  products: Product[];
  onSelectCategory: (id: number | null) => void;
  allLabel: string;
}

const CategorySidebar = React.memo(function CategorySidebar({
  categories,
  activeCategoryId,
  totalProductsCount,
  products,
  onSelectCategory,
  allLabel,
}: CategorySidebarProps) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5 sm:pr-1 scrollbar-none no-scrollbar">
      {/* Tất cả */}
      <button
        onClick={() => onSelectCategory(null)}
        className={`w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold text-left flex items-center justify-between gap-1.5 transition active:scale-[0.97] cursor-pointer ${
          activeCategoryId === null
            ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/30'
            : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
        }`}
      >
        <span className="truncate leading-snug">{allLabel}</span>
        <span className={`shrink-0 text-[9px] sm:text-[10px] min-w-[1.2rem] sm:min-w-[1.3rem] text-center px-1 py-0.5 rounded-full font-bold ${
          activeCategoryId === null ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}>
          {totalProductsCount}
        </span>
      </button>

      {/* Divider */}
      {categories.length > 0 && <div className="border-t border-slate-100 my-0.5" />}

      {categories.map((cat) => {
        const catCount = products.filter((p) => p.is_active !== false && p.category_id === cat.id).length;
        const isSelected = activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold text-left flex items-center justify-between gap-1.5 transition active:scale-[0.97] cursor-pointer ${
              isSelected
                ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/30'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80'
            }`}
          >
            <span className="flex-1 truncate leading-snug">{cat.name}</span>
            <span className={`shrink-0 text-[9px] sm:text-[10px] min-w-[1.2rem] sm:min-w-[1.3rem] text-center px-1 py-0.5 rounded-full font-bold ${
              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
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
}

const ProductCard = React.memo(function ProductCard({
  product,
  settings,
  customTags,
  onSelect,
  onQuickAdd,
  orderBtnLabel,
}: ProductCardProps) {
  const { t } = useTranslation();
  const toast = useToast();
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
      toast.warning(`${product.name} hiện đang tạm ngưng phục vụ.`);
      return;
    }
    if (isComingSoon) {
      toast.info(`${product.name} sắp ra mắt, quý khách vui lòng chờ nhé!`);
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

      {/* Bottom section: Price and Action Button in clean vertical hierarchy */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1.5 min-w-0">
        {/* Dedicated Price Row (Full Width - Always 100% visible) */}
        <div className="flex items-baseline gap-1 min-w-0">
          {variantsCount > 1 && (
            <span className="text-[10px] text-slate-400 font-semibold shrink-0">
              {t('pos.from_price') || 'Từ'}
            </span>
          )}
          <span
            className="font-black text-emerald-700 text-xs sm:text-sm tracking-tight truncate leading-tight"
            title={formatCurrency(startingPrice, settings)}
          >
            {formatCurrency(startingPrice, settings)}
          </span>
        </div>

        {/* Action Button Row (Full Width - Easy Touch Target) */}
        {isSuspended ? (
          <div className="w-full py-1.5 text-center bg-slate-100 text-slate-500 text-[10px] sm:text-[11px] font-bold rounded-xl border border-slate-200">
            ⛔ {t('products.suspended') || 'Tạm ngưng'}
          </div>
        ) : isComingSoon ? (
          <div className="w-full py-1.5 text-center bg-sky-50 text-sky-600 text-[10px] sm:text-[11px] font-bold rounded-xl border border-sky-200">
            ⏳ {t('products.coming_soon') || 'Sắp có'}
          </div>
        ) : isSingleVariant ? (
          <button
            type="button"
            onClick={handleClick}
            className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
            title={orderBtnLabel || t('pos.order_button') || 'Gọi món'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{orderBtnLabel || t('pos.order_button') || 'Gọi món'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenCustomize}
            className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-600 hover:text-white group-hover:bg-emerald-600 group-hover:text-white text-emerald-700 text-[11px] sm:text-xs font-bold rounded-xl border border-emerald-200/80 transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
            title={t('pos.select_size') || 'Chọn size'}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>{t('pos.select_size') || 'Chọn size'}</span>
          </button>
        )}
      </div>
    </div>
  );
});

export default function PosPage() {
  const { t } = useTranslation();
  const { showAlert } = useConfirm();
  const toast = useToast();
  const network = useNetworkStatus();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProductSortOption>('default');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isOfflineData, setIsOfflineData] = useState<boolean>(false);

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

  // Receipt Modal State
  const [completedOrder, setCompletedOrder] = useState<CompletedOrderData | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Offline Queue Modal State
  const [isQueueModalOpen, setIsQueueModalOpen] = useState<boolean>(false);
  const [queueStats, setQueueStats] = useState<OfflineQueueStats>({
    total: 0,
    pending: 0,
    syncing: 0,
    requiresReview: 0,
    synced: 0,
    failed: 0,
  });

  const refreshQueueStats = useCallback(async () => {
    try {
      const s = await getOfflineQueueStats();
      setQueueStats(s);
    } catch (e) {
      // Ignore IDB errors
    }
  }, []);

  useEffect(() => {
    refreshQueueStats();
  }, [refreshQueueStats]);

  useEffect(() => {
    if (network.isOnline && network.wasOffline) {
      syncOfflineOrders({
        onSuccessToast: (cnt) => {
          toast.syncSuccess(cnt);
          refreshQueueStats();
        },
        onConflictToast: (code, reason) => {
          toast.syncConflict(code, reason);
          refreshQueueStats();
        },
      }).then(() => refreshQueueStats());
    }
  }, [network.isOnline, network.wasOffline, refreshQueueStats, toast]);

  // Filter Modal State
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // 250ms Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Parallelized initial data loading with in-memory caching, IndexedDB caching and automatic retry
  const loadData = useCallback(async (retryCount = 0) => {
    setLoading(true);

    // If browser is offline, directly load from IndexedDB
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        const cached = await loadCatalogFromOfflineCache();
        if (cached) {
          setProducts(cached.products);
          setCategories(cached.categories);
          setSettings(cached.settings);
          if (cached.customTags) setCustomTags(cached.customTags);
          setLastSyncedAt(cached.lastSyncedAt);
          setIsOfflineData(true);
        }
      } catch (err) {
        console.error('Failed to load catalog from IndexedDB:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const [settingsRes, catRes, prodRes] = await Promise.all([
        fetchApi<any>('/settings/store'),
        fetchApi<Category[]>('/categories'),
        fetchApi<Product[]>('/products'),
      ]);

      let map: SettingsMap = {};
      let parsedTags: CustomTag[] = [];
      if (settingsRes.status === 'success' && settingsRes.data) {
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
              parsedTags = parsed;
              setCustomTags(parsed);
            }
          } catch (e) {
            console.error('Failed to parse custom_product_tags', e);
          }
        }
      }

      let catList: Category[] = [];
      if (catRes.status === 'success') {
        catList = Array.isArray(catRes.data)
          ? catRes.data
          : Array.isArray(catRes)
          ? (catRes as Category[])
          : [];
        setCategories(catList);
      }

      let prodList: Product[] = [];
      if (prodRes.status === 'success') {
        prodList = Array.isArray(prodRes.data)
          ? prodRes.data
          : Array.isArray(prodRes)
          ? (prodRes as Product[])
          : [];
        setProducts(prodList);
      }

      // If online fetch succeeded, atomically persist into IndexedDB cache
      if (prodList.length > 0 || catList.length > 0) {
        const syncedTime = await saveCatalogToOfflineCache({
          products: prodList,
          categories: catList,
          settings: map,
          customTags: parsedTags,
        });
        setLastSyncedAt(syncedTime);
        setIsOfflineData(false);
      } else if (retryCount < 2) {
        setTimeout(() => loadData(retryCount + 1), 800);
        return;
      }
    } catch (err) {
      console.error('Network error loading POS catalog, attempting IndexedDB fallback:', err);
      try {
        const cached = await loadCatalogFromOfflineCache();
        if (cached) {
          setProducts(cached.products);
          setCategories(cached.categories);
          setSettings(cached.settings);
          if (cached.customTags) setCustomTags(cached.customTags);
          setLastSyncedAt(cached.lastSyncedAt);
          setIsOfflineData(true);
        } else if (retryCount < 2) {
          setTimeout(() => loadData(retryCount + 1), 800);
          return;
        }
      } catch (idbErr) {
        console.error('IndexedDB fallback also failed:', idbErr);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 1. Restore Draft Cart Items from IndexedDB (with LocalStorage fallback)
    const restoreCart = async () => {
      try {
        const cachedCart = await loadCartFromOfflineCache();
        if (cachedCart && Array.isArray(cachedCart.items) && cachedCart.items.length > 0) {
          setCartItems(cachedCart.items);
          if (cachedCart.orderNote) setOrderNote(cachedCart.orderNote);
          if (cachedCart.discountAmount) setDiscountAmount(cachedCart.discountAmount);
          if (cachedCart.selectedPromotion) setSelectedPromotion(cachedCart.selectedPromotion);
          if (cachedCart.shippingFee) setShippingFee(cachedCart.shippingFee);
          if (cachedCart.surcharge) setSurcharge(cachedCart.surcharge);
          return;
        }

        const savedCart = localStorage.getItem('rabbitpos_active_cart');
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (parsed.cartItems && Array.isArray(parsed.cartItems) && parsed.cartItems.length > 0) {
            setCartItems(parsed.cartItems);
          } else {
            localStorage.removeItem('rabbitpos_active_cart');
          }
        }
      } catch (e) {
        console.error('Failed to restore active cart', e);
      }
    };

    restoreCart();
  }, [loadData]);

  // 2. Persist Active Cart to IndexedDB & LocalStorage (Only draft items; auto-reset fees & discounts when empty)
  useEffect(() => {
    try {
      if (cartItems.length > 0) {
        saveCartToOfflineCache({
          items: cartItems,
          orderNote,
          discountAmount,
          selectedPromotion,
          promotionDiscount,
          shippingFee,
          platformFeeDiscount,
          surcharge,
        }).catch((e) => console.warn('Failed to cache cart in IndexedDB:', e));

        localStorage.setItem(
          'rabbitpos_active_cart',
          JSON.stringify({
            cartItems,
          })
        );
      } else {
        clearCartFromOfflineCache().catch(() => {});
        localStorage.removeItem('rabbitpos_active_cart');
        // Reset all adjustments, fees, and discounts for each fresh order
        setDiscountAmount(0);
        setSelectedPromotion(null);
        setPromotionDiscount(0);
        setShippingFee(0);
        setPlatformFeeDiscount(0);
        setSurcharge(0);
        setOrderNote('');
        setOrderCreatedAt(null);
      }
    } catch (e) {
      console.error('Failed to save cart', e);
    }
  }, [
    cartItems,
    orderNote,
    discountAmount,
    selectedPromotion,
    promotionDiscount,
    shippingFee,
    platformFeeDiscount,
    surcharge,
  ]);

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
    toast.success(
      t('pos.added_to_cart', { name: `${newItem.product.name} (${newItem.selectedVariant.variant_name})` }),
      { duration: 2500 }
    );
  }, [t, toast]);

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

  // Order Submission Logic (Server-Authoritative Pricing, Idempotency & Offline Queue)
  const submitOrder = async (targetFundId: number) => {
    if (cartItems.length === 0) return;

    const fundIdNum = Number(targetFundId);
    if (!fundIdNum || isNaN(fundIdNum)) {
      showAlert(t('common.error') || 'Lỗi', t('pos.order_failed', { message: 'Invalid payment fund selected' }), 'danger');
      return;
    }

    const orderCartSnapshot = [...cartItems];

    // ── Offline Mode Order Processing (Cash Only) ──
    if (!network.isOnline) {
      if (fundIdNum !== 1) {
        toast.warning(
          'Không thể xác nhận chuyển khoản ngân hàng / VietQR khi đang ngoại tuyến. Vui lòng chọn thanh toán Tiền mặt.',
          { title: 'Chỉ chấp nhận Tiền mặt' }
        );
        return;
      }

      const offlineOrderId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const deviceId = await getDeviceId();
      const provisionalCode = 'OFF-' + offlineOrderId.replace(/-/g, '').substring(0, 8).toUpperCase();

      const offlineOrder: OfflineOrder = {
        offline_order_id: offlineOrderId,
        idempotency_key: idempotencyKey,
        device_id: deviceId,
        catalog_version: lastSyncedAt || Date.now(),
        created_at_device: new Date().toISOString(),
        queued_at: Date.now(),
        payload: {
          idempotency_key: idempotencyKey,
          fund_id: fundIdNum,
          promotion_id: selectedPromotion ? selectedPromotion.id : undefined,
          note: orderNote || undefined,
          manual_discount: discountAmount > 0 ? discountAmount : undefined,
          shipping_fee: shippingFee > 0 ? shippingFee : undefined,
          surcharge: surcharge > 0 ? surcharge : undefined,
          created_at: orderCreatedAt || undefined,
          items: cartItems.map((item) => ({
            product_variant_id: item.selectedVariant.id,
            quantity: item.quantity,
            topping_ids: (item.selectedToppings || []).map((t) => t.id),
            notes: item.notes || '',
          })),
        },
        display_snapshot: {
          order_code: provisionalCode,
          items: orderCartSnapshot,
          subtotal: cartSubtotal,
          discount: discountAmount,
          promotion_discount: promotionDiscount,
          promotion_name: selectedPromotion?.name || undefined,
          shipping_fee: shippingFee,
          surcharge: surcharge,
          total: cartTotal,
          final_total: cartTotal,
          payment_method: 'Tiền mặt (Offline)',
          cashier_name: 'Thu ngân',
          note: orderNote || undefined,
          is_offline_provisional: true,
        },
        status: 'pending',
        retry_count: 0,
        last_error: null,
        error_code: null,
        server_order_id: null,
        server_order_code: null,
        synced_at: null,
      };

      await enqueueOfflineOrder(offlineOrder);

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

      setCompletedOrder(offlineOrder.display_snapshot);
      if (settings?.auto_show_receipt_after_checkout !== 'false') {
        setIsReceiptModalOpen(true);
      }
      clearCartFromOfflineCache().catch(() => {});
      localStorage.removeItem('rabbitpos_active_cart');
      refreshQueueStats();
      toast.queuedOrder(provisionalCode);
      return;
    }

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      idempotency_key: idempotencyKey,
      fund_id: fundIdNum,
      promotion_id: selectedPromotion ? selectedPromotion.id : undefined,
      note: orderNote || undefined,
      manual_discount: discountAmount > 0 ? discountAmount : undefined,
      shipping_fee: shippingFee > 0 ? shippingFee : undefined,
      surcharge: surcharge > 0 ? surcharge : undefined,
      created_at: orderCreatedAt || undefined,
      items: cartItems.map((item) => ({
        product_variant_id: item.selectedVariant.id,
        quantity: item.quantity,
        topping_ids: (item.selectedToppings || []).map((t) => t.id),
        notes: item.notes || '',
      })),
    };

    const res = await fetchApi<any>('/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 'success' && res.data) {
      const serverOrder = res.data;
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
        order_code: serverOrder.order_code,
        created_at: serverOrder.created_at || new Date().toISOString(),
        items: orderCartSnapshot,
        subtotal: serverOrder.subtotal,
        discount: serverOrder.discount_amount || serverOrder.manual_discount || 0,
        discount_amount: serverOrder.discount_amount || serverOrder.manual_discount || 0,
        promotion_discount: serverOrder.promotion_discount || 0,
        promotion_name: serverOrder.promotion?.name || undefined,
        platform_fee_discount: serverOrder.platform_fee_discount || 0,
        shipping_fee: serverOrder.shipping_fee || 0,
        surcharge: serverOrder.surcharge || 0,
        total: serverOrder.total_amount,
        final_total: serverOrder.total_amount,
        payment_method: serverOrder.fund?.name || (fundIdNum === 1 ? 'Tiền mặt' : 'Chuyển khoản'),
        cashier_name: serverOrder.cashier_name || serverOrder.created_by || 'Thu ngân',
        note: serverOrder.note || orderNote,
      };

      setCompletedOrder(orderData);
      if (settings?.auto_show_receipt_after_checkout !== 'false') {
        setIsReceiptModalOpen(true);
      }
      clearCartFromOfflineCache().catch(() => {});
      localStorage.removeItem('rabbitpos_active_cart');
      toast.success(t('pos.order_success', { code: res.data.order_code }));
    } else {
      toast.error(t('pos.order_failed', { message: res.message }));
    }
  };

  const handleInitiatePayment = (fundId: number) => {
    setSelectedFundId(fundId);
    if (fundId === 2) {
      if (!network.isOnline) {
        toast.warning(
          'Không thể xác nhận chuyển khoản ngân hàng / VietQR khi đang ngoại tuyến. Vui lòng chọn thanh toán Tiền mặt.',
          { title: 'Chỉ chấp nhận Tiền mặt' }
        );
        return;
      }
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
    return customTags && customTags.length > 0 ? customTags : DEFAULT_SYSTEM_TAGS;
  }, [customTags]);

  // Memoized Filtered & Sorted Products
  const sortedAndFilteredProducts = useMemo(() => {
    const list = safeProducts.filter((p) => {
      // 1. Inactive products are completely hidden from POS
      if (p.is_active === false) return false;

      // 2. Category filter
      const matchesCategory = activeCategoryId === null || p.category_id === activeCategoryId;

      // 3. Tag filter
      const matchesTag = activeTag === null || p.tag === activeTag;

      // 4. Search filter — fuzzy, accent-insensitive (hỗ trợ không dấu & viết tắt)
      const matchesSearch =
        debouncedSearch.trim() === '' ||
        fuzzyMatchVi(p.name, debouncedSearch) ||
        (p.description != null && fuzzyMatchVi(p.description, debouncedSearch));

      return matchesCategory && matchesTag && matchesSearch;
    });

    switch (sortBy) {
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
      case 'name-desc':
        return list.sort((a, b) => b.name.localeCompare(a.name, 'vi', { sensitivity: 'base' }));
      case 'category':
        return list.sort((a, b) => {
          const catA = safeCategories.find((c) => c.id === a.category_id)?.name || '';
          const catB = safeCategories.find((c) => c.id === b.category_id)?.name || '';
          const catComp = catA.localeCompare(catB, 'vi', { sensitivity: 'base' });
          if (catComp !== 0) return catComp;
          return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
        });
      case 'tag':
        return list.sort((a, b) => {
          const tagA = (a.tag || '').toString();
          const tagB = (b.tag || '').toString();
          const tagComp = tagA.localeCompare(tagB, 'vi', { sensitivity: 'base' });
          if (tagComp !== 0) return tagComp;
          return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
        });
      case 'price-asc':
        return list.sort((a, b) => {
          const minA = a.variants && a.variants.length > 0 ? Math.min(...a.variants.map((v) => v.retail_price || 0)) : 0;
          const minB = b.variants && b.variants.length > 0 ? Math.min(...b.variants.map((v) => v.retail_price || 0)) : 0;
          return minA - minB;
        });
      case 'price-desc':
        return list.sort((a, b) => {
          const maxA = a.variants && a.variants.length > 0 ? Math.max(...a.variants.map((v) => v.retail_price || 0)) : 0;
          const maxB = b.variants && b.variants.length > 0 ? Math.max(...b.variants.map((v) => v.retail_price || 0)) : 0;
          return maxB - maxA;
        });
      default:
        return list;
    }
  }, [safeProducts, activeCategoryId, activeTag, debouncedSearch, sortBy, safeCategories]);

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

  const orderBtnLabel = useMemo(() => t('pos.order_button') || 'Gọi món', [t]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:gap-4 w-full max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4k:max-w-[3200px] mx-auto overflow-x-hidden">
        {/* ── POS Search Bar (full-width, above 3-col panel) ── */}
        <div className="flex items-center gap-2 w-full">
          {/* Network Status Badge */}
          {network.isOnline ? (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {lastSyncedAt
                ? `Đồng bộ: ${new Date(lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Trực tuyến'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300/80 shadow-2xs shrink-0 animate-pulse">
              <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              Ngoại tuyến {lastSyncedAt && `(${new Date(lastSyncedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`}
            </span>
          )}

          {/* Offline Queue Badge Button */}
          {queueStats.total > 0 && (
            <button
              type="button"
              onClick={() => setIsQueueModalOpen(true)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
                queueStats.requiresReview > 0
                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                  : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
              title="Xem danh sách đơn hàng ngoại tuyến"
            >
              <span>⚡ Hàng đợi</span>
              <span className="bg-amber-200 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {queueStats.pending + queueStats.requiresReview}
              </span>
            </button>
          )}

          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('pos.search_placeholder') || 'Tìm món nhanh theo tên, mô tả...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-input pl-9 pr-24 py-2.5 text-xs placeholder:text-xs"
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
                {sortedAndFilteredProducts.length} món
              </span>
            )}
          </div>

          {/* Bộ lọc & Sắp xếp */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs ${
              activeTag !== null || sortBy !== 'default'
                ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30 font-extrabold'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Sắp xếp</span>
            {(activeTag !== null || sortBy !== 'default') && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* ── Active sort/tag chip row (compact) ── */}
        {(activeTag !== null || sortBy !== 'default') && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs -mt-1">
            <span className="text-slate-400 font-semibold text-[11px]">Đang áp dụng:</span>
            {activeTag !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold">
                <span>Nhãn: {allAvailableTags.find((t) => t.id === activeTag)?.name || activeTag}</span>
                <button type="button" onClick={() => setActiveTag(null)} className="hover:text-indigo-950 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {sortBy !== 'default' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold">
                <span>{SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
                <button type="button" onClick={() => setSortBy('default')} className="hover:text-purple-950 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}

        {/* Popup Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-6 border border-slate-100">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Bộ Lọc & Sắp Xếp Thực Đơn</h3>
                    <p className="text-xs text-slate-400">Chọn danh mục, nhãn và thứ tự sắp xếp món</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {/* Section 1: Sắp Xếp Thực Đơn */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    ↕️ Sắp Xếp Thực Đơn ({SORT_OPTIONS.length})
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected = sortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSortBy(opt.id)}
                          className={`px-3 py-2.5 rounded-xl font-bold transition flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs text-left ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm font-black ring-2 ring-indigo-400/30'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="shrink-0">{opt.icon}</span>
                            <span className="truncate">{opt.label}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider + Section 2: Danh Mục — chỉ hiện trên mobile (desktop dùng sidebar) */}
                <div className="sm:hidden">
                  <hr className="border-slate-100" />

                  {/* Section 2: Danh Mục (Wrap) */}
                  <div className="mt-4">
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
                </div>

                {/* Section 3: Nhãn Sản Phẩm (Wrap) */}
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
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(null);
                    setActiveTag(null);
                    setSortBy('default');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer px-3 py-2.5 rounded-xl border border-slate-200 sm:border-transparent text-center justify-center flex items-center"
                >
                  Đặt lại bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer text-center justify-center flex items-center"
                >
                  Áp dụng ({sortedAndFilteredProducts.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 3-Column POS Layout: [Sidebar] | [Product Grid 2 cols] — tất cả màn hình ── */}
        <div className={`flex gap-2 sm:gap-4 items-start ${
          cartItems.length > 0 ? 'pb-36 md:pb-20' : 'pb-20 md:pb-4'
        }`}>

          {/* ── Column 1: Category Sidebar — hiện trên mọi màn hình ── */}
          <div className="w-[34%] sm:w-[24%] lg:w-[20%] xl:w-[18%] 2xl:w-[15%] 3xl:w-[13%] shrink-0">
            <div
              className="sticky top-2 sm:top-4 bg-white border border-slate-200/80 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-sm"
              style={{ maxHeight: 'calc(100dvh - 9rem)', overflowY: 'auto' }}
            >
              {/* Sidebar Header */}
              <div className="px-1.5 sm:px-2 pb-1.5 sm:pb-2 mb-1 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Danh mục</span>
              </div>
              <CategorySidebar
                categories={safeCategories}
                activeCategoryId={activeCategoryId}
                totalProductsCount={safeProducts.filter((p) => p.is_active !== false).length}
                products={safeProducts}
                onSelectCategory={setActiveCategoryId}
                allLabel={t('pos.all_items') || 'Tất cả'}
              />
            </div>
          </div>

          {/* ── Columns 2 & 3: Product Grid (Responsive) ── */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4k:grid-cols-8 gap-2 sm:gap-3 2xl:gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm animate-pulse space-y-2">
                    <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : sortedAndFilteredProducts.length === 0 ? (
              <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs shadow-2xs">
                {!network.isOnline && safeProducts.length === 0 ? (
                  <>
                    <WifiOff className="w-10 h-10 text-amber-500 mx-auto mb-2.5" />
                    <p className="font-bold text-slate-700 text-sm">Chưa có dữ liệu thực đơn ngoại tuyến</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      Thiết bị đang ngoại tuyến và chưa có bản lưu menu. Vui lòng kết nối Internet lần đầu để tải danh sách món.
                    </p>
                  </>
                ) : (
                  <>
                    <Coffee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">{t('pos.no_drinks')}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Thử chọn danh mục khác hoặc xóa bộ lọc tìm kiếm.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4k:grid-cols-8 gap-2 sm:gap-3 2xl:gap-4">
                {sortedAndFilteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    settings={settings}
                    customTags={customTags}
                    onSelect={handleSelectProductForVariant}
                    onQuickAdd={handleQuickAdd}
                    orderBtnLabel={orderBtnLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile & Bottom Sticky Quick Cart Bar - Only visible when cart has items */}
        {cartItems.length > 0 && (
          <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-2.5 right-2.5 sm:left-4 sm:right-4 max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4k:max-w-[3200px] mx-auto z-30 bg-slate-900/95 backdrop-blur-md text-white p-2.5 sm:p-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between hardware-accelerated animate-fade-in">
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
        )}

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

        <OfflineQueueModal
          isOpen={isQueueModalOpen}
          onClose={() => setIsQueueModalOpen(false)}
          settings={settings}
          onSyncCompleted={refreshQueueStats}
        />
      </div>
    </AppShell>
  );
}
