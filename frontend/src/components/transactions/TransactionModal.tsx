'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Package,
  Layers,
  Info,
} from 'lucide-react';
import ModernSelect from '@/components/common/ModernSelect';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi } from '@/lib/api';
import { Ingredient } from '@/types/purchase';
import { TransactionCategory } from '@/types/transaction_category';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

export interface PurchaseLineItem {
  id?: number;
  ingredient_id?: number;
  ingredient_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  funds: Fund[];
  txCategories: TransactionCategory[];
  initialData?: {
    id?: number;
    fund_id: number;
    transaction_type: 'inflow' | 'outflow';
    category: string;
    amount: number;
    description: string;
    created_at?: string | null;
  } | null;
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  funds,
  txCategories,
  initialData,
}: TransactionModalProps) {
  const { t } = useTranslation();

  const isEditing = Boolean(initialData?.id);

  // Form States
  const [modalType, setModalType] = useState<'inflow' | 'outflow'>('outflow');
  const [modalFundId, setModalFundId] = useState<number>(funds[0]?.id || 0);
  const [modalCategory, setModalCategory] = useState<string>('ingredient_purchase');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalDescription, setModalDescription] = useState<string>('');
  const [modalCreatedAt, setModalCreatedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Itemized Purchases Mode
  const [isPurchaseLogging, setIsPurchaseLogging] = useState<boolean>(false);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([
    { ingredient_name: '', category: 'fruit', quantity: 1, unit: 'kg', unit_price: 0, subtotal: 0 },
  ]);

  // Known Ingredients Catalog for Autocomplete
  const [knownIngredients, setKnownIngredients] = useState<Ingredient[]>([]);

  // Load ingredients for autocomplete
  useEffect(() => {
    if (isOpen) {
      fetchApi<Ingredient[]>('/purchases/ingredients')
        .then((res) => {
          if (res.status === 'success' && Array.isArray(res.data)) {
            setKnownIngredients(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Reset or initialize state on open
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    setIsSubmitting(false);

    if (initialData) {
      setModalType(initialData.transaction_type);
      setModalFundId(initialData.fund_id || funds[0]?.id || 0);
      setModalCategory(initialData.category);
      setModalAmount(initialData.amount || 0);
      setModalDescription(initialData.description || '');
      setModalCreatedAt(initialData.created_at || null);
      setIsPurchaseLogging(false);
    } else {
      setModalType('outflow');
      setModalFundId(funds[0]?.id || 0);
      const defaultCat = txCategories.find((c) => c.type === 'outflow' || c.type === 'both');
      setModalCategory(defaultCat?.code || defaultCat?.name || 'ingredient_purchase');
      setModalAmount(0);
      setModalDescription('');
      setModalCreatedAt(null);
      setIsPurchaseLogging(false);
      setPurchaseItems([
        { ingredient_name: '', category: 'fruit', quantity: 1, unit: 'kg', unit_price: 0, subtotal: 0 },
      ]);
    }
  }, [isOpen, initialData, funds, txCategories]);

  // Auto calculate sum of purchase items and set modalAmount
  useEffect(() => {
    if (isPurchaseLogging && modalType === 'outflow') {
      const sum = purchaseItems.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);
      setModalAmount(sum);
    }
  }, [purchaseItems, isPurchaseLogging, modalType]);

  const handleAddRow = () => {
    setPurchaseItems((prev) => [
      ...prev,
      { ingredient_name: '', category: 'fruit', quantity: 1, unit: 'kg', unit_price: 0, subtotal: 0 },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (purchaseItems.length === 1) {
      setPurchaseItems([
        { ingredient_name: '', category: 'fruit', quantity: 1, unit: 'kg', unit_price: 0, subtotal: 0 },
      ]);
      return;
    }
    setPurchaseItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => {
    setPurchaseItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      // When ingredient name matches a known ingredient, auto-populate unit and category
      if (field === 'ingredient_name') {
        const found = knownIngredients.find(
          (ing) => ing.name.toLowerCase().trim() === String(value).toLowerCase().trim()
        );
        if (found) {
          item.ingredient_id = found.id;
          item.unit = found.unit || item.unit;
          item.category = found.category || item.category;
          if (item.unit_price === 0 && found.latest_purchase_price > 0) {
            item.unit_price = found.latest_purchase_price;
          }
        } else {
          item.ingredient_id = undefined;
        }
      }

      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : item.quantity;
        const price = field === 'unit_price' ? Number(value) : item.unit_price;
        item.subtotal = Math.round(qty * price);
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!modalFundId) {
      setErrorMessage(t('tx.error_select_fund') || 'Vui lòng chọn quỹ tiền');
      return;
    }

    if (modalAmount <= 0) {
      setErrorMessage(t('tx.error_enter_amount') || 'Vui lòng nhập số tiền hợp lệ lớn hơn 0');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && initialData?.id) {
        const payload: any = {
          fund_id: modalFundId,
          transaction_type: modalType,
          category: modalCategory,
          amount: Number(modalAmount),
          description: modalDescription,
          created_at: modalCreatedAt ? new Date(modalCreatedAt).toISOString() : undefined,
        };

        const res = await fetchApi(`/transactions/${initialData.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMessage(res.message || 'Lỗi khi cập nhật giao dịch');
        }
      } else {
        const payload: any = {
          fund_id: modalFundId,
          transaction_type: modalType,
          category: modalCategory,
          amount: Number(modalAmount),
          description: modalDescription,
          created_at: modalCreatedAt ? new Date(modalCreatedAt).toISOString() : undefined,
        };

        if (isPurchaseLogging && modalType === 'outflow') {
          const validItems = purchaseItems
            .filter((p) => p.ingredient_name.trim() !== '' && p.quantity > 0)
            .map((p) => ({
              ingredient_name: p.ingredient_name.trim(),
              ingredient_id: p.ingredient_id,
              category: p.category,
              quantity: Number(p.quantity),
              unit_price: Number(p.unit_price),
              unit: p.unit.trim() || 'kg',
            }));

          if (validItems.length > 0) {
            payload.purchase_items = validItems;
          }
        }

        const res = await fetchApi('/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMessage(res.message || 'Lỗi khi tạo giao dịch');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = useMemo(() => {
    const filtered = txCategories.filter((c) => c.type === modalType || c.type === 'both');
    if (filtered.length > 0) {
      return filtered.map((c) => ({
        value: c.code || c.name,
        label: c.name,
        badge: c.type === 'inflow' ? 'Thu' : c.type === 'outflow' ? 'Chi' : 'Thu/Chi',
        badgeColor: (c.type === 'inflow' ? 'emerald' : c.type === 'outflow' ? 'rose' : 'indigo') as any,
      }));
    }
    return modalType === 'outflow'
      ? [
          { value: 'ingredient_purchase', label: t('tx.cat_ingredient') || 'Mua nguyên liệu' },
          { value: 'utility_bill', label: t('tx.cat_utility') || 'Chi phí vận hành' },
          { value: 'reconciliation_variance', label: t('tx.cat_reconciliation') || 'Chênh lệch đối soát' },
          { value: 'other', label: 'Khác' },
        ]
      : [
          { value: 'sale', label: t('tx.cat_manual_sale') || 'Bán hàng' },
          { value: 'other', label: t('tx.cat_other_inflow') || 'Thu khác' },
        ];
  }, [txCategories, modalType, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div
        className={`bg-white rounded-3xl w-full shadow-2xl space-y-4 my-auto transition-all animate-in zoom-in-95 duration-150 border border-slate-100 ${
          isPurchaseLogging && modalType === 'outflow' ? 'max-w-3xl' : 'max-w-md'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                modalType === 'outflow'
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              }`}
            >
              {modalType === 'outflow' ? '↓' : '↑'}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isEditing
                  ? t('tx.edit_transaction_title') || 'Chỉnh Sửa Giao Dịch'
                  : modalType === 'outflow'
                  ? t('tx.add_expense_title') || 'Tạo Khoản Chi Mới'
                  : t('tx.add_inflow_title') || 'Tạo Khoản Thu Mới'}
              </h3>
              <p className="text-xs text-slate-400">
                {modalType === 'outflow'
                  ? 'Ghi nhận chi phí, nhập nguyên liệu & xuất tiền quỹ'
                  : 'Ghi nhận nguồn thu thủ công & nạp tiền quỹ'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4 text-xs">
          {/* Type Selector (Only when creating) */}
          {!isEditing && (
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setModalType('outflow');
                  const cat = txCategories.find((c) => c.type === 'outflow' || c.type === 'both');
                  setModalCategory(cat?.code || cat?.name || 'ingredient_purchase');
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 ${
                  modalType === 'outflow'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Khoản Chi (Outflow)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalType('inflow');
                  setIsPurchaseLogging(false);
                  const cat = txCategories.find((c) => c.type === 'inflow' || c.type === 'both');
                  setModalCategory(cat?.code || cat?.name || 'sale');
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5 ${
                  modalType === 'inflow'
                    ? 'bg-white text-emerald-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Khoản Thu (Inflow)</span>
              </button>
            </div>
          )}

          {/* Fund & Category Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 mb-1 block">
                {t('tx.modal_fund_label')} *
              </label>
              <ModernSelect
                value={modalFundId}
                onChange={(val) => setModalFundId(Number(val))}
                options={funds.map((f) => ({
                  value: f.id,
                  label: f.name,
                  badge: formatCurrency(f.current_balance),
                  badgeColor: f.current_balance >= 0 ? 'emerald' : 'rose',
                }))}
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 mb-1 block">
                {t('tx.modal_category_label')} *
              </label>
              <ModernSelect
                value={modalCategory}
                onChange={(val) => setModalCategory(String(val))}
                options={categoryOptions}
              />
            </div>
          </div>

          {/* Integrated Itemized Purchases Toggle (Only for Outflows when creating) */}
          {modalType === 'outflow' && !isEditing && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                      Chi Mua Hàng Hóa / Nguyên Liệu
                      <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                        Tự động tính giá vốn
                      </span>
                    </span>
                    <p className="text-[11px] text-emerald-700">
                      Ghi chi tiết từng loại hoa quả, sữa, bao bì để tự động cập nhật giá nhập mới
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPurchaseLogging}
                    onChange={(e) => {
                      setIsPurchaseLogging(e.target.checked);
                      if (e.target.checked) {
                        setModalCategory('ingredient_purchase');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Itemized Purchase Table & Mobile Card List */}
              {isPurchaseLogging && (
                <div className="space-y-2 pt-1 border-t border-emerald-200/60">
                  {/* Desktop Table (>= 640px) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="text-slate-600 border-b border-emerald-200/60">
                          <th className="pb-1 font-bold w-1/3">Tên Nguyên Liệu / Món</th>
                          <th className="pb-1 font-bold w-20">Loại</th>
                          <th className="pb-1 font-bold w-16 text-right">Số lượng</th>
                          <th className="pb-1 font-bold w-14">ĐVT</th>
                          <th className="pb-1 font-bold w-24 text-right">Đơn giá (đ)</th>
                          <th className="pb-1 font-bold w-24 text-right">Thành tiền</th>
                          <th className="pb-1 font-bold w-8 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100/80">
                        {purchaseItems.map((item, idx) => (
                          <tr key={idx} className="group">
                            <td className="py-1.5 pr-1.5">
                              <input
                                list="ingredient-suggestions"
                                type="text"
                                required
                                placeholder="Vd: Cam sành, Cà rốt..."
                                value={item.ingredient_name}
                                onChange={(e) =>
                                  handleItemChange(idx, 'ingredient_name', e.target.value)
                                }
                                className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              />
                            </td>
                            <td className="py-1.5 pr-1.5">
                              <select
                                value={item.category}
                                onChange={(e) =>
                                  handleItemChange(idx, 'category', e.target.value)
                                }
                                className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-[11px] font-medium bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="fruit">Hoa quả</option>
                                <option value="ingredient">Nguyên liệu</option>
                                <option value="packaging">Bao bì</option>
                                <option value="other">Khác</option>
                              </select>
                            </td>
                            <td className="py-1.5 pr-1.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                required
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'quantity',
                                    e.target.value === '' ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              />
                            </td>
                            <td className="py-1.5 pr-1.5">
                              <input
                                type="text"
                                placeholder="kg, ly..."
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              />
                            </td>
                            <td className="py-1.5 pr-1.5 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                required
                                placeholder="20.000"
                                value={item.unit_price === 0 ? '' : item.unit_price}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'unit_price',
                                    e.target.value === '' ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                              />
                            </td>
                            <td className="py-1.5 pr-1.5 text-right font-bold text-slate-900">
                              {formatCurrency(item.subtotal)}
                            </td>
                            <td className="py-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Cards (< 640px) */}
                  <div className="sm:hidden space-y-2.5">
                    {purchaseItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2.5 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            list="ingredient-suggestions"
                            type="text"
                            required
                            placeholder="Tên nguyên liệu..."
                            value={item.ingredient_name}
                            onChange={(e) =>
                              handleItemChange(idx, 'ingredient_name', e.target.value)
                            }
                            className="flex-1 h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">Số lượng</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                required
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'quantity',
                                    e.target.value === '' ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-center"
                              />
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">ĐVT</span>
                            <input
                              type="text"
                              placeholder="kg"
                              value={item.unit}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs text-center font-medium"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block">Đơn giá</span>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              required
                              placeholder="20.000"
                              value={item.unit_price === 0 ? '' : item.unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'unit_price',
                                  e.target.value === '' ? 0 : parseFloat(e.target.value)
                                )
                              }
                              className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500 font-medium">Thành tiền:</span>
                          <span className="font-extrabold text-emerald-800 text-xs">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Datalist suggestions */}
                  <datalist id="ingredient-suggestions">
                    {knownIngredients.map((ing) => (
                      <option key={ing.id} value={ing.name}>
                        {ing.unit} - {formatCurrency(ing.latest_purchase_price)}
                      </option>
                    ))}
                  </datalist>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-100/50 px-2.5 py-1.5 rounded-lg border border-emerald-300 transition active:scale-95 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm mặt hàng</span>
                    </button>
                    <div className="text-xs font-bold text-emerald-900">
                      Tổng tiền: <span className="text-rose-600 text-sm font-black">{formatCurrency(modalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input (Editable or Auto-Computed) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700">
                {t('tx.modal_amount_label')} (VNĐ) *
              </label>
              {isPurchaseLogging && modalType === 'outflow' && (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                  ⚡ Tự động tính từ danh sách mặt hàng
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              required
              disabled={isPurchaseLogging && modalType === 'outflow'}
              placeholder="35.000"
              value={modalAmount === 0 ? '' : modalAmount}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                setModalAmount(raw === '' ? 0 : parseInt(raw, 10));
              }}
              className={`w-full p-2.5 border rounded-xl text-sm font-extrabold focus:outline-none focus:ring-2 ${
                isPurchaseLogging && modalType === 'outflow'
                  ? 'bg-slate-100 border-slate-200 text-slate-800'
                  : 'border-slate-200 text-slate-900 focus:ring-indigo-500 bg-white'
              }`}
            />
          </div>

          {/* Transaction Date & Time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                {t('tx.transaction_time')}
              </label>
              {modalCreatedAt ? (
                <button
                  type="button"
                  onClick={() => setModalCreatedAt(null)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition active:scale-95 border border-indigo-200"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{t('tx.transaction_time_reset')}</span>
                </button>
              ) : (
                <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  {t('tx.transaction_time_auto')}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <input
                type="datetime-local"
                value={
                  modalCreatedAt
                    ? (() => {
                        try {
                          const d = new Date(modalCreatedAt);
                          if (isNaN(d.getTime())) return '';
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
                            d.getHours()
                          )}:${pad(d.getMinutes())}`;
                        } catch {
                          return '';
                        }
                      })()
                    : ''
                }
                onChange={(e) => {
                  if (!e.target.value) {
                    setModalCreatedAt(null);
                  } else {
                    setModalCreatedAt(new Date(e.target.value).toISOString());
                  }
                }}
                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />

              {/* Quick Presets */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setModalCreatedAt(null)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition active:scale-95 whitespace-nowrap ${
                    !modalCreatedAt
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t('tx.time_now')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() - 15 * 60 * 1000);
                    setModalCreatedAt(d.toISOString());
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                >
                  {t('tx.time_minus_15m')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() - 60 * 60 * 1000);
                    setModalCreatedAt(d.toISOString());
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                >
                  {t('tx.time_minus_1h')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    setModalCreatedAt(d.toISOString());
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition active:scale-95 whitespace-nowrap"
                >
                  {t('tx.time_yesterday')}
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="font-bold text-slate-700 mb-1 block">
              {t('tx.modal_description_label')}
            </label>
            <textarea
              rows={2}
              placeholder={t('tx.description_placeholder') || 'Ghi chú lý do, nhà cung cấp hoặc nội dung chi...'}
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer ${
                modalType === 'outflow'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting
                ? 'Đang xử lý...'
                : isEditing
                ? t('common.save_changes') || 'Lưu thay đổi'
                : t('tx.modal_submit') || 'Lưu giao dịch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
