'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  ShoppingBag,
  Coffee,
  RefreshCw,
  Plus,
  Search,
  Check,
  Tag,
  X,
  SlidersHorizontal,
  ArrowUpAZ,
  ArrowDownAZ,
  FolderTree,
  TrendingUp,
  TrendingDown,
  WifiOff,
  Clock,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Button, Chip, EmptyState, ResponsiveSheet } from '@/components/ui';
import type { CartItem, Product, ProductVariant } from '@/components/pos/VariantSelectorModal';
import CartDrawer from '@/components/pos/CartDrawer';
import type { CompletedOrderData } from '@/components/pos/ReceiptModal';
import { Promotion } from '@/types/promotion';
import { fetchApi, getImageUrl } from '@/lib/api';
import { getAuthUser, isMasterRole, isOwnerRole } from '@/lib/auth';
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
import { useStore } from '@/lib/StoreContext';
import { getActiveStoreId } from '@/lib/store';
import { clientCache } from '@/lib/cache';

interface PosMemoryCache {
  storeId: number;
  products: Product[];
  categories: Category[];
  settings: SettingsMap | null;
  customTags: CustomTag[];
  timestamp: number;
}

let globalPosMemoryCache: PosMemoryCache | null = null;

// Reactive cache invalidation listener: purges memory cache when catalog mutates
if (typeof window !== 'undefined') {
  clientCache.onInvalidate((pattern) => {
    if (
      !pattern ||
      (typeof pattern === 'string' &&
        (pattern.includes('products') || pattern.includes('categories') || pattern.includes('settings')))
    ) {
      globalPosMemoryCache = null;
    }
  });
}

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

const SORT_OPTION_CONFIGS: { id: ProductSortOption; labelKey: string; icon: React.ReactNode }[] = [
  { id: 'default', labelKey: 'pos.sort_default', icon: <RefreshCw className="w-3.5 h-3.5" /> },
  { id: 'name-asc', labelKey: 'pos.sort_name_asc', icon: <ArrowUpAZ className="w-3.5 h-3.5" /> },
  { id: 'name-desc', labelKey: 'pos.sort_name_desc', icon: <ArrowDownAZ className="w-3.5 h-3.5" /> },
  { id: 'category', labelKey: 'pos.sort_category', icon: <FolderTree className="w-3.5 h-3.5" /> },
  { id: 'tag', labelKey: 'pos.sort_tag', icon: <Tag className="w-3.5 h-3.5" /> },
  { id: 'price-asc', labelKey: 'pos.sort_price_asc', icon: <TrendingUp className="w-3.5 h-3.5" /> },
  { id: 'price-desc', labelKey: 'pos.sort_price_desc', icon: <TrendingDown className="w-3.5 h-3.5" /> },
];

// ── MEMOIZED CATEGORY SIDEBAR (Opaque card surface, 0px backdrop-filter) ─────
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
    <div className="flex flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5 custom-scrollbar">
      {/* All Items */}
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={`w-full min-h-[42px] md:min-h-[38px] px-2.5 sm:px-3 py-2 rounded-field text-caption sm:text-footnote font-semibold text-left flex items-center justify-between gap-1.5 transition duration-press ease-press active:scale-[0.97] cursor-pointer ${
          activeCategoryId === null
            ? 'bg-brand-600 text-white shadow-card'
            : 'bg-surface-card text-slate-700 hover:bg-slate-900/[0.04] border border-transparent'
        }`}
      >
        <span className="truncate leading-snug">{allLabel}</span>
        <span
          className={`shrink-0 text-caption font-num min-w-[1.35rem] text-center px-1.5 py-0.5 rounded-full font-semibold ${
            activeCategoryId === null ? 'bg-white/20 text-white' : 'bg-surface-grouped text-slate-600'
          }`}
        >
          {totalProductsCount}
        </span>
      </button>

      {categories.length > 0 && <div className="border-t border-hairline my-0.5" />}

      {categories.map((cat) => {
        const catCount = products.filter((p) => p.is_active !== false && p.category_id === cat.id).length;
        const isSelected = activeCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`w-full min-h-[42px] md:min-h-[38px] px-2.5 sm:px-3 py-2 rounded-field text-caption sm:text-footnote font-semibold text-left flex items-center justify-between gap-1.5 transition duration-press ease-press active:scale-[0.97] cursor-pointer ${
              isSelected
                ? 'bg-brand-600 text-white shadow-card'
                : 'bg-surface-card text-slate-700 hover:bg-slate-900/[0.04] border border-transparent'
            }`}
          >
            <span className="flex-1 truncate leading-snug">{cat.name}</span>
            <span
              className={`shrink-0 text-caption font-num min-w-[1.35rem] text-center px-1.5 py-0.5 rounded-full font-semibold ${
                isSelected ? 'bg-white/20 text-white' : 'bg-surface-grouped text-slate-600'
              }`}
            >
              {catCount}
            </span>
          </button>
        );
      })}
    </div>
  );
});

// ── MEMOIZED PRODUCT CARD (100% Opaque Layer A, 0px backdrop-filter) ─────────
interface ProductCardProps {
  product: Product;
  settings: SettingsMap | null;
  customTags: CustomTag[];
  onSelect: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  orderBtnLabel?: string;
}

const ProductCard = React.memo(function ProductCard({
  product,
  settings,
  customTags,
  onSelect,
  onQuickAdd,
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
    onSelect(product);
  };

  const tagStyle = useMemo(() => {
    if (!product.tag || product.tag === 'none') return null;
    return getTagBadgeStyle(product.tag, customTags);
  }, [product.tag, customTags]);

  return (
    <div
      onClick={handleClick}
      className={`bg-surface-card p-2 sm:p-2.5 rounded-card border border-card shadow-card hover:shadow-glass-sm hover:border-brand-300 transition duration-press ease-press active:scale-[0.98] flex flex-col justify-between cursor-pointer group min-w-0 w-full relative select-none ${
        isSuspended ? 'opacity-70 bg-surface-grouped/60' : ''
      }`}
    >
      <div className="min-w-0">
        {/* Concentric inner thumbnail: R_outer (16px) - Padding (8px) = 8px (rounded-sm-tahoe) */}
        <div className="w-full aspect-square bg-surface-grouped rounded-sm-tahoe mb-1.5 flex items-center justify-center text-slate-400 overflow-hidden relative">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-snappy ease-spring-snappy"
            />
          ) : (
            <Coffee className="w-7 h-7 sm:w-8 sm:h-8 opacity-40 text-slate-400" />
          )}

          {/* Opaque Size / Variant Pill (0px backdrop-filter — preserves GPU scroll budget) */}
          {variantsCount > 1 && (
            <span className="absolute top-1.5 left-1.5 bg-slate-900/90 text-white text-caption font-semibold font-num px-2 py-0.5 rounded-full pointer-events-none">
              {t('pos.sizes_badge', { count: variantsCount })}
            </span>
          )}

          {/* Quick-Add (+) Capsule Button Overlay */}
          {!isSuspended && !isComingSoon && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(product);
              }}
              className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-brand-600 hover:bg-brand-700 active:scale-90 text-white flex items-center justify-center shadow-card border-2 border-white transition duration-press ease-press cursor-pointer z-10"
              title={t('pos.quick_add_title')}
              aria-label={t('pos.quick_add_aria', { name: product.name })}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Tag Badge */}
        {tagStyle && (
          <div className="mb-1">
            <span
              className={`text-caption font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 max-w-full truncate ${tagStyle.badgeClasses}`}
            >
              <span>{tagStyle.icon}</span>
              <span className="truncate">{tagStyle.name}</span>
            </span>
          </div>
        )}

        <h3 className="font-semibold text-slate-900 text-footnote sm:text-subhead leading-snug group-hover:text-brand-700 transition-colors line-clamp-2 break-words">
          {product.name}
        </h3>
      </div>

      {/* Bottom section: Tabular Price & Status */}
      <div className="mt-2 pt-1.5 border-t border-hairline flex items-center justify-between gap-1 min-w-0">
        <div className="flex items-baseline gap-1 min-w-0">
          {variantsCount > 1 && (
            <span className="text-caption text-slate-500 font-medium shrink-0">
              {t('pos.from_price')}
            </span>
          )}
          <span
            className="font-bold font-num tabular-nums text-brand-700 text-subhead sm:text-headline tracking-tight truncate leading-snug"
            title={formatCurrency(startingPrice, settings)}
          >
            {formatCurrency(startingPrice, settings)}
          </span>
        </div>

        {isSuspended ? (
          <span className="text-caption font-semibold text-slate-600 bg-surface-grouped px-2 py-0.5 rounded-full shrink-0">
            {t('products.suspended')}
          </span>
        ) : isComingSoon ? (
          <span className="text-caption font-semibold text-sky-700 bg-sky-50 border border-sky-200/80 px-2 py-0.5 rounded-full shrink-0">
            {t('products.coming_soon')}
          </span>
        ) : null}
      </div>
    </div>
  );
});

export default function PosPage() {
  const { t } = useTranslation();
  const { showAlert } = useConfirm();
  const toast = useToast();
  const network = useNetworkStatus();
  const { activeStore, isSuperAdmin, storeRole } = useStore();
  const currentStoreId = activeStore?.id ?? getActiveStoreId() ?? 1;
  const cartStorageKey = `rabbitpos_active_cart_${currentStoreId}`;
  const filterTriggerRef = useRef<HTMLButtonElement>(null);

  const canManageStore = useMemo(() => {
    const u = typeof window !== 'undefined' ? getAuthUser() : null;
    return isMasterRole(u?.role) || isSuperAdmin || isOwnerRole(u?.role) || storeRole === 'store_admin';
  }, [isSuperAdmin, storeRole]);

  // Instant 0ms warm cache initialization (eliminates layout flash on tab switch)
  const hasWarmCache = Boolean(
    globalPosMemoryCache &&
    globalPosMemoryCache.storeId === currentStoreId &&
    globalPosMemoryCache.products.length > 0
  );

  const [categories, setCategories] = useState<Category[]>(() => hasWarmCache ? globalPosMemoryCache!.categories : []);
  const [products, setProducts] = useState<Product[]>(() => hasWarmCache ? globalPosMemoryCache!.products : []);
  const [customTags, setCustomTags] = useState<CustomTag[]>(() => hasWarmCache ? globalPosMemoryCache!.customTags : []);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<ProductSortOption>('default');
  const [loading, setLoading] = useState<boolean>(() => !hasWarmCache);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [settings, setSettings] = useState<SettingsMap | null>(() => hasWarmCache ? globalPosMemoryCache!.settings : null);
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
  const [salesChannel, setSalesChannel] = useState<string>('dine_in');
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState<number>(0);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [funds, setFunds] = useState<{ id: number; name: string; fund_type: string; current_balance: number }[]>([]);
  const [surcharge, setSurcharge] = useState<number>(0);
  const [orderCreatedAt, setOrderCreatedAt] = useState<string | null>(null);

  // Load store payment funds
  useEffect(() => {
    const loadFunds = async () => {
      const res = await fetchApi<any[]>('/funds');
      if (res.status === 'success' && Array.isArray(res.data)) {
        setFunds(res.data);
      }
    };
    loadFunds();
  }, [currentStoreId]);

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
  const loadData = useCallback(async (retryCount = 0, isBackground = false) => {
    const isAlreadyLoaded = Boolean(
      (globalPosMemoryCache && globalPosMemoryCache.storeId === currentStoreId && globalPosMemoryCache.products.length > 0) ||
      products.length > 0
    );

    // Only show skeleton loader on cold start (no items in memory)
    if (!isBackground && !isAlreadyLoaded) {
      setLoading(true);
    }

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
          globalPosMemoryCache = {
            storeId: currentStoreId,
            products: cached.products,
            categories: cached.categories,
            settings: cached.settings,
            customTags: cached.customTags || [],
            timestamp: Date.now(),
          };
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

      // Update warm memory cache
      if (prodList.length > 0 || catList.length > 0) {
        globalPosMemoryCache = {
          storeId: currentStoreId,
          products: prodList,
          categories: catList,
          settings: map,
          customTags: parsedTags,
          timestamp: Date.now(),
        };
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
        setTimeout(() => loadData(retryCount + 1, isBackground), 800);
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
          globalPosMemoryCache = {
            storeId: currentStoreId,
            products: cached.products,
            categories: cached.categories,
            settings: cached.settings,
            customTags: cached.customTags || [],
            timestamp: Date.now(),
          };
        } else if (retryCount < 2) {
          setTimeout(() => loadData(retryCount + 1, isBackground), 800);
          return;
        }
      } catch (idbErr) {
        console.error('IndexedDB fallback also failed:', idbErr);
      }
    } finally {
      setLoading(false);
    }
  }, [currentStoreId, products.length]);

  useEffect(() => {
    const hasWarm = Boolean(
      globalPosMemoryCache &&
      globalPosMemoryCache.storeId === currentStoreId &&
      globalPosMemoryCache.products.length > 0
    );
    loadData(0, hasWarm);

    // 0. One-time legacy cart migration (rabbitpos_active_cart -> rabbitpos_active_cart_1)
    if (typeof window !== 'undefined') {
      try {
        const legacyCart = localStorage.getItem('rabbitpos_active_cart');
        if (legacyCart) {
          if (!localStorage.getItem('rabbitpos_active_cart_1')) {
            localStorage.setItem('rabbitpos_active_cart_1', legacyCart);
          }
          localStorage.removeItem('rabbitpos_active_cart');
        }
      } catch {}
    }

    // 1. Restore Draft Cart Items from IndexedDB (with LocalStorage fallback)
    const restoreCart = async () => {
      try {
        const cachedCart = await loadCartFromOfflineCache(currentStoreId);
        if (cachedCart && Array.isArray(cachedCart.items) && cachedCart.items.length > 0) {
          setCartItems(cachedCart.items);
          if (cachedCart.orderNote) setOrderNote(cachedCart.orderNote);
          if (cachedCart.discountAmount) setDiscountAmount(cachedCart.discountAmount);
          if (cachedCart.platformFeeDiscount) setPlatformFeeDiscount(cachedCart.platformFeeDiscount);
          if (cachedCart.selectedPromotion) setSelectedPromotion(cachedCart.selectedPromotion);
          if (cachedCart.shippingFee) setShippingFee(cachedCart.shippingFee);
          if (cachedCart.surcharge) setSurcharge(cachedCart.surcharge);
          return;
        }

        const savedCart = localStorage.getItem(cartStorageKey);
        if (savedCart) {
          const parsed = JSON.parse(savedCart);
          if (parsed.cartItems && Array.isArray(parsed.cartItems) && parsed.cartItems.length > 0) {
            setCartItems(parsed.cartItems);
            if (parsed.discountAmount) setDiscountAmount(parsed.discountAmount);
            if (parsed.platformFeeDiscount) setPlatformFeeDiscount(parsed.platformFeeDiscount);
            if (parsed.shippingFee) setShippingFee(parsed.shippingFee);
            if (parsed.surcharge) setSurcharge(parsed.surcharge);
          } else {
            localStorage.removeItem(cartStorageKey);
          }
        }
      } catch (e) {
        console.error('Failed to restore active cart', e);
      }
    };

    restoreCart();
  }, [loadData, currentStoreId, cartStorageKey]);

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
        }, currentStoreId).catch((e) => console.warn('Failed to cache cart in IndexedDB:', e));

        localStorage.setItem(
          cartStorageKey,
          JSON.stringify({
            cartItems,
            discountAmount,
            platformFeeDiscount,
            shippingFee,
            surcharge,
          })
        );
      } else {
        clearCartFromOfflineCache(currentStoreId).catch(() => {});
        localStorage.removeItem(cartStorageKey);
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
    const currentSubtotal = cartItems.filter((i) => !i.isGift).reduce((acc, item) => acc + item.lineTotal, 0);
    const totalQty = cartItems.filter((i) => !i.isGift).reduce((acc, item) => acc + item.quantity, 0);

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
    setCartItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.isGift) {
        setSelectedPromotion(null);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleSelectPromotion = useCallback((promo: Promotion | null) => {
    setSelectedPromotion(promo);
    if (!promo || promo.promo_type !== 'gift_item') {
      setCartItems((prev) => prev.filter((item) => !item.isGift));
    }
  }, []);

  const handleApplyGiftItem = useCallback(
    (promo: Promotion, variant: ProductVariant, product: Product) => {
      setSelectedPromotion(promo);
      const giftCartItem: CartItem = {
        id: `gift-${promo.id}-${variant.id}-${Date.now()}`,
        product: product,
        selectedVariant: variant,
        sugarLevel: '100%',
        iceLevel: '100%',
        selectedToppings: [],
        toppingsPrice: 0,
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        notes: `Quà tặng: ${promo.name}`,
        isGift: true,
        giftPromotionId: promo.id,
        giftPromotionName: promo.name,
        originalUnitPrice: variant.retail_price,
      };
      setCartItems((prev) => {
        const nonGifts = prev.filter((item) => !item.isGift);
        return [...nonGifts, giftCartItem];
      });
      toast.success(
        `Đã áp dụng quà tặng: ${product.name} (${variant.variant_name})`,
        { duration: 2500 }
      );
    },
    [toast]
  );

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
          platform_fee_discount: platformFeeDiscount > 0 ? platformFeeDiscount : undefined,
          shipping_fee: shippingFee > 0 ? shippingFee : undefined,
          surcharge: surcharge > 0 ? surcharge : undefined,
          created_at: orderCreatedAt || undefined,
          items: cartItems.map((item) => ({
            product_variant_id: item.selectedVariant.id,
            quantity: item.quantity,
            topping_ids: (item.selectedToppings || []).map((t) => t.id),
            notes: item.notes || '',
            is_gift: !!item.isGift,
            price_override: item.unitPrice !== item.selectedVariant.retail_price ? item.unitPrice : undefined,
          })),
        },
        display_snapshot: {
          order_code: provisionalCode,
          items: orderCartSnapshot,
          subtotal: cartSubtotal,
          discount: discountAmount,
          manual_discount: discountAmount,
          promotion_discount: promotionDiscount,
          promotion_name: selectedPromotion?.name || undefined,
          platform_fee_discount: platformFeeDiscount,
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

      await enqueueOfflineOrder(offlineOrder, currentStoreId);

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
      clearCartFromOfflineCache(currentStoreId).catch(() => {});
      localStorage.removeItem(cartStorageKey);
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
      platform_fee_discount: platformFeeDiscount > 0 ? platformFeeDiscount : undefined,
      sales_channel: salesChannel,
      platform_commission_percent: platformCommissionPercent > 0 ? platformCommissionPercent : undefined,
      shipping_fee: shippingFee > 0 ? shippingFee : undefined,
      surcharge: surcharge > 0 ? surcharge : undefined,
      created_at: orderCreatedAt || undefined,
      items: cartItems.map((item) => ({
        product_variant_id: item.selectedVariant.id,
        quantity: item.quantity,
        topping_ids: (item.selectedToppings || []).map((t) => t.id),
        notes: item.notes || '',
        is_gift: !!item.isGift,
        price_override: item.unitPrice !== item.selectedVariant.retail_price ? item.unitPrice : undefined,
      })),
    };

    setIsSubmittingOrder(true);
    try {
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
        setSalesChannel('dine_in');
        setPlatformCommissionPercent(0);
        setIsCheckoutModalOpen(false);
        setIsVietQRModalOpen(false);
        setIsCartDrawerOpen(false);

        const totalDiscounts =
          (serverOrder.discount_amount || serverOrder.manual_discount || 0) +
          (serverOrder.promotion_discount || 0) +
          (serverOrder.platform_fee_discount || 0);

        const orderData: CompletedOrderData = {
          order_code: serverOrder.order_code,
          daily_seq_no: serverOrder.daily_seq_no,
          sales_channel: serverOrder.sales_channel || salesChannel,
          platform_commission_percent: serverOrder.platform_commission_percent || platformCommissionPercent,
          created_at: serverOrder.created_at || new Date().toISOString(),
          items: orderCartSnapshot,
          subtotal: serverOrder.subtotal,
          discount: totalDiscounts,
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
        clearCartFromOfflineCache(currentStoreId).catch(() => {});
        localStorage.removeItem(cartStorageKey);
        toast.success(t('pos.order_success', { code: res.data.order_code }));
      } else {
        toast.error(t('pos.order_failed', { message: res.message }));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleOneTapCash = async () => {
    if (isSubmittingOrder || cartItems.length === 0) return;
    const cashFund = funds.find((f) => f.fund_type === 'cash') || funds[0] || { id: 1 };
    await submitOrder(cashFund.id);
  };

  const handleOneTapVietQR = () => {
    if (isSubmittingOrder || cartItems.length === 0) return;
    if (!network.isOnline) {
      toast.warning(
        'Không thể tạo mã VietQR khi đang ngoại tuyến. Vui lòng thanh toán Tiền mặt.',
        { title: 'Chỉ chấp nhận Tiền mặt' }
      );
      return;
    }
    const bankFund = funds.find((f) => f.fund_type === 'bank') || funds.find((f) => f.id === 2) || funds[1] || { id: 2 };
    setSelectedFundId(bankFund.id);
    setIsCartDrawerOpen(false);
    setIsVietQRModalOpen(true);
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
  const totalActiveProductsCount = useMemo(
    () => safeProducts.filter((p) => p.is_active !== false).length,
    [safeProducts]
  );

  const activeSortLabel = useMemo(() => {
    const found = SORT_OPTION_CONFIGS.find((s) => s.id === sortBy);
    return found ? t(found.labelKey) : '';
  }, [sortBy, t]);

  return (
    <AppShell>
      <div className="flex flex-col gap-3 sm:gap-3.5 w-full max-w-7xl 2xl:max-w-[1800px] 3xl:max-w-[2400px] 4k:max-w-[3200px] mx-auto">
        {/* ── POS Compact Top Toolbar (All controls share h-11 md:h-9 capsule geometry; 16px mobile search input) ── */}
        <div className="flex items-center gap-2 w-full">
          {/* Network Sync Status Pill */}
          {network.isOnline ? (
            <span className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-caption font-semibold bg-surface-card text-slate-700 border border-card shadow-card shrink-0 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span>
                {lastSyncedAt
                  ? t('pos.synced_at', {
                      time: new Date(lastSyncedAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })
                  : t('pos.online_status')}
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 h-11 md:h-9 px-3 rounded-full text-caption font-semibold bg-amber-50 text-amber-900 border border-amber-300/80 shrink-0 select-none">
              <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="hidden sm:inline">
                {t('pos.offline_status')}
                {lastSyncedAt
                  ? ` (${new Date(lastSyncedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })})`
                  : ''}
              </span>
            </span>
          )}

          {/* Offline Queue Capsule Button */}
          {queueStats.total > 0 && (
            <button
              type="button"
              onClick={() => setIsQueueModalOpen(true)}
              className={`h-11 md:h-9 px-3.5 rounded-full text-footnote font-semibold transition duration-press ease-press active:scale-[0.97] inline-flex items-center gap-1.5 shrink-0 cursor-pointer shadow-card ${
                queueStats.requiresReview > 0
                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                  : 'bg-amber-50 text-amber-900 border border-amber-300'
              }`}
              title={t('pos.offline_queue_title_attr')}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t('pos.offline_queue_btn')}</span>
              <span className="bg-amber-200/80 text-amber-950 text-caption font-num px-1.5 py-0.5 rounded-full font-bold">
                {queueStats.pending + queueStats.requiresReview}
              </span>
            </button>
          )}

          {/* Capsule Search Input (16px text-base on mobile prevents iOS Safari zoom; matches h-11 md:h-9 filter button) */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('pos.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 md:h-9 pl-10 pr-20 bg-surface-card border border-slate-300/80 rounded-full text-base md:text-sm text-slate-900 placeholder:text-slate-400 placeholder:text-sm md:placeholder:text-xs shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:border-brand-600 transition-colors"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 md:w-7 md:h-7 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                title={t('pos.clear_search')}
                aria-label={t('pos.clear_search')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-caption font-semibold font-num text-slate-500 bg-surface-grouped px-2 py-0.5 rounded-full pointer-events-none">
                {t('pos.items_badge', { count: sortedAndFilteredProducts.length })}
              </span>
            )}
          </div>

          {/* Sort & Filter Capsule Trigger (Exact matching h-11 md:h-9 height) */}
          <button
            ref={filterTriggerRef}
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            aria-expanded={isFilterModalOpen}
            className={`h-11 md:h-9 min-w-[44px] md:min-w-[36px] px-3.5 rounded-full text-footnote font-semibold transition duration-press ease-press active:scale-[0.97] inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
              activeTag !== null || sortBy !== 'default'
                ? 'bg-brand-600 text-white shadow-glass-sm'
                : 'bg-surface-card text-slate-700 hover:bg-slate-50 border border-slate-300/80 shadow-card'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t('pos.sort_btn')}</span>
            {(activeTag !== null || sortBy !== 'default') && (
              <span className="w-2 h-2 rounded-full bg-white/90 shrink-0" />
            )}
          </button>
        </div>

        {/* ── Active Sort / Tag Capsule Chips Row ── */}
        {(activeTag !== null || sortBy !== 'default') && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-1">
            <span className="text-caption font-semibold text-slate-500">
              {t('pos.active_filters_prefix')}
            </span>
            {activeTag !== null && (
              <Chip
                size="sm"
                active
                onRemove={() => setActiveTag(null)}
              >
                {t('pos.tag_prefix', {
                  name: allAvailableTags.find((tg) => tg.id === activeTag)?.name || activeTag,
                })}
              </Chip>
            )}
            {sortBy !== 'default' && (
              <Chip
                size="sm"
                active
                onRemove={() => setSortBy('default')}
              >
                {activeSortLabel}
              </Chip>
            )}
          </div>
        )}

        {/* ── Sort & Filter ResponsiveSheet (M08: glass-thick z-75 mobile sheet / z-70 desktop popover) ── */}
        <ResponsiveSheet
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          triggerRef={filterTriggerRef}
          exclusiveId="pos-sort-filter"
          align="end"
          width="w-[26rem]"
          detent="large"
          title={
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-brand-700 shrink-0" />
              <span className="text-headline font-semibold text-slate-900">
                {t('pos.filter_sheet_title')}
              </span>
            </div>
          }
          description={t('pos.filter_sheet_desc')}
          footer={
            <div className="flex items-center justify-between gap-2 w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setActiveCategoryId(null);
                  setActiveTag(null);
                  setSortBy('default');
                }}
              >
                {t('common.reset_filters')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsFilterModalOpen(false)}
              >
                {t('pos.apply_count', { count: sortedAndFilteredProducts.length })}
              </Button>
            </div>
          }
        >
          <div className="space-y-5 py-1">
            {/* Section 1: Sort Order */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-subhead font-semibold text-slate-700">
                  {t('pos.sort_section_label')}
                </span>
                <span className="text-caption font-num text-slate-500">
                  {SORT_OPTION_CONFIGS.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SORT_OPTION_CONFIGS.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id)}
                      className={`min-h-[44px] md:min-h-[38px] px-3 py-2 rounded-field text-footnote font-semibold transition duration-press ease-press active:scale-[0.98] flex items-center justify-between gap-2 cursor-pointer text-left border ${
                        isSelected
                          ? 'bg-brand-600 text-white border-brand-600 shadow-card'
                          : 'bg-surface-card text-slate-700 hover:bg-slate-50 border-card shadow-card'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span className={isSelected ? 'text-white shrink-0' : 'text-brand-600 shrink-0'}>
                          {opt.icon}
                        </span>
                        <span className="truncate">{t(opt.labelKey)}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Menu Categories (Mobile quick-pick) */}
            <div className="md:hidden space-y-2 pt-3 border-t border-hairline">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-subhead font-semibold text-slate-700">
                  {t('pos.category_section_label')}
                </span>
                <span className="text-caption font-num text-slate-500">
                  {safeCategories.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={activeCategoryId === null}
                  count={totalActiveProductsCount}
                  onClick={() => setActiveCategoryId(null)}
                >
                  {t('pos.all_items')}
                </Chip>
                {safeCategories.map((cat) => {
                  const count = safeProducts.filter(
                    (p) => p.is_active !== false && p.category_id === cat.id
                  ).length;
                  const isSelected = activeCategoryId === cat.id;
                  return (
                    <Chip
                      key={cat.id}
                      active={isSelected}
                      count={count}
                      onClick={() => setActiveCategoryId(isSelected ? null : cat.id)}
                    >
                      {cat.name}
                    </Chip>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Product Tags */}
            <div className="space-y-2 pt-3 border-t border-hairline">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-subhead font-semibold text-slate-700">
                  {t('pos.tag_section_label')}
                </span>
                <span className="text-caption font-num text-slate-500">
                  {allAvailableTags.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={activeTag === null}
                  count={
                    safeProducts.filter(
                      (p) =>
                        p.is_active !== false &&
                        (activeCategoryId === null || p.category_id === activeCategoryId)
                    ).length
                  }
                  onClick={() => setActiveTag(null)}
                >
                  {t('common.all')}
                </Chip>
                {allAvailableTags.map((tg) => {
                  const count = safeProducts.filter(
                    (p) =>
                      p.is_active !== false &&
                      p.tag === tg.id &&
                      (activeCategoryId === null || p.category_id === activeCategoryId)
                  ).length;
                  const isSelected = activeTag === tg.id;
                  return (
                    <Chip
                      key={tg.id}
                      active={isSelected}
                      count={count}
                      leftIcon={<span>{tg.icon}</span>}
                      onClick={() => setActiveTag(isSelected ? null : tg.id)}
                    >
                      {tg.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </div>
        </ResponsiveSheet>

        {/* ── POS Workspace Columns: [Opaque Category Rail] | [Opaque Product Grid] ── */}
        <div
          className={`flex gap-2.5 sm:gap-4 items-start ${
            cartItems.length > 0
              ? canManageStore
                ? 'pb-36 md:pb-24'
                : 'pb-24 md:pb-24'
              : canManageStore
                ? 'pb-12 md:pb-4'
                : 'pb-4'
          }`}
        >
          {/* Column 1: Sticky Opaque Category Rail (0px backdrop-filter) */}
          <div className="w-[33%] sm:w-[24%] lg:w-[20%] xl:w-[18%] 2xl:w-[15%] 3xl:w-[13%] shrink-0">
            <div
              className="sticky top-2 sm:top-3 bg-surface-card border border-card rounded-card p-1.5 sm:p-2 shadow-card"
              style={{ maxHeight: 'calc(100dvh - 9rem)', overflowY: 'auto' }}
            >
              <div className="px-2 pb-1.5 mb-1 border-b border-hairline">
                <span className="text-caption font-semibold text-slate-500">
                  {t('pos.categories_heading')}
                </span>
              </div>
              <CategorySidebar
                categories={safeCategories}
                activeCategoryId={activeCategoryId}
                totalProductsCount={totalActiveProductsCount}
                products={safeProducts}
                onSelectCategory={handleSelectCategory}
                allLabel={t('pos.all_items')}
              />
            </div>
          </div>

          {/* Column 2: Opaque Product Grid (0px backdrop-filter across all cards) */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4k:grid-cols-8 gap-2 sm:gap-3 2xl:gap-4">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="bg-surface-card p-2.5 rounded-card border border-card shadow-card animate-pulse space-y-2"
                  >
                    <div className="w-full aspect-square bg-surface-grouped rounded-sm-tahoe" />
                    <div className="h-3 bg-surface-grouped rounded-full w-3/4" />
                    <div className="h-3 bg-surface-grouped rounded-full w-1/2" />
                  </div>
                ))}
              </div>
            ) : sortedAndFilteredProducts.length === 0 ? (
              !network.isOnline && safeProducts.length === 0 ? (
                <EmptyState
                  icon={<WifiOff className="w-7 h-7 text-amber-600" />}
                  title={t('pos.offline_empty_title')}
                  description={t('pos.offline_empty_desc')}
                />
              ) : (
                <EmptyState
                  icon={<Coffee className="w-7 h-7 text-slate-400" />}
                  title={t('pos.no_drinks')}
                  description={t('pos.no_drinks_hint')}
                />
              )
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

        {/* ── Solid Tinted POS Quick-Cart Bar (Amendment A2 & A3: #2E1065, 0px blur, z-cart-bar: 35) ──
            - <768px admin/SuperAdmin: sits 10px above the 56px Floating Bottom Tab Bar
            - <768px staff (no Tab Bar): sits in primary thumb zone at bottom 12px / safe-area
            - >=768px: centers inside the POS content pane offset by --shell-sidebar-w */}
        {cartItems.length > 0 && (
          <div
            className={`fixed left-3 right-3 md:left-[calc(var(--shell-sidebar-w,0px)+1.5rem)] md:right-6 max-w-4xl mx-auto z-cart-bar surface-cart-bar text-white p-1.5 sm:p-2 rounded-full flex items-center justify-between gap-2 select-none ${
              canManageStore
                ? 'bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom,0px))+0.625rem)] md:bottom-5'
                : 'bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] md:bottom-5'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsCartDrawerOpen(true)}
              className="min-h-[44px] md:min-h-[40px] flex items-center gap-2.5 sm:gap-3 cursor-pointer active:scale-[0.98] transition duration-press ease-press min-w-0 flex-1 pl-1 pr-2 rounded-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <div className="relative w-10 h-10 md:w-9 md:h-9 bg-brand-600 rounded-full text-white flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                {totalItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-caption font-bold font-num min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border border-brand-950">
                    {totalItemCount}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-caption text-brand-200 font-medium truncate leading-tight">
                  {t('pos.cart_total')} ({t('pos.items_count', { count: totalItemCount })})
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-subhead sm:text-headline font-bold font-num tabular-nums text-white truncate leading-snug">
                    {formatCurrency(cartTotal, settings)}
                  </span>
                  {discountAmount + promotionDiscount + platformFeeDiscount > 0 && (
                    <span className="text-caption font-num bg-white/15 text-brand-100 font-semibold px-2 py-0.5 rounded-full truncate">
                      -{formatCurrency(discountAmount + promotionDiscount + platformFeeDiscount, settings)}
                    </span>
                  )}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pr-0.5">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsCartDrawerOpen(true)}
                disabled={cartItems.length === 0}
                className="bg-white/12 hover:bg-white/20 text-white border-white/20 whitespace-nowrap"
              >
                {t('pos.view_cart')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsCheckoutModalOpen(true)}
                disabled={cartItems.length === 0}
                className="bg-white hover:bg-brand-50 text-brand-950 border-transparent font-semibold whitespace-nowrap shadow-glass-sm"
              >
                {t('pos.checkout_now')}
              </Button>
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
          onSelectPromotion={handleSelectPromotion}
          products={products}
          categories={categories}
          onApplyGiftItem={handleApplyGiftItem}
          promotionDiscount={promotionDiscount}
          shippingFee={shippingFee}
          onShippingFeeChange={setShippingFee}
          platformFeeDiscount={platformFeeDiscount}
          onPlatformFeeDiscountChange={setPlatformFeeDiscount}
          salesChannel={salesChannel}
          onSalesChannelChange={setSalesChannel}
          platformCommissionPercent={platformCommissionPercent}
          onPlatformCommissionPercentChange={setPlatformCommissionPercent}
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
          onOneTapCash={handleOneTapCash}
          onOneTapVietQR={handleOneTapVietQR}
          onOpenCheckoutModal={() => {
            setIsCartDrawerOpen(false);
            setIsCheckoutModalOpen(true);
          }}
          isSubmitting={isSubmittingOrder}
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
            salesChannel={salesChannel}
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
