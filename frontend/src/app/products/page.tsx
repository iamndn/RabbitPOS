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
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, getImageUrl, uploadImage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';

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
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Category Management Panel
  const [catPanelOpen, setCatPanelOpen] = useState<boolean>(false);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [isToppingModalOpen, setIsToppingModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTopping, setEditingTopping] = useState<Topping | null>(null);

  // Topping Panel
  const [toppingPanelOpen, setToppingPanelOpen] = useState<boolean>(false);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [toppingForm, setToppingForm] = useState({ name: '', price: 0, cogs: 0, category_id: null as number | null, is_active: true });

  // Product Form State
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<number>(0);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImageUrl, setFormImageUrl] = useState<string>('');
  const [formTag, setFormTag] = useState<string>('none');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([
    { variant_name: 'Size M', cogs_price: 1.0, retail_price: 3.5, sku: '' },
  ]);

  // Category Form State
  const [catName, setCatName] = useState<string>('');
  const [catImageUrl, setCatImageUrl] = useState<string>('');
  const [catDisplayOrder, setCatDisplayOrder] = useState<number>(1);

  // Upload states
  const [uploadingProductImg, setUploadingProductImg] = useState<boolean>(false);
  const [uploadingCatImg, setUploadingCatImg] = useState<boolean>(false);

  const handleProductFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProductImg(true);
    const res = await uploadImage(file);
    if (res.status === 'success' && res.data?.url) {
      setFormImageUrl(res.data.url);
    } else {
      alert(res.message || 'Failed to upload image');
    }
    setUploadingProductImg(false);
  };

  const handleCatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCatImg(true);
    const res = await uploadImage(file);
    if (res.status === 'success' && res.data?.url) {
      setCatImageUrl(res.data.url);
    } else {
      alert(res.message || 'Failed to upload image');
    }
    setUploadingCatImg(false);
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
        if (Array.isArray(settingsRes.data)) {
          const map: SettingsMap = {};
          settingsRes.data.forEach((s: any) => {
            if (s && s.key) {
              map[s.key] = s.value;
            }
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
        alert(t('products.update_failed', { message: res.message }));
      }
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: product.is_active } : p))
      );
      alert(t('products.update_failed', { message: err?.message }));
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
          is_active: formIsActive,
        }),
      });
      if (res.status === 'success') {
        loadCatalog();
        setIsProductModalOpen(false);
      } else {
        alert(t('products.update_product_failed', { error: res.message }));
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
        alert(t('products.create_product_failed', { error: res.message }));
      }
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm(t('products.confirm_delete_product'))) return;
    const res = await fetchApi(`/products/${id}`, { method: 'DELETE' });
    if (res.status === 'success') {
      loadCatalog();
    } else {
      alert(t('products.delete_product_failed', { error: res.message }));
    }
  };

  // ── Category Modal Helpers ─────────────────────────────────────────────────
  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatImageUrl('');
    setCatDisplayOrder(categories.length + 1);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatImageUrl(cat.image_url || '');
    setCatDisplayOrder(cat.display_order);
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;

    if (editingCategory) {
      const res = await fetchApi<Category>(`/categories/${editingCategory.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: catName,
          image_url: catImageUrl,
          display_order: Number(catDisplayOrder),
        }),
      });
      if (res.status === 'success') {
        loadCatalog();
        setIsCategoryModalOpen(false);
      } else {
        alert(t('products.update_cat_failed', { error: res.message }));
      }
    } else {
      const res = await fetchApi<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catName,
          image_url: catImageUrl,
          display_order: Number(catDisplayOrder),
        }),
      });
      if (res.status === 'success') {
        loadCatalog();
        setIsCategoryModalOpen(false);
      } else {
        alert(t('products.create_cat_failed', { error: res.message }));
      }
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm(t('products.confirm_delete_category'))) return;
    const res = await fetchApi(`/categories/${id}`, { method: 'DELETE' });
    if (res.status === 'success') {
      loadCatalog();
    } else {
      alert(t('products.delete_cat_failed', { error: res.message }));
    }
  };

  // ── Topping Handlers ──────────────────────────────────────────────────────
  const openCreateToppingModal = () => {
    setEditingTopping(null);
    setToppingForm({ name: '', price: 0, cogs: 0, category_id: null, is_active: true });
    setIsToppingModalOpen(true);
  };

  const openEditToppingModal = (topping: Topping) => {
    setEditingTopping(topping);
    setToppingForm({ name: topping.name, price: topping.price, cogs: topping.cogs, category_id: topping.category_id, is_active: topping.is_active });
    setIsToppingModalOpen(true);
  };

  const handleSaveTopping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toppingForm.name) return;

    const payload = {
      name: toppingForm.name,
      price: Number(toppingForm.price),
      cogs: Number(toppingForm.cogs) || 0,
      category_id: toppingForm.category_id || null,
      is_active: toppingForm.is_active,
    };

    if (editingTopping) {
      const res = await fetchApi<Topping>(`/toppings/${editingTopping.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (res.status === 'success') { await loadToppings(); setIsToppingModalOpen(false); }
      else alert('Cập nhật topping thất bại: ' + res.message);
    } else {
      const res = await fetchApi<Topping>('/toppings', { method: 'POST', body: JSON.stringify(payload) });
      if (res.status === 'success') { await loadToppings(); setIsToppingModalOpen(false); }
      else alert('Tạo topping thất bại: ' + res.message);
    }
  };

  const handleDeleteTopping = async (id: number) => {
    if (!confirm(t('products.confirm_delete_topping'))) return;
    const res = await fetchApi(`/toppings/${id}`, { method: 'DELETE' });
    if (res.status === 'success') await loadToppings();
    else alert('Xóa topping thất bại: ' + res.message);
  };

  const handleToggleToppingStatus = async (topping: Topping) => {
    const newStatus = !topping.is_active;
    const res = await fetchApi<Topping>(`/toppings/${topping.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: topping.name,
        price: Number(topping.price),
        cogs: Number(topping.cogs) || 0,
        category_id: topping.category_id,
        is_active: newStatus,
      }),
    });
    if (res.status === 'success') {
      setToppings((prev) => prev.map((tp) => (tp.id === topping.id ? { ...tp, is_active: newStatus } : tp)));
    } else {
      alert('Cập nhật trạng thái thất bại: ' + res.message);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products]);
  const safeCategories = useMemo(() => (Array.isArray(categories) ? categories : []), [categories]);
  const safeToppings = useMemo(() => (Array.isArray(toppings) ? toppings : []), [toppings]);

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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
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
              onClick={openCreateToppingModal}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Layers className="w-4 h-4 text-violet-500" /> + {t('products.add_topping')}
            </button>
            <button
              onClick={openCreateCategoryModal}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <FolderPlus className="w-4 h-4 text-slate-500" /> + {t('products.add_category')}
            </button>
            <button
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('products.add_product')}
            </button>
          </div>
        </div>

        {/* Category Management Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setCatPanelOpen(!catPanelOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-500" />
              {t('products.manage_categories')}
              <span className="bg-indigo-50 text-indigo-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                {safeCategories.length}
              </span>
            </span>
            {catPanelOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {catPanelOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {safeCategories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {t('products.no_categories')}
                </p>
              ) : (
                safeCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                        {getImageUrl(cat.image_url) ? (
                          <img
                            src={getImageUrl(cat.image_url)!}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FolderOpen className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-800">{cat.name}</span>
                        <span className="ml-2 text-xs text-slate-400">
                          #{cat.display_order} · {t('pos.items_count', { count: safeProducts.filter((p) => p.category_id === cat.id).length })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCategoryModal(cat)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title={t('products.edit_category')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title={t('products.delete_category')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Topping Management Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setToppingPanelOpen(!toppingPanelOpen)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet-500" />
              {t('products.manage_toppings')}
              <span className="bg-violet-50 text-violet-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-violet-200">
                {safeToppings.length}
              </span>
            </span>
            {toppingPanelOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {toppingPanelOpen && (
            <div className="border-t border-slate-100">
              {/* Topping Table */}
              {safeToppings.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t('products.no_toppings')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Table Header */}
                  <div className="grid grid-cols-6 gap-2 px-5 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="col-span-2">{t('products.topping_name')}</span>
                    <span>{t('products.topping_price')}</span>
                    <span>{t('products.topping_category')}</span>
                    <span className="text-center">{t('common.status')}</span>
                    <span className="text-right">{t('common.actions')}</span>
                  </div>
                  {safeToppings.map((tp) => (
                    <div key={tp.id} className="grid grid-cols-6 gap-2 px-5 py-3 items-center hover:bg-slate-50 transition">
                      <div className="col-span-2 flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tp.is_active ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-slate-300'}`} />
                        <span className={`text-sm font-semibold ${tp.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{tp.name}</span>
                      </div>
                      <span className="text-sm text-indigo-600 font-bold">{formatCurrency(tp.price, settings)}</span>
                      <span className="text-xs text-slate-500">
                        {tp.category_id
                          ? safeCategories.find((c) => c.id === tp.category_id)?.name || `#${tp.category_id}`
                          : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{t('products.global')}</span>
                        }
                      </span>
                      {/* Interactive On/Off Quick Toggle Button */}
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleToggleToppingStatus(tp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                            tp.is_active
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-sm'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                          }`}
                          title={tp.is_active ? 'Bấm để Tắt' : 'Bấm để Bật'}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${tp.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {tp.is_active ? t('common.active') : t('common.inactive')}
                        </button>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditToppingModal(tp)}
                          className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                          title={t('products.edit_topping')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTopping(tp.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title={t('products.delete_topping')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t('products.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-2xs"
              />
            </div>

            {/* Tag Filter */}
            <div className="w-full sm:w-44">
              <ModernSelect
                value={selectedTag}
                onChange={(val) => setSelectedTag(String(val))}
                options={[
                  { value: 'all', label: t('products.filter_all_tags') || 'Tất cả nhãn' },
                  { value: 'featured', label: t('products.badge_featured') || '⭐ Nổi bật', badge: '⭐ Nổi bật', badgeColor: 'amber' },
                  { value: 'best_seller', label: t('products.badge_bestseller') || '🔥 Bán chạy', badge: '🔥 Bán chạy', badgeColor: 'rose' },
                  { value: 'new', label: t('products.badge_new') || '✨ Món mới', badge: '✨ Món mới', badgeColor: 'emerald' },
                  { value: 'coming_soon', label: t('products.badge_comingsoon') || '⏳ Sắp ra mắt', badge: '⏳ Sắp ra mắt', badgeColor: 'indigo' },
                  { value: 'suspended', label: t('products.badge_suspended') || '⛔ Tạm ngưng', badge: '⛔ Tạm ngưng', badgeColor: 'slate' },
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

          <div className="flex overflow-x-auto space-x-1.5 pb-1">
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

        {/* Products Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
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
                                {product.tag && product.tag !== 'none' && (
                                  <span
                                    className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${
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
                                      ? '⭐ ' + t('products.featured')
                                      : product.tag === 'best_seller'
                                      ? '🔥 ' + t('products.best_seller')
                                      : product.tag === 'new'
                                      ? '✨ ' + t('products.new')
                                      : product.tag === 'coming_soon'
                                      ? '⏳ ' + t('products.coming_soon')
                                      : product.tag === 'suspended'
                                      ? '⛔ ' + t('products.suspended')
                                      : product.tag.replace('_', ' ')}
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
                        {/* Interactive POS On/Off Quick Toggle Button */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(product)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              product.is_active !== false
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-2xs'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title={product.is_active !== false ? 'Bấm để tắt hiển thị trên POS' : 'Bấm để bật hiển thị trên POS'}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${product.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {product.is_active !== false ? t('products.status_selling') : t('products.status_hidden')}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title={t('products.edit_product')}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
        </div>
      </div>

      {/* Product Form Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-lg text-slate-900">
                {editingProduct ? t('products.edit_product') : t('products.create_product')}
              </h2>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">
                    {t('products.product_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('products.product_name_placeholder')}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 mb-1 block">
                    {t('products.category')} *
                  </label>
                  <ModernSelect
                    value={formCategoryId}
                    placeholder="Chọn danh mục..."
                    onChange={(val) => setFormCategoryId(Number(val))}
                    options={categories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                      icon: <FolderOpen className="w-3.5 h-3.5 text-indigo-500" />,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.description')}</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('products.description_placeholder')}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.image_url')}</label>
                <div className="flex items-center space-x-3">
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
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 inline-flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5" /> {t('products.upload_image')}
                      <input type="file" accept="image/*" onChange={handleProductFileChange} className="hidden" />
                    </label>
                    <input
                      type="text"
                      value={formImageUrl}
                      onChange={(e) => setFormImageUrl(e.target.value)}
                      placeholder={t('products.image_url_placeholder')}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.badge')}</label>
                <ModernSelect
                  value={formTag}
                  onChange={(val) => setFormTag(String(val))}
                  options={[
                    { value: 'none', label: t('products.badge_none') || 'Không gắn nhãn' },
                    { value: 'featured', label: t('products.badge_featured') || '⭐ Nổi bật', badge: '⭐ Nổi bật', badgeColor: 'amber' },
                    { value: 'best_seller', label: t('products.badge_bestseller') || '🔥 Bán chạy', badge: '🔥 Bán chạy', badgeColor: 'rose' },
                    { value: 'new', label: t('products.badge_new') || '✨ Món mới', badge: '✨ Món mới', badgeColor: 'emerald' },
                    { value: 'coming_soon', label: t('products.badge_comingsoon') || '⏳ Sắp ra mắt', badge: '⏳ Sắp ra mắt', badgeColor: 'indigo' },
                    { value: 'suspended', label: t('products.badge_suspended') || '⛔ Tạm ngưng', badge: '⛔ Tạm ngưng', badgeColor: 'slate' },
                  ]}
                />
              </div>

              {/* Active for POS Toggle Switch */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-800 text-xs block">{t('products.active_for_pos')}</label>
                  <span className="text-[11px] text-slate-500">{t('products.toggle_status_hint')}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Variants Section (Create only) */}
              {!editingProduct && (
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
                            className="flex-1 p-2 border border-slate-200 rounded-lg text-xs"
                            required
                          />
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input
                              type="number"
                              step="1000"
                              min="0"
                              placeholder={t('products.retail_price_label')}
                              value={v.retail_price === 0 ? '' : v.retail_price}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                handleVariantChange(idx, 'retail_price', raw === '' ? 0 : parseInt(raw, 10));
                              }}
                              className="w-28 p-2 border border-slate-200 rounded-lg text-xs font-semibold"
                              required
                            />
                            <input
                              type="number"
                              step="1000"
                              min="0"
                              placeholder={t('products.cogs_price_label')}
                              value={v.cogs_price === 0 ? '' : v.cogs_price}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                handleVariantChange(idx, 'cogs_price', raw === '' ? 0 : parseInt(raw, 10));
                              }}
                              className="w-28 p-2 border border-slate-200 rounded-lg text-xs font-semibold"
                              required
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
              )}

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

      {/* Category Form Modal (Create & Edit) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-lg text-slate-900">
                {editingCategory ? t('products.edit_category') : t('products.add_category')}
              </h2>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.category_name')} *</label>
                <input
                  type="text"
                  required
                  placeholder={t('products.category_name_placeholder')}
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.image_url')}</label>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative">
                    {getImageUrl(catImageUrl) ? (
                      <img src={getImageUrl(catImageUrl)!} alt={t('products.image_preview')} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                    {uploadingCatImg && (
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 inline-flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5" /> {t('products.upload_image')}
                      <input type="file" accept="image/*" onChange={handleCatFileChange} className="hidden" />
                    </label>
                    <input
                      type="text"
                      value={catImageUrl}
                      onChange={(e) => setCatImageUrl(e.target.value)}
                      placeholder={t('products.image_url_placeholder')}
                      className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('products.display_order')}</label>
                <input
                  type="number"
                  value={catDisplayOrder === 0 ? '' : catDisplayOrder}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setCatDisplayOrder(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
                >
                  {editingCategory ? t('products.save_category_btn') : t('products.create_category_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Topping Create/Edit Modal ─────────────────────────────────── */}
      {isToppingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-600" />
                {editingTopping ? t('products.edit_topping') : t('products.create_topping_title')}
              </h3>
              <button onClick={() => setIsToppingModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTopping} className="space-y-4 text-sm">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('products.topping_name')} *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Trân châu trắng"
                  value={toppingForm.name}
                  onChange={(e) => setToppingForm({ ...toppingForm, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Retail Price */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('products.topping_price')} *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="500"
                    value={toppingForm.price === 0 ? '' : toppingForm.price}
                    onChange={(e) => setToppingForm({ ...toppingForm, price: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
                {/* COGS */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('products.topping_cogs')}</label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={toppingForm.cogs === 0 ? '' : toppingForm.cogs}
                    onChange={(e) => setToppingForm({ ...toppingForm, cogs: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">{t('products.topping_category')}</label>
                <ModernSelect
                  value={toppingForm.category_id ?? ''}
                  placeholder={t('products.topping_global')}
                  clearable={true}
                  onChange={(val) => setToppingForm({ ...toppingForm, category_id: val === '' || val === null ? null : Number(val) })}
                  options={[
                    { value: '', label: t('products.topping_global'), badge: 'Toàn cục', badgeColor: 'indigo' },
                    ...safeCategories.map((cat) => ({
                      value: cat.id,
                      label: cat.name,
                      icon: <FolderOpen className="w-3.5 h-3.5 text-slate-400" />,
                    })),
                  ]}
                />
              </div>

              {/* Is Active On/Off Switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <span className="block text-xs font-bold text-slate-800 uppercase tracking-wide">{t('products.is_active')}</span>
                  <span className="text-[11px] text-slate-500">
                    {toppingForm.is_active ? 'Topping đang BẬT (sẵn sàng phục vụ)' : 'Topping đang TẮT (tạm hết)'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toppingForm.is_active}
                  onClick={() => setToppingForm({ ...toppingForm, is_active: !toppingForm.is_active })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
                    toppingForm.is_active ? 'bg-violet-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                      toppingForm.is_active ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsToppingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-sm"
                >
                  {editingTopping ? t('products.save_topping_btn') : t('products.create_topping_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
