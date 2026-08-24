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
  RefreshCw,
  GripVertical,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';
import { Promotion, PromoType, PromoScope } from '@/types/promotion';

export type { Promotion, PromoType, PromoScope };

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

interface PromotionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: SettingsMap | null;
}

export default function PromotionsModal({ isOpen, onClose, settings: initialSettings }: PromotionsModalProps) {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<SettingsMap | null>(initialSettings || null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Form Sub-Modal State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
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

    if (!settings) {
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
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const openCreateForm = () => {
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
    setIsFormOpen(true);
  };

  const openEditForm = (promo: Promotion) => {
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
    setIsFormOpen(true);
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
        setIsFormOpen(false);
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
        setIsFormOpen(false);
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
    const res = await fetchApi<Promotion>(`/promotions/${promo.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...promo,
        is_active: !promo.is_active,
        target_ids: promo.target_ids ? JSON.parse(promo.target_ids) : [],
      }),
    });
    if (res.status === 'success') {
      loadData();
    } else {
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to update promotion status', 'danger');
    }
  };

  // Filtered list
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }
    const currentList = [...filteredPromos];
    const [moved] = currentList.splice(draggedIndex, 1);
    currentList.splice(targetIndex, 0, moved);
    handleDragEnd();

    try {
      const orderedIds = currentList.map((p) => p.id);
      await fetchApi('/promotions/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      loadData();
    } catch (err) {
      console.error('Failed to reorder promotions', err);
    }
  };

  const filteredPromos = promotions.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || p.promo_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Extract all variants for gift selector
  const allVariants: { id: number; productName: string; variantName: string; price: number }[] = [];
  products.forEach((p) => {
    if (p.variants && Array.isArray(p.variants)) {
      p.variants.forEach((v) => {
        allVariants.push({
          id: v.id,
          productName: p.name,
          variantName: v.variant_name,
          price: v.retail_price,
        });
      });
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                  {t('promotions.title') || 'Chương Trình Khuyến Mãi'}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.2 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                  {promotions.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {t('promotions.subtitle') || 'Quản lý mã giảm giá, chiết khấu hóa đơn và quà tặng kèm'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openCreateForm}
              className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs px-2.5 sm:px-3.5 py-2 rounded-xl flex items-center gap-1 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('promotions.create_btn') || '+ Thêm KM'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('promotions.search_placeholder') || 'Tìm khuyến mãi theo tên...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="app-input pl-9 pr-4"
            />
          </div>
          <div className="w-full sm:w-52 shrink-0">
            <ModernSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(String(val))}
              options={[
                { value: 'all', label: t('promotions.filter_all_types') || 'Tất cả loại KM' },
                { value: 'discount_amount', label: t('promotions.type_discount_amount') || 'Giảm tiền (đ)' },
                { value: 'discount_percent', label: t('promotions.type_discount_percent') || 'Giảm phần trăm (%)' },
                { value: 'gift_item', label: t('promotions.type_gift_item') || 'Tặng món quà' },
              ]}
            />
          </div>
        </div>

        {/* Promotions List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
          </div>
        ) : filteredPromos.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
            <Gift className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-bold text-sm">Chưa có chương trình khuyến mãi nào</p>
            <p className="text-xs text-slate-400 mt-1">Bấm "+ Thêm KM" để tạo chương trình giảm giá đầu tiên</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span>💡 Kéo thả biểu tượng ⋮⋮ để sắp xếp thứ tự ưu tiên áp dụng khuyến mãi</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[58vh] overflow-y-auto pr-1">
              {filteredPromos.map((promo, idx) => {
                const isGift = promo.promo_type === 'gift_item';
                const isPercent = promo.promo_type === 'discount_percent';
                const isDragging = draggedIndex === idx;
                const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                return (
                  <div
                    key={promo.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, idx)}
                    className={`bg-white rounded-2xl border p-3.5 space-y-2.5 transition shadow-xs cursor-move select-none ${
                      isDragging
                        ? 'opacity-40 scale-95 border-dashed border-indigo-400 bg-indigo-50/40'
                        : isDragOver
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                        : promo.is_active
                        ? 'border-slate-200 hover:border-indigo-300'
                        : 'border-slate-200/60 opacity-60 bg-slate-50/50'
                    }`}
                  >
                    {/* Card Top: Grip + Type Badge & Active Switch */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                            isGift
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isPercent
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isGift ? <Gift className="w-3 h-3" /> : isPercent ? <Percent className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                          <span>
                            {isGift
                              ? 'Tặng món'
                              : isPercent
                              ? `Giảm ${promo.discount_value}%`
                              : `Giảm ${formatCurrency(promo.discount_value, settings)}`}
                          </span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(promo);
                        }}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer shrink-0 ${
                          promo.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {promo.is_active ? '● Đang bật' : '○ Tạm tắt'}
                      </button>
                    </div>

                    {/* Promo Name */}
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{promo.name}</h3>
                      {isGift && promo.gift_variant && (
                        <p className="text-xs font-semibold text-amber-700 mt-0.5">
                          🎁 Tặng kèm: {promo.gift_variant.variant_name}
                        </p>
                      )}
                    </div>

                    {/* Conditions & Details */}
                    <div className="bg-slate-50 rounded-xl p-2 text-[11px] space-y-1 text-slate-600">
                      {promo.min_order_amount > 0 && (
                        <div>Đơn tối thiểu: <span className="font-bold text-slate-800">{formatCurrency(promo.min_order_amount, settings)}</span></div>
                      )}
                      {promo.min_quantity > 0 && (
                        <div>SL tối thiểu: <span className="font-bold text-slate-800">{promo.min_quantity} món</span></div>
                      )}
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span>Đã dùng: <strong className="text-slate-700">{promo.usage_count}</strong> {promo.usage_limit > 0 ? `/ ${promo.usage_limit}` : '(Vô hạn)'}</span>
                        <span>Phạm vi: <strong className="text-slate-700">{promo.scope === 'all' ? 'Toàn menu' : promo.scope === 'category' ? 'Theo danh mục' : 'Theo món'}</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditForm(promo);
                        }}
                        className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Sửa</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePromotion(promo.id);
                        }}
                        className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT PROMOTION SUB-MODAL ─────────────────────────────── */}
        {isFormOpen && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                  <span>{editingPromo ? 'Chỉnh Sửa Khuyến Mãi' : 'Thêm Khuyến Mãi Mới'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePromotion} className="space-y-3.5 text-xs">
                {/* Promo Name */}
                <div>
                  <label className="app-label">Tên chương trình khuyến mãi *</label>
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
                  <label className="app-label">Hình thức khuyến mãi *</label>
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('discount_amount')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer text-[11px] sm:text-xs ${
                        formType === 'discount_amount'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>Giảm tiền (đ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('discount_percent')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer text-[11px] sm:text-xs ${
                        formType === 'discount_percent'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Percent className="w-4 h-4" />
                      <span>Giảm %</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('gift_item')}
                      className={`p-2 sm:p-2.5 rounded-xl border text-center font-bold transition flex flex-col items-center gap-1 cursor-pointer text-[11px] sm:text-xs ${
                        formType === 'gift_item'
                          ? 'border-amber-600 bg-amber-50 text-amber-700 ring-2 ring-amber-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Gift className="w-4 h-4" />
                      <span>Tặng món</span>
                    </button>
                  </div>
                </div>

                {/* Discount Value or Gift Selector */}
                {formType !== 'gift_item' ? (
                  <div>
                    <label className="app-label">
                      {formType === 'discount_amount' ? 'Số tiền giảm (đ) *' : 'Phần trăm giảm (%) *'}
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
                    <label className="app-label">Món quà tặng kèm *</label>
                    <ModernSelect
                      value={formGiftVariantId || 0}
                      onChange={(val) => setFormGiftVariantId(Number(val) || null)}
                      options={[
                        { value: 0, label: '— Chọn món tặng —' },
                        ...allVariants.map((v) => ({
                          value: v.id,
                          label: `${v.productName} - ${v.variantName} (${formatCurrency(v.price, settings)})`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* Eligibility Conditions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label className="app-label">Đơn tối thiểu (đ)</label>
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
                    <label className="app-label">Số lượng tối thiểu</label>
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

                {/* Usage Limit & Is Active Switch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 items-center">
                  <div>
                    <label className="app-label">Giới hạn số lượt</label>
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

                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 sm:mt-4">
                    <span className="font-bold text-slate-800 text-xs">Kích hoạt ngay</span>
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Form Buttons (Balanced on mobile) */}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs transition cursor-pointer text-center justify-center flex items-center"
                  >
                    {t('common.cancel') || 'Hủy'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer text-center justify-center flex items-center"
                  >
                    {t('common.save') || 'Lưu khuyến mãi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
