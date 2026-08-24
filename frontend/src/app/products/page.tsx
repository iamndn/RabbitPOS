'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Tag,
  Edit2,
  Trash2,
  X,
  Coffee,
  TrendingUp,
  Percent,
  FolderPlus,
  Upload,
  Image as ImageIcon,
  Loader2,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  Zap,
  Gift,
  Filter,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, getImageUrl, uploadImage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';
import TagManagerModal, {
  CustomTag,
  DEFAULT_SYSTEM_TAGS,
  getTagBadgeStyle,
} from '@/components/products/TagManagerModal';
import AutoTaggingModal from '@/components/products/AutoTaggingModal';
import CategoryManagerModal from '@/components/products/CategoryManagerModal';
import ToppingManagerModal from '@/components/products/ToppingManagerModal';
import PromotionsModal from '@/components/products/PromotionsModal';

interface Category {
  id: number;
  name: string;
  image_url?: string;
  display_order: number;
}

interface ProductVariant {
  id?: number;
  variant_name: string;
  cogs_price: number;
  retail_price: number;
  sku: string;
  is_active?: boolean;
}

interface Product {
  id: number;
  category_id: number;
  category?: Category;
  name: string;
  description: string;
  image_url: string;
  tag: string;
  tag_locked?: boolean;
  is_active?: boolean;
  variants: ProductVariant[];
  created_at?: string;
}

interface Topping {
  id: number;
  name: string;
  price: number;
  cogs: number;
  category_id: number | null;
  is_active: boolean;
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isFilterInitialized, setIsFilterInitialized] = useState<boolean>(false);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Restore saved filters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('rabbitpos_filter_products');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.selectedCategory !== undefined) setSelectedCategory(parsed.selectedCategory);
          if (parsed.selectedTag !== undefined) setSelectedTag(parsed.selectedTag);
          if (parsed.selectedStatus !== undefined) setSelectedStatus(parsed.selectedStatus);
        }
      } catch {}
      setIsFilterInitialized(true);
    }
  }, []);

  // Save filters to sessionStorage when changed
  useEffect(() => {
    if (!isFilterInitialized) return;
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          'rabbitpos_filter_products',
          JSON.stringify({
            selectedCategory,
            selectedTag,
            selectedStatus,
          })
        );
      } catch {}
    }
  }, [isFilterInitialized, selectedCategory, selectedTag, selectedStatus]);

  // Popup Modal States
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [isToppingManagerOpen, setIsToppingManagerOpen] = useState<boolean>(false);
  const [isPromotionsModalOpen, setIsPromotionsModalOpen] = useState<boolean>(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [isAutoTagModalOpen, setIsAutoTagModalOpen] = useState<boolean>(false);
  const [customTags, setCustomTags] = useState<CustomTag[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form State
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<number>(0);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formTag, setFormTag] = useState<string>('none');
  const [formTagLocked, setFormTagLocked] = useState<boolean>(false);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([
    { variant_name: 'Size M', cogs_price: 1.0, retail_price: 3.5, sku: '' },
  ]);

  // Upload states
  const [uploadingProductImg, setUploadingProductImg] = useState<boolean>(false);

  const handleProductFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductImg(true);
    const res = await uploadImage(file);
    if (res.status === 'success' && res.data?.url) {
      setFormImageUrl(res.data.url);
    } else {
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to upload image', 'danger');
    }
    setUploadingProductImg(false);
  };

  const handleSaveTags = async (updatedTags: CustomTag[]) => {
    const payload = {
      custom_product_tags: JSON.stringify(updatedTags),
    };
    const res = await fetchApi<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.status === 'success') {
      setCustomTags(updatedTags);
      setSettings((prev) => (prev ? { ...prev, custom_product_tags: JSON.stringify(updatedTags) } : null));
    } else {
      throw new Error(res.message || 'Failed to save tags');
    }
  };

  const loadCatalog = async (retryCount = 0) => {
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
            if (s && s.key) {
              map[s.key] = s.value;
            }
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
        if (catList.length > 0 && formCategoryId === 0) {
          setFormCategoryId(catList[0].id);
        }
      }

      if (prodRes.status === 'success') {
        const prodList = Array.isArray(prodRes.data)
          ? prodRes.data
          : Array.isArray(prodRes)
          ? (prodRes as Product[])
          : [];
        setProducts(prodList);
      } else if (retryCount < 2) {
        setTimeout(() => loadCatalog(retryCount + 1), 800);
        return;
      }
    } catch (e) {
      console.error('Failed to load catalog:', e);
      if (retryCount < 2) {
        setTimeout(() => loadCatalog(retryCount + 1), 800);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const loadToppings = async () => {
    const res = await fetchApi<Topping[]>('/toppings/all');
    if (res.status === 'success' && Array.isArray(res.data)) {
      setToppings(res.data);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadToppings();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('open') === 'promotions') {
        setIsPromotionsModalOpen(true);
      }
    }
  }, []);

  // ── Product Modal Helpers ──────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormDescription('');
    setFormImageUrl('');
    setFormTag('none');
    setFormTagLocked(false);
    setFormIsActive(true);
    setFormCategoryId(categories[0]?.id || 0);
    setFormVariants([
      { variant_name: 'Size M', cogs_price: 8000, retail_price: 25000, sku: '' },
    ]);
    setIsProductModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategoryId(product.category_id);
    setFormDescription(product.description || '');
    setFormImageUrl(product.image_url || '');
    setFormTag(product.tag || 'none');
    setFormTagLocked(product.tag_locked || false);
    setFormIsActive(product.is_active !== false);
    setFormVariants(
      product.variants && product.variants.length > 0
        ? product.variants
        : [{ variant_name: 'Default', cogs_price: 0, retail_price: 0, sku: '' }]
    );
    setIsProductModalOpen(true);
  };

  const handleToggleProductStatus = async (product: Product) => {
    const nextStatus = product.is_active === false ? true : false;
    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, is_active: nextStatus } : p))
    );

    try {
      const res = await fetchApi<Product>(`/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: nextStatus }),
      });
      if (res.status !== 'success') {
        // Rollback
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, is_active: product.is_active } : p))
        );
        showAlert(t('common.error') || 'Lỗi', t('products.update_failed', { message: res.message }), 'danger');
      }
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: product.is_active } : p))
      );
      showAlert(t('common.error') || 'Lỗi', t('products.update_failed', { message: err?.message }), 'danger');
    }
  };

  const handleAddVariantRow = () => {
    setFormVariants([
      ...formVariants,
      { variant_name: 'Size L', cogs_price: 10000, retail_price: 30000, sku: '' },
    ]);
  };

  const handleRemoveVariantRow = (index: number) => {
    if (formVariants.length === 1) return;
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (
    index: number,
    field: keyof ProductVariant,
    value: any
  ) => {
    const updated = [...formVariants];
    updated[index] = { ...updated[index], [field]: value };
    setFormVariants(updated);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCategoryId) return;

    if (editingProduct) {
      const res = await fetchApi<Product>(`/products/${editingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formName,
          category_id: formCategoryId,
          description: formDescription,
          image_url: formImageUrl,
          tag: formTag,
          tag_locked: formTagLocked,
          is_active: formIsActive,
        }),
      });
      if (res.status === 'success') {
        // Also update/create variants
        for (const v of formVariants) {
          if (v.id) {
            await fetchApi(`/variants/${v.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                variant_name: v.variant_name,
                cogs_price: Number(v.cogs_price || 0),
                retail_price: Number(v.retail_price || 0),
                sku: v.sku,
              }),
            });
          } else {
            await fetchApi(`/products/${editingProduct.id}/variants`, {
              method: 'POST',
              body: JSON.stringify({
                variant_name: v.variant_name,
                cogs_price: Number(v.cogs_price || 0),
                retail_price: Number(v.retail_price || 0),
                sku: v.sku,
              }),
            });
          }
        }
        loadCatalog();
        setIsProductModalOpen(false);
      } else {
        showAlert(t('common.error') || 'Lỗi', t('products.update_product_failed', { error: res.message }), 'danger');
      }
    } else {
      const res = await fetchApi<Product>('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          category_id: formCategoryId,
          description: formDescription,
          image_url: formImageUrl,
          tag: formTag,
          tag_locked: formTagLocked,
          is_active: formIsActive,
          variants: formVariants.map((v) => ({
            variant_name: v.variant_name,
            cogs_price: Number(v.cogs_price),
            retail_price: Number(v.retail_price),
            sku: v.sku,
          })),
        }),
      });
      if (res.status === 'success') {
        loadCatalog();
        setIsProductModalOpen(false);
      } else {
        showAlert(t('common.error') || 'Lỗi', t('products.create_product_failed', { error: res.message }), 'danger');
      }
    }
  };

  const handleDeleteProduct = async (id: number) => {
    const isConfirmed = await confirm({
      title: t('products.confirm_delete_product') || 'Xóa món ăn này?',
      message: 'Món này và các biến thể sẽ bị xóa vĩnh viễn khỏi menu bán hàng.',
      type: 'danger',
      confirmText: t('common.delete') || 'Xóa món',
    });
    if (!isConfirmed) return;

    const res = await fetchApi(`/products/${id}`, { method: 'DELETE' });
    if (res.status === 'success') {
      loadCatalog();
    } else {
      showAlert(t('common.error') || 'Lỗi', t('products.delete_product_failed', { error: res.message }), 'danger');
    }
  };


  // ── Filtering ──────────────────────────────────────────────────────────────
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeToppings = useMemo(() => (Array.isArray(toppings) ? toppings : []), [toppings]);

  const productCountsByTag = useMemo(() => {
    const counts: Record<string, number> = {};
    safeProducts.forEach((p) => {
      if (p.tag && p.tag !== 'none') {
        counts[p.tag] = (counts[p.tag] || 0) + 1;
      }
    });
    return counts;
  }, [safeProducts]);

  const allAvailableTags = useMemo(() => {
    return customTags && customTags.length > 0 ? customTags : DEFAULT_SYSTEM_TAGS;
  }, [customTags]);

  const totalVariantsCount = useMemo(() => {
    return safeProducts.reduce((acc, p) => acc + (p.variants?.length || 0), 0);
  }, [safeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return safeProducts.filter((p) => {
      const matchesSearch =
        !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (Array.isArray(p.variants) && p.variants.some((v) => (v.sku || '').toLowerCase().includes(q)));
      const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
      const matchesTag = selectedTag === 'all' ? true : p.tag === selectedTag;
      const matchesStatus =
        selectedStatus === 'all'
          ? true
          : selectedStatus === 'active'
          ? p.is_active !== false
          : p.is_active === false;
      return matchesSearch && matchesCat && matchesTag && matchesStatus;
    });
  }, [safeProducts, searchQuery, selectedCategory, selectedTag, selectedStatus]);

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-indigo-600" />
              {t('products.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('products.subtitle')}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsTagModalOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-indigo-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs w-full sm:w-auto"
            >
              <Tag className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="truncate">Quản lý Nhãn</span>
            </button>
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs w-full sm:w-auto"
            >
              <FolderOpen className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="truncate">Quản lý Danh mục</span>
            </button>
            <button
              onClick={() => setIsToppingManagerOpen(true)}
              className="bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs w-full sm:w-auto"
            >
              <Layers className="w-4 h-4 text-violet-600 shrink-0" />
              <span className="truncate">Quản lý Topping</span>
            </button>
            <button
              onClick={() => setIsPromotionsModalOpen(true)}
              className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs w-full sm:w-auto"
            >
              <Gift className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">Khuyến mãi</span>
            </button>
            <button
              onClick={openCreateModal}
              className="col-span-2 sm:col-span-1 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">{t('products.add_product')}</span>
            </button>
          </div>
        </div>

        {/* Products Search Bar & Filter Button */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('products.search_placeholder') || 'Tìm sản phẩm theo tên, mô tả...'}
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
              selectedCategory !== null || selectedTag !== 'all' || selectedStatus !== 'all'
                ? 'bg-indigo-700 text-white shadow-sm ring-2 ring-indigo-500/30 font-extrabold'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Bộ lọc</span>
            {(selectedCategory !== null || selectedTag !== 'all' || selectedStatus !== 'all') && (
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Active Filter Chips (if any filter is selected) */}
        {(selectedCategory !== null || selectedTag !== 'all' || selectedStatus !== 'all') && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-0.5">
            <span className="text-slate-400 font-semibold text-[11px]">Đang lọc:</span>
            {selectedCategory !== null && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold">
                <span>Danh mục: {safeCategories.find((c) => c.id === selectedCategory)?.name || 'Đã chọn'}</span>
                <button type="button" onClick={() => setSelectedCategory(null)} className="hover:text-emerald-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTag !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg font-bold">
                <span>
                  Nhãn: {selectedTag === 'none' ? 'Không gắn nhãn' : allAvailableTags.find((t) => t.id === selectedTag)?.name || selectedTag}
                </span>
                <button type="button" onClick={() => setSelectedTag('all')} className="hover:text-indigo-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-bold">
                <span>Trạng thái: {selectedStatus === 'active' ? 'Đang bán' : 'Tạm ẩn'}</span>
                <button type="button" onClick={() => setSelectedStatus('all')} className="hover:text-slate-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                setSelectedTag('all');
                setSelectedStatus('all');
              }}
              className="text-rose-600 hover:text-rose-700 font-bold text-[11px] ml-1 underline cursor-pointer"
            >
              Xóa tất cả
            </button>
          </div>
        )}

        {/* Popup Filter Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-6 border border-slate-100">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                    <Filter className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">Bộ Lọc Sản Phẩm</h3>
                    <p className="text-xs text-slate-400">Tùy chọn danh mục, nhãn và trạng thái hiển thị</p>
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
                    📂 Danh Mục Sản Phẩm ({safeCategories.length})
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(null)}
                      className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        selectedCategory === null
                          ? 'bg-emerald-800 text-white shadow-sm font-black ring-2 ring-emerald-600/30'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>{t('common.all')}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedCategory === null ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {safeProducts.length}
                      </span>
                    </button>
                    {safeCategories.map((cat) => {
                      const count = safeProducts.filter((p) => p.category_id === cat.id).length;
                      const isSelected = selectedCategory === cat.id;
                      const catImg = getImageUrl(cat.image_url);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
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
                      onClick={() => setSelectedTag('all')}
                      className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        selectedTag === 'all'
                          ? 'bg-slate-900 text-white font-extrabold shadow-sm ring-1 ring-slate-700'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>{t('products.filter_all_tags') || 'Tất cả nhãn'}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedTag === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {safeProducts.filter((p) => selectedCategory === null || p.category_id === selectedCategory).length}
                      </span>
                    </button>
                    {allAvailableTags.map((tg) => {
                      const count = safeProducts.filter(
                        (p) => p.tag === tg.id && (selectedCategory === null || p.category_id === selectedCategory)
                      ).length;
                      const isSelected = selectedTag === tg.id;
                      return (
                        <button
                          key={tg.id}
                          type="button"
                          onClick={() => setSelectedTag(isSelected ? 'all' : tg.id)}
                          className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                            isSelected
                              ? 'bg-slate-900 text-white font-extrabold shadow-sm ring-1 ring-slate-700'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span>{tg.icon}</span>
                          <span>{tg.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isSelected ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedTag(selectedTag === 'none' ? 'all' : 'none')}
                      className={`px-3.5 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        selectedTag === 'none'
                          ? 'bg-slate-900 text-white font-extrabold shadow-sm ring-1 ring-slate-700'
                          : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>Không gắn nhãn</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        selectedTag === 'none' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {safeProducts.filter((p) => (!p.tag || p.tag === 'none') && (selectedCategory === null || p.category_id === selectedCategory)).length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Divider Ngăn Cách */}
                <hr className="border-slate-100" />

                {/* Section 3: Trạng Thái (Wrap) */}
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                    ⚡ Trạng Thái Kinh Doanh
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('all')}
                      className={`px-3.5 py-2 rounded-xl font-bold transition whitespace-nowrap cursor-pointer shadow-2xs ${
                        selectedStatus === 'all'
                          ? 'bg-white text-slate-900 border-2 border-slate-800 shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span>{t('products.filter_all_status') || 'Tất cả trạng thái'}</span>
                      <span className="ml-1 text-[10px] opacity-75">({safeProducts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('active')}
                      className={`px-3.5 py-2 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs ${
                        selectedStatus === 'active'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>{t('products.status_selling') || 'Đang bán'}</span>
                      <span className="text-[10px] opacity-85">({safeProducts.filter((p) => p.is_active !== false).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStatus('inactive')}
                      className={`px-3.5 py-2 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 shadow-2xs ${
                        selectedStatus === 'inactive'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span>{t('products.status_hidden') || 'Tạm ẩn'}</span>
                      <span className="text-[10px] opacity-85">({safeProducts.filter((p) => p.is_active === false).length})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSelectedTag('all');
                    setSelectedStatus('all');
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer px-3 py-2.5 rounded-xl border border-slate-200 sm:border-transparent text-center justify-center flex items-center"
                >
                  Đặt lại bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer text-center justify-center flex items-center"
                >
                  Áp dụng ({filteredProducts.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Table & Mobile Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* 1. Desktop Table (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('products.item')}</th>
                  <th className="py-3 px-4">{t('products.category')}</th>
                  <th className="py-3 px-4">{t('products.variants_pricing')}</th>
                  <th className="py-3 px-4">{t('products.cogs_vs_retail')}</th>
                  <th className="py-3 px-4">{t('products.margin')}</th>
                  <th className="py-3 px-4 text-center">{t('products.product_status')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-200" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 bg-slate-200 rounded w-28" />
                            <div className="h-2.5 bg-slate-100 rounded w-16" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4"><div className="h-3 bg-slate-200 rounded w-20" /></td>
                      <td className="py-3 px-4"><div className="h-3 bg-slate-200 rounded w-24" /></td>
                      <td className="py-3 px-4"><div className="h-3 bg-slate-200 rounded w-28" /></td>
                      <td className="py-3 px-4"><div className="h-3 bg-slate-200 rounded w-16" /></td>
                      <td className="py-3 px-4 text-center"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                      <td className="py-3 px-4 text-right"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {t('products.no_items')}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const variants = product.variants || [];
                    const minRetail = variants.length > 0 ? Math.min(...variants.map(v => v.retail_price)) : 0;
                    const maxRetail = variants.length > 0 ? Math.max(...variants.map(v => v.retail_price)) : 0;
                    const avgCogs = variants.length > 0 ? variants.reduce((acc, v) => acc + v.cogs_price, 0) / variants.length : 0;
                    const avgRetail = variants.length > 0 ? variants.reduce((acc, v) => acc + v.retail_price, 0) / variants.length : 0;
                    const margin = avgRetail > 0 ? ((avgRetail - avgCogs) / avgRetail) * 100 : 0;

                    return (
                      <tr key={product.id} className={`hover:bg-slate-50 transition ${product.is_active === false ? 'opacity-60 bg-slate-50/50' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                              {getImageUrl(product.image_url) ? (
                                <img src={getImageUrl(product.image_url)!} alt={product.name} className="w-full h-full object-cover" />
                              ) : (
                                <Coffee className="w-5 h-5 text-slate-400" />
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                                <span className={product.is_active === false ? 'line-through text-slate-500' : ''}>{product.name}</span>
                                {product.tag && product.tag !== 'none' && (() => {
                                  const style = getTagBadgeStyle(product.tag, customTags);
                                  return (
                                    <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${style.badgeClasses}`}>
                                      <span>{style.icon}</span>
                                      <span>{style.name}</span>
                                      {product.tag_locked && (
                                        <span title="Đã khóa nhãn thủ công">
                                          <Lock className="w-2.5 h-2.5 text-amber-500" />
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()}
                                {product.tag_locked && (!product.tag || product.tag === 'none') && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 inline-flex items-center gap-1 border border-slate-200" title="Khóa không gắn nhãn">
                                    <Lock className="w-2.5 h-2.5 text-amber-500" /> Khóa
                                  </span>
                                )}
                              </div>
                              <span className="text-slate-400 text-[11px] truncate max-w-xs block">
                                {product.description || t('products.no_description')}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {product.category?.name || t('products.unassigned')}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {variants.map((v) => (
                              <span key={v.id || v.variant_name} className="bg-slate-100 text-slate-700 text-[11px] px-2 py-0.5 rounded border border-slate-200">
                                {v.variant_name}: <strong className="text-indigo-600">{formatCurrency(v.retail_price, settings)}</strong>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 font-semibold">
                            {formatCurrency(minRetail, settings)}{maxRetail > minRetail ? ` – ${formatCurrency(maxRetail, settings)}` : ''}
                          </div>
                          <div className="text-slate-400 text-[11px]">
                            {t('products.avg_cogs', { amount: formatCurrency(avgCogs, settings) })}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              margin >= 60
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : margin >= 40
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                          >
                            {margin.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(product)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              product.is_active !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                            title={product.is_active !== false ? 'Bấm để tạm dừng bán' : 'Bấm để mở bán lại'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${product.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {product.is_active !== false ? t('products.status_selling') : t('products.status_hidden')}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title={t('common.edit')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 2. Mobile Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/2" />
                      <div className="h-3 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t('products.no_items')}
              </div>
            ) : (
              filteredProducts.map((product) => {
                const variants = product.variants || [];
                const minRetail = variants.length > 0 ? Math.min(...variants.map(v => v.retail_price)) : 0;
                const maxRetail = variants.length > 0 ? Math.max(...variants.map(v => v.retail_price)) : 0;
                const avgCogs = variants.length > 0 ? variants.reduce((acc, v) => acc + v.cogs_price, 0) / variants.length : 0;
                const avgRetail = variants.length > 0 ? variants.reduce((acc, v) => acc + v.retail_price, 0) / variants.length : 0;
                const margin = avgRetail > 0 ? ((avgRetail - avgCogs) / avgRetail) * 100 : 0;

                return (
                  <div
                    key={product.id}
                    className={`p-4 space-y-3 transition ${product.is_active === false ? 'opacity-65 bg-slate-50/60' : 'bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {getImageUrl(product.image_url) ? (
                            <img src={getImageUrl(product.image_url)!} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Coffee className="w-5 h-6 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold text-sm text-slate-900 ${product.is_active === false ? 'line-through text-slate-500' : ''}`}>
                              {product.name}
                            </span>
                            {product.tag && product.tag !== 'none' && (() => {
                              const style = getTagBadgeStyle(product.tag, customTags);
                              return (
                                <span className={`text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 ${style.badgeClasses}`}>
                                  <span>{style.icon}</span>
                                  <span>{style.name}</span>
                                  {product.tag_locked && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                                </span>
                              );
                            })()}
                            {product.tag_locked && (!product.tag || product.tag === 'none') && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 inline-flex items-center gap-1 border border-slate-200">
                                <Lock className="w-2.5 h-2.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                          <span className="text-slate-400 text-xs truncate block mt-0.5">
                            {product.category?.name || t('products.unassigned')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div className="flex flex-wrap gap-1.5">
                        {variants.map((v) => (
                          <span key={v.id || v.variant_name} className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-slate-700 font-medium">
                            {v.variant_name}: <strong className="text-indigo-600">{formatCurrency(v.retail_price, settings)}</strong>
                          </span>
                        ))}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          margin >= 60
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : margin >= 40
                            ? 'bg-amber-50 text-amber-600 border border-amber-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {margin.toFixed(1)}% LN
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-slate-50">
                      <button
                        onClick={() => openEditModal(product)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Product Form Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl my-0 sm:my-8 overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 pb-safe sm:pb-0">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {editingProduct ? t('products.edit_product') : t('products.create_product')}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="app-label">{t('products.product_name')} *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('products.product_name_placeholder')}
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="app-label">{t('products.category')} *</label>
                  <ModernSelect
                    value={formCategoryId}
                    onChange={(val) => setFormCategoryId(Number(val))}
                    options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </div>
              </div>

              <div>
                <label className="app-label">{t('products.description')}</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('products.description_placeholder')}
                  className="app-textarea"
                />
              </div>

              {/* Image Upload Row */}
              <div>
                <label className="app-label block mb-1.5">{t('products.image')}</label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {getImageUrl(formImageUrl) ? (
                      <img src={getImageUrl(formImageUrl)!} alt={t('products.image_preview')} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                    {uploadingProductImg && (
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 inline-flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5" /> {t('products.upload_image')}
                      <input type="file" accept="image/*" onChange={handleProductFileChange} className="hidden" />
                    </label>
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder={t('products.image_url_placeholder')}
                      className="app-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">{t('products.badge') || 'Huy hiệu / Nhãn sản phẩm'}</label>
                  <button
                    type="button"
                    onClick={() => setIsTagModalOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Quản lý nhãn món
                  </button>
                </div>
                <ModernSelect
                  value={formTag}
                  onChange={(val) => setFormTag(String(val))}
                  options={[
                    { value: 'none', label: t('products.badge_none') || 'Không gắn nhãn' },
                    ...allAvailableTags.map((tg) => ({
                      value: tg.id,
                      label: `${tg.icon} ${tg.name}`,
                      badge: `${tg.icon} ${tg.name}`,
                      badgeColor: (tg.color || 'emerald') as any,
                    })),
                  ]}
                />
              </div>

              {/* Active for POS Toggle Switch */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-800 text-xs block">{t('products.active_for_pos')}</label>
                  <span className="text-[11px] text-slate-500">{t('products.toggle_status_hint')}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formIsActive}
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    formIsActive ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      formIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Variants Section */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">{t('products.variants_pricing_label')}</label>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="text-indigo-600 font-semibold text-xs hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('products.add_variant')}
                  </button>
                </div>

                <div className="space-y-2">
                  {formVariants.map((v, idx) => {
                    const vMargin =
                      v.retail_price > 0
                        ? ((v.retail_price - v.cogs_price) / v.retail_price) * 100
                        : 0;

                    return (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          placeholder={t('products.variant_name_label')}
                          value={v.variant_name}
                          onChange={(e) => handleVariantChange(idx, 'variant_name', e.target.value)}
                          className="flex-1 app-input"
                          required
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            placeholder={t('products.retail_price_label')}
                            value={v.retail_price}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              handleVariantChange(idx, 'retail_price', raw === '' ? 0 : parseInt(raw, 10));
                            }}
                            className="w-28 app-input font-semibold"
                          />
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            placeholder={t('products.cogs_price_label')}
                            value={v.cogs_price}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '');
                              handleVariantChange(idx, 'cogs_price', raw === '' ? 0 : parseInt(raw, 10));
                            }}
                            className="w-28 app-input font-semibold"
                          />
                          <span className="text-[10px] font-bold text-emerald-600 w-12 text-right">
                            {vMargin.toFixed(0)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:space-x-2 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer text-center justify-center flex items-center"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition cursor-pointer text-center justify-center flex items-center"
                >
                  {t('products.save_product_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={safeCategories}
        products={safeProducts}
        onCategoriesUpdated={loadCatalog}
      />

      {/* Topping Manager Modal */}
      <ToppingManagerModal
        isOpen={isToppingManagerOpen}
        onClose={() => setIsToppingManagerOpen(false)}
        toppings={safeToppings}
        categories={safeCategories}
        onToppingsUpdated={loadToppings}
        settings={settings}
      />

      {/* Tag Manager Modal */}
      <TagManagerModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        customTags={customTags}
        onSaveTags={handleSaveTags}
        productCountsByTag={productCountsByTag}
        onOpenAutoTagging={() => {
          setIsTagModalOpen(false);
          setIsAutoTagModalOpen(true);
        }}
      />

      {/* Auto-Tagging Engine Modal */}
      <AutoTaggingModal
        isOpen={isAutoTagModalOpen}
        onClose={() => setIsAutoTagModalOpen(false)}
        customTags={customTags}
        onTagsUpdated={loadCatalog}
      />

      {/* Promotions & Discounts Manager Modal */}
      <PromotionsModal
        isOpen={isPromotionsModalOpen}
        onClose={() => setIsPromotionsModalOpen(false)}
        settings={settings}
      />
    </AppShell>
  );
}
