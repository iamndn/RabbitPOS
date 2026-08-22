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
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Popup Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [isToppingManagerOpen, setIsToppingManagerOpen] = useState<boolean>(false);
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
    return [...DEFAULT_SYSTEM_TAGS, ...customTags];
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsTagModalOpen(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-indigo-200 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Tag className="w-4 h-4 text-indigo-600" />
              <span>Quản lý Nhãn</span>
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {allAvailableTags.length}
              </span>
            </button>
            <button
              onClick={() => setIsCategoryManagerOpen(true)}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <FolderOpen className="w-4 h-4 text-emerald-600" />
              <span>Quản lý Danh mục</span>
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {safeCategories.length}
              </span>
            </button>
            <button
              onClick={() => setIsToppingManagerOpen(true)}
              className="bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-violet-200 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Layers className="w-4 h-4 text-violet-600" />
              <span>Quản lý Topping</span>
              <span className="bg-violet-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {safeToppings.length}
              </span>
            </button>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> {t('products.add_product')}
            </button>
          </div>
        </div>

        {/* KPI Metric Summary Row with Direct Clickable Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Tổng số món</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{safeProducts.length}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setIsCategoryManagerOpen(true)}
            className="bg-white hover:bg-emerald-50/40 p-3.5 rounded-2xl border border-slate-200/80 hover:border-emerald-300 shadow-2xs flex items-center justify-between transition cursor-pointer group"
            title="Nhấp để mở Quản lý Danh mục"
          >
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase group-hover:text-emerald-700">Danh mục</span>
              <div className="text-xl font-black text-slate-900 group-hover:text-emerald-600 mt-0.5">{safeCategories.length}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold transition">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Biến thể / Size</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{totalVariantsCount}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setIsToppingManagerOpen(true)}
            className="bg-white hover:bg-violet-50/40 p-3.5 rounded-2xl border border-slate-200/80 hover:border-violet-300 shadow-2xs flex items-center justify-between transition cursor-pointer group"
            title="Nhấp để mở Quản lý Topping"
          >
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase group-hover:text-violet-700">Topping</span>
              <div className="text-xl font-black text-slate-900 group-hover:text-violet-600 mt-0.5">{safeToppings.length}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-violet-50 group-hover:bg-violet-100 text-violet-600 flex items-center justify-center font-bold transition">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div
            onClick={() => setIsTagModalOpen(true)}
            className="bg-white hover:bg-indigo-50/40 p-3.5 rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs col-span-2 sm:col-span-1 flex items-center justify-between transition cursor-pointer group"
            title="Nhấp để mở Quản lý Nhãn"
          >
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase group-hover:text-indigo-700">Nhãn món (Tags)</span>
              <div className="text-xl font-black text-indigo-600 mt-0.5">{allAvailableTags.length}</div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold transition">
              <Tag className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t('products.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="app-input pl-9 pr-4"
              />
            </div>

            {/* Tag Filter */}
            <div className="w-full sm:w-52">
              <ModernSelect
                value={selectedTag}
                onChange={(val) => setSelectedTag(String(val))}
                options={[
                  { value: 'all', label: t('products.filter_all_tags') || 'Tất cả nhãn' },
                  ...allAvailableTags.map((tg) => ({
                    value: tg.id,
                    label: `${tg.icon} ${tg.name}`,
                    badge: `${tg.icon} ${tg.name}`,
                    badgeColor: (tg.color || 'emerald') as any,
                  })),
                  { value: 'none', label: 'Không gắn nhãn' },
                ]}
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-40">
              <ModernSelect
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(String(val))}
                options={[
                  { value: 'all', label: t('products.filter_all_status') || 'Tất cả trạng thái' },
                  { value: 'active', label: t('products.status_selling') || 'Đang bán', badge: 'Bật', badgeColor: 'emerald' },
                  { value: 'inactive', label: t('products.status_hidden') || 'Tạm ẩn', badge: 'Ẩn', badgeColor: 'slate' },
                ]}
              />
            </div>
          </div>

          <div className="flex overflow-x-auto space-x-1.5 pb-1 scrollbar-none no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition cursor-pointer ${
                selectedCategory === null
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {t('common.all')} ({safeProducts.length})
            </button>
            {safeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {cat.name} ({safeProducts.filter((p) => p.category_id === cat.id).length})
              </button>
            ))}
          </div>
        </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl my-8 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? t('products.edit_product') : t('products.create_product')}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
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

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
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
    </AppShell>
  );
}
