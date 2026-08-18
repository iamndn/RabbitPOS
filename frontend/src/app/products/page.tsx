'use client';

import React, { useEffect, useState } from 'react';
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

  const loadCatalog = async () => {
    setLoading(true);

    // Load settings for currency formatting
    const settingsRes = await fetchApi<any>('/settings');
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

    const catRes = await fetchApi<Category[]>('/categories');
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
    setFormVariants(
      product.variants && product.variants.length > 0
        ? product.variants
        : [{ variant_name: 'Default', cogs_price: 0, retail_price: 0, sku: '' }]
    );
    setIsProductModalOpen(true);
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
    if (!confirm('Xác nhận xóa topping này?')) return;
    const res = await fetchApi(`/toppings/${id}`, { method: 'DELETE' });
    if (res.status === 'success') await loadToppings();
    else alert('Xóa topping thất bại: ' + res.message);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────
  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeToppings = Array.isArray(toppings) ? toppings : [];

  const filteredProducts = safeProducts.filter((p) => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(p.variants) && p.variants.some((v) => (v.sku || '').toLowerCase().includes(searchQuery.toLowerCase())));
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    return matchesSearch && matchesCat;
  });

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
          <div className="flex items-center space-x-2">
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
              {/* Add Topping Button */}
              <div className="px-5 py-3 border-b border-slate-100 flex justify-end">
                <button
                  onClick={openCreateToppingModal}
                  className="bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('products.add_topping')}
                </button>
              </div>

              {/* Topping Table */}
              {safeToppings.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t('products.no_toppings')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Table Header */}
                  <div className="grid grid-cols-5 gap-2 px-5 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="col-span-2">{t('products.topping_name')}</span>
                    <span>{t('products.topping_price')}</span>
                    <span>{t('products.topping_category')}</span>
                    <span className="text-right">{t('common.actions')}</span>
                  </div>
                  {safeToppings.map((tp) => (
                    <div key={tp.id} className="grid grid-cols-5 gap-2 px-5 py-3 items-center hover:bg-slate-50 transition">
                      <div className="col-span-2 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tp.is_active ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                        <span className="text-sm font-semibold text-slate-800">{tp.name}</span>
                      </div>
                      <span className="text-sm text-indigo-600 font-bold">{formatCurrency(tp.price, settings)}</span>
                      <span className="text-xs text-slate-500">
                        {tp.category_id
                          ? safeCategories.find((c) => c.id === tp.category_id)?.name || `#${tp.category_id}`
                          : <span className="italic text-slate-400">{t('products.global')}</span>
                        }
                      </span>
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
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('products.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="flex overflow-x-auto w-full sm:w-auto space-x-1.5 pb-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                selectedCategory === null
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {t('common.all')}
            </button>
            {safeCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {cat.name}
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
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
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
                      <tr key={product.id} className="hover:bg-slate-50 transition">
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
                                {product.name}
                                {product.tag && product.tag !== 'none' && (
                                  <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                    {product.tag === 'best_seller'
                                      ? t('products.best_seller')
                                      : product.tag === 'new'
                                      ? t('products.new')
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
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
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
                <select
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">{t('products.none')}</option>
                  <option value="best_seller">{t('products.best_seller')}</option>
                  <option value="new">{t('products.new')}</option>
                </select>
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
                <select
                  value={toppingForm.category_id ?? ''}
                  onChange={(e) => setToppingForm({ ...toppingForm, category_id: e.target.value === '' ? null : Number(e.target.value) })}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm bg-white"
                >
                  <option value="">{t('products.topping_global')}</option>
                  {safeCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Is Active */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-semibold text-slate-700">{t('products.is_active')}</span>
                <button
                  type="button"
                  onClick={() => setToppingForm({ ...toppingForm, is_active: !toppingForm.is_active })}
                  className={`w-10 h-5 rounded-full transition-colors ${toppingForm.is_active ? 'bg-violet-600' : 'bg-slate-300'} relative`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${toppingForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
