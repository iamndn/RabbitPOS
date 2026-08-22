'use client';

import React, { useEffect, useState } from 'react';
import {
  Tag,
  Plus,
  Search,
  Percent,
  Gift,
  Coins,
  Edit2,
  Trash2,
  X,
  Check,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  Filter,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';

export type PromoType = 'discount_amount' | 'discount_percent' | 'gift_item';
export type PromoScope = 'all' | 'category' | 'product';

export interface Promotion {
  id: number;
  name: string;
  promo_type: PromoType;
  discount_value: number;
  min_order_amount: number;
  min_quantity: number;
  scope: PromoScope;
  target_ids: string;
  gift_product_variant_id?: number | null;
  gift_variant?: {
    id: number;
    variant_name: string;
    retail_price: number;
  };
  start_date?: string | null;
  end_date?: string | null;
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
  created_at?: string;
}

interface Category {
  id: number;
  name: string;
}

interface ProductVariant {
  id: number;
  variant_name: string;
  retail_price: number;
}

interface Product {
  id: number;
  name: string;
  category_id: number;
  variants: ProductVariant[];
}

export default function PromotionsPage() {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<PromoType>('discount_amount');
  const [formValue, setFormValue] = useState<number>(10000);
  const [formMinOrderAmount, setFormMinOrderAmount] = useState<number>(0);
  const [formMinQuantity, setFormMinQuantity] = useState<number>(0);
  const [formScope, setFormScope] = useState<PromoScope>('all');
  const [formTargetIds, setFormTargetIds] = useState<number[]>([]);
  const [formGiftVariantId, setFormGiftVariantId] = useState<number | null>(null);
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formUsageLimit, setFormUsageLimit] = useState<number>(0);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

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

    const [promoRes, catRes, prodRes] = await Promise.all([
      fetchApi<Promotion[]>('/promotions'),
      fetchApi<Category[]>('/categories'),
      fetchApi<Product[]>('/products'),
    ]);

    if (promoRes.status === 'success' && Array.isArray(promoRes.data)) {
      setPromotions(promoRes.data);
    }
    if (catRes.status === 'success' && Array.isArray(catRes.data)) {
      setCategories(catRes.data);
    }
    if (prodRes.status === 'success' && Array.isArray(prodRes.data)) {
      setProducts(prodRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingPromo(null);
    setFormName('');
    setFormType('discount_amount');
    setFormValue(10000);
    setFormMinOrderAmount(0);
    setFormMinQuantity(0);
    setFormScope('all');
    setFormTargetIds([]);
    setFormGiftVariantId(null);
    setFormStartDate('');
    setFormEndDate('');
    setFormUsageLimit(0);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormName(promo.name);
    setFormType(promo.promo_type);
    setFormValue(promo.discount_value);
    setFormMinOrderAmount(promo.min_order_amount);
    setFormMinQuantity(promo.min_quantity);
    setFormScope(promo.scope);

    let parsedIds: number[] = [];
    try {
      if (promo.target_ids) {
        parsedIds = JSON.parse(promo.target_ids);
      }
    } catch {
      parsedIds = [];
    }
    setFormTargetIds(parsedIds);
    setFormGiftVariantId(promo.gift_product_variant_id || null);

    setFormStartDate(promo.start_date ? promo.start_date.substring(0, 16) : '');
    setFormEndDate(promo.end_date ? promo.end_date.substring(0, 16) : '');
    setFormUsageLimit(promo.usage_limit);
    setFormIsActive(promo.is_active);
    setIsModalOpen(true);
  };

  const handleSavePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    const payload = {
      name: formName,
      promo_type: formType,
      discount_value: Number(formValue) || 0,
      min_order_amount: Number(formMinOrderAmount) || 0,
      min_quantity: Number(formMinQuantity) || 0,
      scope: formScope,
      target_ids: formTargetIds,
      gift_product_variant_id: formType === 'gift_item' ? formGiftVariantId : null,
      start_date: formStartDate ? new Date(formStartDate).toISOString() : null,
      end_date: formEndDate ? new Date(formEndDate).toISOString() : null,
      usage_limit: Number(formUsageLimit) || 0,
      is_active: formIsActive,
    };

    if (editingPromo) {
      const res = await fetchApi<Promotion>(`/promotions/${editingPromo.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (res.status === 'success') {
        await loadData();
        setIsModalOpen(false);
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to update promotion', 'danger');
      }
    } else {
      const res = await fetchApi<Promotion>('/promotions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.status === 'success') {
        await loadData();
        setIsModalOpen(false);
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to create promotion', 'danger');
      }
    }
  };

  const handleDeletePromotion = async (id: number) => {
    const isConfirmed = await confirm({
      title: t('promotions.confirm_delete') || 'Xóa chương trình khuyến mãi?',
      message: 'Chương trình này sẽ bị xóa và không thể áp dụng cho các đơn hàng tiếp theo.',
      type: 'danger',
      confirmText: t('common.delete') || 'Xóa khuyến mãi',
    });
    if (!isConfirmed) return;

    const res = await fetchApi(`/promotions/${id}`, { method: 'DELETE' });
    if (res.status === 'success') {
      loadData();
    } else {
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to delete promotion', 'danger');
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    const newStatus = !promo.is_active;
    const res = await fetchApi<Promotion>(`/promotions/${promo.id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: newStatus }),
    });
    if (res.status === 'success') {
      setPromotions((prev) =>
        prev.map((p) => (p.id === promo.id ? { ...p, is_active: newStatus } : p))
      );
    } else {
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to toggle status', 'danger');
    }
  };

  const toggleTargetId = (id: number) => {
    if (formTargetIds.includes(id)) {
      setFormTargetIds(formTargetIds.filter((tid) => tid !== id));
    } else {
      setFormTargetIds([...formTargetIds, id]);
    }
  };

  // Filtering
  const safePromotions = Array.isArray(promotions) ? promotions : [];
  const filteredPromotions = safePromotions.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' ? true : p.promo_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalActive = safePromotions.filter((p) => p.is_active).length;
  const totalUses = safePromotions.reduce((acc, p) => acc + (p.usage_count || 0), 0);

  // Collect all variants for gift selector
  const allVariants: { id: number; productName: string; variantName: string; price: number }[] = [];
  products.forEach((prod) => {
    (prod.variants || []).forEach((v) => {
      allVariants.push({
        id: v.id,
        productName: prod.name,
        variantName: v.variant_name,
        price: v.retail_price,
      });
    });
  });

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-indigo-600" />
              {t('promotions.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t('promotions.subtitle')}</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> {t('promotions.create_btn')}
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('promotions.total_promotions')}</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">{safePromotions.length}</div>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Tag className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('promotions.active_promotions')}</span>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{totalActive}</div>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500">{t('promotions.total_usage_count')}</span>
              <div className="text-2xl font-extrabold text-violet-600 mt-1">{totalUses}</div>
            </div>
            <div className="p-3 rounded-2xl bg-violet-50 text-violet-600 border border-violet-100">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('promotions.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-input pl-9 pr-4"
            />
          </div>

          <div className="w-full sm:w-48">
            <ModernSelect
              size="sm"
              value={typeFilter}
              onChange={(val) => setTypeFilter(String(val))}
              options={[
                { value: 'all', label: t('promotions.filter_all_types') || 'Tất cả loại' },
                { value: 'discount_amount', label: t('promotions.type_discount_amount') || 'Giảm số tiền', icon: <Coins className="w-3.5 h-3.5 text-indigo-500" /> },
                { value: 'discount_percent', label: t('promotions.type_discount_percent') || 'Giảm %', icon: <Percent className="w-3.5 h-3.5 text-emerald-500" /> },
                { value: 'gift_item', label: t('promotions.type_gift_item') || 'Tặng món', icon: <Gift className="w-3.5 h-3.5 text-amber-500" /> },
              ]}
            />
          </div>
        </div>

        {/* Promotions Table */}
        {/* Promotions Table & Mobile Cards */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* 1. Desktop Table View (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('promotions.promo_name')}</th>
                  <th className="py-3 px-4">{t('promotions.discount_value')}</th>
                  <th className="py-3 px-4">{t('promotions.conditions')}</th>
                  <th className="py-3 px-4">{t('promotions.scope')}</th>
                  <th className="py-3 px-4">{t('promotions.usage')}</th>
                  <th className="py-3 px-4 text-center">{t('common.status')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromotions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {t('promotions.no_promotions')}
                    </td>
                  </tr>
                ) : (
                  filteredPromotions.map((p) => {
                    const isAmount = p.promo_type === 'discount_amount';
                    const isPercent = p.promo_type === 'discount_percent';
                    const isGift = p.promo_type === 'gift_item';

                    const now = new Date();
                    const isExpired = p.end_date ? new Date(p.end_date) < now : false;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isAmount
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : isPercent
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}
                            >
                              {isAmount ? (
                                <Coins className="w-4 h-4" />
                              ) : isPercent ? (
                                <Percent className="w-4 h-4" />
                              ) : (
                                <Gift className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {isAmount
                                  ? t('promotions.type_discount_amount')
                                  : isPercent
                                  ? t('promotions.type_discount_percent')
                                  : t('promotions.type_gift_item')}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isAmount && (
                            <span className="font-extrabold text-emerald-600 text-sm">
                              -{formatCurrency(p.discount_value, settings)}
                            </span>
                          )}
                          {isPercent && (
                            <span className="font-extrabold text-indigo-600 text-sm">
                              -{p.discount_value}%
                            </span>
                          )}
                          {isGift && (
                            <span className="font-bold text-amber-600 text-xs bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                              🎁 {p.gift_variant ? `${p.gift_variant.variant_name}` : t('promotions.gift_item_label')}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-600 space-y-0.5">
                          {p.min_order_amount > 0 && (
                            <span className="block text-[11px]">
                              {t('promotions.min_order', { amount: formatCurrency(p.min_order_amount, settings) })}
                            </span>
                          )}
                          {p.min_quantity > 0 && (
                            <span className="block text-[11px]">
                              {t('promotions.min_qty', { qty: p.min_quantity })}
                            </span>
                          )}
                          {p.min_order_amount === 0 && p.min_quantity === 0 && (
                            <span className="text-slate-400 italic text-[11px]">{t('promotions.no_conditions')}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <span className="capitalize font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {p.scope === 'all'
                              ? t('promotions.scope_all')
                              : p.scope === 'category'
                              ? t('promotions.scope_category')
                              : t('promotions.scope_product')}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-slate-700">
                            {p.usage_count}{' '}
                            <span className="text-slate-400 font-normal">
                              / {p.usage_limit > 0 ? p.usage_limit : '∞'}
                            </span>
                          </div>
                          {p.end_date && (
                            <span className={`text-[10px] block mt-0.5 ${isExpired ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                              HSD: {new Date(p.end_date).toLocaleDateString()}
                            </span>
                          )}
                        </td>

                        {/* Interactive On/Off Quick Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(p)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                              p.is_active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-sm'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {p.is_active ? t('common.active') : t('common.inactive')}
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title={t('common.edit')}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePromotion(p.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* 2. Mobile Cards View (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredPromotions.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {t('promotions.no_promotions')}
              </div>
            ) : (
              filteredPromotions.map((p) => {
                const isAmount = p.promo_type === 'discount_amount';
                const isPercent = p.promo_type === 'discount_percent';
                const isGift = p.promo_type === 'gift_item';

                const now = new Date();
                const isExpired = p.end_date ? new Date(p.end_date) < now : false;

                return (
                  <div key={p.id} className="p-4 space-y-3 bg-white">
                    {/* Header: Icon, Name, Type, Status Toggle */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isAmount
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : isPercent
                              ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                              : 'bg-amber-50 text-amber-600 border border-amber-200'
                          }`}
                        >
                          {isAmount ? (
                            <Coins className="w-4 h-4" />
                          ) : isPercent ? (
                            <Percent className="w-4 h-4" />
                          ) : (
                            <Gift className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block text-sm">{p.name}</span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {isAmount
                              ? t('promotions.type_discount_amount')
                              : isPercent
                              ? t('promotions.type_discount_percent')
                              : t('promotions.type_gift_item')}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 transition cursor-pointer ${
                          p.is_active
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {p.is_active ? t('common.active') : t('common.inactive')}
                      </button>
                    </div>

                    {/* Discount Value & Scope */}
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <div>
                        {isAmount && (
                          <span className="font-extrabold text-emerald-600 text-base">
                            -{formatCurrency(p.discount_value, settings)}
                          </span>
                        )}
                        {isPercent && (
                          <span className="font-extrabold text-indigo-600 text-base">
                            -{p.discount_value}%
                          </span>
                        )}
                        {isGift && (
                          <span className="font-bold text-amber-700 text-xs bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                            🎁 {p.gift_variant ? `${p.gift_variant.variant_name}` : t('promotions.gift_item_label')}
                          </span>
                        )}
                      </div>

                      <span className="capitalize font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-lg text-[11px] border border-slate-200">
                        {p.scope === 'all'
                          ? t('promotions.scope_all')
                          : p.scope === 'category'
                          ? t('promotions.scope_category')
                          : t('promotions.scope_product')}
                      </span>
                    </div>

                    {/* Conditions & Usage info */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <div>
                        {p.min_order_amount > 0 ? (
                          <span>Đơn từ {formatCurrency(p.min_order_amount, settings)}</span>
                        ) : p.min_quantity > 0 ? (
                          <span>Từ {p.min_quantity} món</span>
                        ) : (
                          <span className="text-slate-400">Không điều kiện</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Đã dùng: <strong>{p.usage_count}/{p.usage_limit > 0 ? p.usage_limit : '∞'}</strong></span>
                        {p.end_date && (
                          <span className={`${isExpired ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                            • HSD: {new Date(p.end_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                      <button
                        onClick={() => openEditModal(p)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-semibold border border-slate-200 transition cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDeletePromotion(p.id)}
                        className="inline-flex items-center justify-center p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold border border-rose-200 transition cursor-pointer"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Create/Edit Promotion */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-indigo-600" />
                  {editingPromo ? t('promotions.edit_promo') : t('promotions.create_promo_title')}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePromotion} className="space-y-4 text-xs">
                {/* Promo Name */}
                <div>
                  <label className="app-label">
                    {t('promotions.promo_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Giảm 20K Mừng Khai Trương"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="app-input font-semibold"
                  />
                </div>

                {/* Promo Type */}
                <div>
                  <label className="app-label">
                    {t('promotions.type_label')} *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('discount_amount')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        formType === 'discount_amount'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>{t('promotions.type_discount_amount')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('discount_percent')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        formType === 'discount_percent'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Percent className="w-4 h-4" />
                      <span>{t('promotions.type_discount_percent')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('gift_item')}
                      className={`p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                        formType === 'gift_item'
                          ? 'border-amber-600 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      <span>{t('promotions.type_gift_item')}</span>
                    </button>
                  </div>
                </div>

                {/* Discount Value or Gift Selector */}
                {formType !== 'gift_item' ? (
                  <div>
                    <label className="app-label">
                      {formType === 'discount_amount' ? t('promotions.discount_amount_label') : t('promotions.discount_percent_label')} *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        min="0"
                        max={formType === 'discount_percent' ? 100 : undefined}
                        step={formType === 'discount_amount' ? '1000' : '1'}
                        value={formValue === 0 ? '' : formValue}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setFormValue(raw === '' ? 0 : parseInt(raw, 10));
                        }}
                        placeholder="0"
                        className="app-input pr-12 font-bold"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        {formType === 'discount_amount' ? 'đ' : '%'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="app-label">
                      {t('promotions.gift_variant_label')} *
                    </label>
                    <ModernSelect
                      value={formGiftVariantId || 0}
                      onChange={(val) => setFormGiftVariantId(Number(val) || null)}
                      options={[
                        { value: 0, label: t('promotions.select_gift_placeholder') || '— Chọn món tặng —' },
                        ...allVariants.map((v) => ({
                          value: v.id,
                          label: `${v.productName} - ${v.variantName} (${formatCurrency(v.price, settings)})`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* Scope Selection */}
                <div>
                  <label className="app-label">
                    {t('promotions.scope_label')}
                  </label>
                  <ModernSelect
                    value={formScope}
                    onChange={(val) => {
                      setFormScope(val as PromoScope);
                      setFormTargetIds([]);
                    }}
                    options={[
                      { value: 'all', label: t('promotions.scope_all') || 'Toàn bộ hóa đơn', badge: 'Tất cả', badgeColor: 'indigo' },
                      { value: 'category', label: t('promotions.scope_category') || 'Theo danh mục món', badge: 'Danh mục', badgeColor: 'blue' },
                      { value: 'product', label: t('promotions.scope_product') || 'Theo từng món cụ thể', badge: 'Món cụ thể', badgeColor: 'emerald' },
                    ]}
                  />
                </div>

                {/* Scope Target IDs Multi-selector */}
                {formScope === 'category' && (
                  <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      {t('promotions.select_categories')}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {categories.map((cat) => {
                        const isChecked = formTargetIds.includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleTargetId(cat.id)}
                            className={`p-2 rounded-lg border text-left flex items-center justify-between text-xs transition ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span>{cat.name}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formScope === 'product' && (
                  <div className="space-y-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      {t('promotions.select_products')}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                      {products.map((prod) => {
                        const isChecked = formTargetIds.includes(prod.id);
                        return (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => toggleTargetId(prod.id)}
                            className={`p-2 rounded-lg border text-left flex items-center justify-between text-xs transition ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{prod.name}</span>
                            {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Eligibility Conditions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="app-label">
                      {t('promotions.min_order_amount_label')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0"
                      value={formMinOrderAmount === 0 ? '' : formMinOrderAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setFormMinOrderAmount(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="app-input font-semibold"
                    />
                  </div>
                  <div>
                    <label className="app-label">
                      {t('promotions.min_qty_label')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formMinQuantity === 0 ? '' : formMinQuantity}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setFormMinQuantity(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="app-input font-semibold"
                    />
                  </div>
                </div>

                {/* Start Date & End Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="app-label">
                      {t('promotions.start_date_label')}
                    </label>
                    <input
                      type="datetime-local"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="app-input bg-white"
                    />
                  </div>
                  <div>
                    <label className="app-label">
                      {t('promotions.end_date_label')}
                    </label>
                    <input
                      type="datetime-local"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="app-input bg-white"
                    />
                  </div>
                </div>

                {/* Usage Limit & Is Active Switch */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="app-label">
                      {t('promotions.usage_limit_label')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0 (Không giới hạn)"
                      value={formUsageLimit === 0 ? '' : formUsageLimit}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setFormUsageLimit(raw === '' ? 0 : parseInt(raw, 10));
                      }}
                      className="app-input"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200 mt-4">
                    <span className="font-bold text-slate-800 text-xs">{t('promotions.is_active')}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formIsActive}
                      onClick={() => setFormIsActive(!formIsActive)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out ${
                        formIsActive ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                          formIsActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm"
                  >
                    {editingPromo ? t('promotions.save_btn') : t('promotions.create_btn')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
