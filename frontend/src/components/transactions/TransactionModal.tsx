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
  Scale,
  Percent,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import ModernSelect from '@/components/common/ModernSelect';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { fetchApi } from '@/lib/api';
import { Ingredient, IngredientConversionPreset } from '@/types/purchase';
import { TransactionCategory } from '@/types/transaction_category';
import {
  COMMON_PURCHASE_UNITS,
  COMMON_BASE_UNITS,
  calculatePurchaseConversion,
  formatQuantityWithUnit,
} from '@/lib/unitConversion';

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
  base_unit: string;
  purchase_unit: string;
  purchase_quantity: number;
  purchase_unit_price: number;
  pack_qty: number;
  pack_unit: string;
  capacity_qty: number;
  capacity_unit: string;
  loss_rate: number;
  total_base_quantity: number;
  base_unit_price: number;
  effective_base_quantity: number;
  effective_base_price: number;
  subtotal: number;
  conversion_spec: string;
  is_custom_new?: boolean;
  is_multi_level?: boolean;
  show_loss_input?: boolean;
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
    purchase_items?: any[];
  } | null;
}

const createDefaultPurchaseItem = (isCustom = false): PurchaseLineItem => ({
  ingredient_name: '',
  category: 'fruit',
  base_unit: 'ml',
  purchase_unit: 'Chai',
  purchase_quantity: 1,
  purchase_unit_price: 0,
  pack_qty: 1,
  pack_unit: '',
  capacity_qty: 1000,
  capacity_unit: 'ml',
  loss_rate: 0,
  total_base_quantity: 1000,
  base_unit_price: 0,
  effective_base_quantity: 1000,
  effective_base_price: 0,
  subtotal: 0,
  conversion_spec: '',
  is_custom_new: isCustom,
  is_multi_level: false,
  show_loss_input: false,
});

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

  // Itemized Purchases Mode (Default ON for new outflows)
  const [isPurchaseLogging, setIsPurchaseLogging] = useState<boolean>(true);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseLineItem[]>([
    createDefaultPurchaseItem(false),
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

      const hasExistingItems =
        Array.isArray(initialData.purchase_items) && initialData.purchase_items.length > 0;
      const isPurchaseCat =
        initialData.category === 'ingredient_purchase' ||
        initialData.category.toLowerCase().includes('nguyên liệu') ||
        initialData.category.toLowerCase().includes('hàng hóa') ||
        initialData.category.toLowerCase().includes('purchase');

      if (hasExistingItems) {
        setIsPurchaseLogging(true);
        setPurchaseItems(
          initialData.purchase_items!.map((pi: any) => {
            const baseUnit = pi.base_unit || pi.ingredient?.base_unit || pi.ingredient?.unit || 'ml';
            const pUnit = pi.purchase_unit || pi.unit || 'Chai';
            const pQty = Number(pi.purchase_quantity) || Number(pi.quantity) || 1;
            const pPrice = Number(pi.purchase_unit_price) || Number(pi.unit_price) || 0;
            const pPackQty = Number(pi.pack_qty) || 1;
            const pPackUnit = pi.pack_unit || '';
            const pCapQty = Number(pi.capacity_qty) || 1000;
            const pCapUnit = pi.capacity_unit || baseUnit;
            const pLossRate = Number(pi.loss_rate) || 0;

            const res = calculatePurchaseConversion({
              purchaseQty: pQty,
              purchaseUnitPrice: pPrice,
              purchaseUnit: pUnit,
              packQty: pPackQty,
              packUnit: pPackUnit,
              capacityQty: pCapQty,
              capacityUnit: pCapUnit,
              baseUnit,
              lossRate: pLossRate,
            });

            return {
              id: pi.id,
              ingredient_id: pi.ingredient_id || pi.ingredient?.id,
              ingredient_name: pi.ingredient?.name || pi.ingredient_name || '',
              category: (pi.category || pi.ingredient?.category || 'fruit') as string,
              base_unit: baseUnit,
              purchase_unit: pUnit,
              purchase_quantity: pQty,
              purchase_unit_price: pPrice,
              pack_qty: pPackQty,
              pack_unit: pPackUnit,
              capacity_qty: pCapQty,
              capacity_unit: pCapUnit,
              loss_rate: pLossRate,
              total_base_quantity: res.totalBaseQuantity,
              base_unit_price: res.baseUnitPrice,
              effective_base_quantity: res.effectiveBaseQuantity,
              effective_base_price: res.effectiveBasePrice,
              subtotal: res.subtotal,
              conversion_spec: res.conversionSpec,
              is_custom_new: !(pi.ingredient_id || pi.ingredient?.id),
              is_multi_level: pPackQty > 1,
              show_loss_input: pLossRate > 0,
            };
          })
        );
      } else if (isPurchaseCat && initialData.transaction_type === 'outflow') {
        setIsPurchaseLogging(false);
        setPurchaseItems([createDefaultPurchaseItem(false)]);
      } else {
        setIsPurchaseLogging(false);
        setPurchaseItems([createDefaultPurchaseItem(false)]);
      }
    } else {
      setModalType('outflow');
      setModalFundId(funds[0]?.id || 0);
      const defaultCat =
        txCategories.find((c) => c.is_default && (c.type === 'outflow' || c.type === 'both')) ||
        txCategories.find((c) => c.type === 'outflow' || c.type === 'both');
      setModalCategory(defaultCat?.code || defaultCat?.name || 'ingredient_purchase');
      setModalAmount(0);
      setModalDescription('');
      setModalCreatedAt(null);
      setIsPurchaseLogging(true);
      setPurchaseItems([createDefaultPurchaseItem(false)]);
    }
  }, [isOpen, initialData, funds, txCategories]);

  // Auto calculate sum of purchase items and set modalAmount
  useEffect(() => {
    if (isPurchaseLogging && modalType === 'outflow') {
      const validItems = purchaseItems.filter(
        (i) => i.ingredient_name.trim() !== '' || (i.ingredient_id && i.ingredient_id > 0)
      );
      if (validItems.length > 0) {
        const sum = purchaseItems.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);
        setModalAmount(sum);
      }
    }
  }, [purchaseItems, isPurchaseLogging, modalType]);

  const handleAddRow = (isCustom = false) => {
    setPurchaseItems((prev) => [...prev, createDefaultPurchaseItem(isCustom)]);
  };

  const handleSelectIngredient = (index: number, selectedVal: string) => {
    if (selectedVal === '__custom_new__') {
      setPurchaseItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ingredient_id: undefined,
          ingredient_name: '',
          is_custom_new: true,
        };
        return updated;
      });
      return;
    }

    const ingId = parseInt(selectedVal, 10);
    const found = knownIngredients.find((ing) => ing.id === ingId);
    if (found) {
      setPurchaseItems((prev) => {
        const updated = [...prev];
        const item = updated[index];
        const baseUnit = found.base_unit || found.unit || 'ml';
        const purchaseUnit = found.default_purchase_unit || (baseUnit === 'ml' ? 'Chai' : baseUnit === 'g' ? 'Túi' : 'Cái');
        const packQty = found.default_pack_qty || 1;
        const packUnit = found.default_pack_unit || '';
        const capacityQty = found.default_capacity_qty || (baseUnit === 'ml' ? 1000 : baseUnit === 'g' ? 500 : 1);
        const capacityUnit = found.default_capacity_unit || baseUnit;
        const lossRate = found.loss_rate || 0;
        const pQty = item.purchase_quantity > 0 ? item.purchase_quantity : 1;
        
        let pPrice = item.purchase_unit_price;
        if (pPrice === 0 && found.latest_purchase_price > 0) {
          const factor = packQty * capacityQty;
          pPrice = Math.round(found.latest_purchase_price * factor);
        }

        const res = calculatePurchaseConversion({
          purchaseQty: pQty,
          purchaseUnitPrice: pPrice,
          purchaseUnit,
          packQty,
          packUnit,
          capacityQty,
          capacityUnit,
          baseUnit,
          lossRate,
        });

        updated[index] = {
          ...item,
          ingredient_id: found.id,
          ingredient_name: found.name,
          category: (found.category as any) || 'ingredient',
          base_unit: baseUnit,
          purchase_unit: purchaseUnit,
          purchase_quantity: pQty,
          purchase_unit_price: pPrice,
          pack_qty: packQty,
          pack_unit: packUnit,
          capacity_qty: capacityQty,
          capacity_unit: capacityUnit,
          loss_rate: lossRate,
          total_base_quantity: res.totalBaseQuantity,
          base_unit_price: res.baseUnitPrice,
          effective_base_quantity: res.effectiveBaseQuantity,
          effective_base_price: res.effectiveBasePrice,
          subtotal: res.subtotal,
          conversion_spec: res.conversionSpec,
          is_custom_new: false,
          is_multi_level: packQty > 1,
          show_loss_input: lossRate > 0,
        };
        return updated;
      });
    } else {
      setPurchaseItems((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ingredient_id: undefined,
          ingredient_name: '',
          is_custom_new: false,
        };
        return updated;
      });
    }
  };

  const handleApplyPreset = (index: number, preset: IngredientConversionPreset) => {
    setPurchaseItems((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const pQty = item.purchase_quantity > 0 ? item.purchase_quantity : 1;
      const packQty = preset.pack_qty || 1;
      const capacityQty = preset.capacity_qty || 1;
      const lossRate = preset.loss_rate ?? item.loss_rate ?? 0;

      const res = calculatePurchaseConversion({
        purchaseQty: pQty,
        purchaseUnitPrice: item.purchase_unit_price,
        purchaseUnit: preset.purchase_unit,
        packQty,
        packUnit: preset.pack_unit,
        capacityQty,
        capacityUnit: preset.capacity_unit,
        baseUnit: item.base_unit || 'ml',
        lossRate,
      });

      updated[index] = {
        ...item,
        purchase_unit: preset.purchase_unit,
        pack_qty: packQty,
        pack_unit: preset.pack_unit || '',
        capacity_qty: capacityQty,
        capacity_unit: preset.capacity_unit || item.base_unit || 'ml',
        loss_rate: lossRate,
        total_base_quantity: res.totalBaseQuantity,
        base_unit_price: res.baseUnitPrice,
        effective_base_quantity: res.effectiveBaseQuantity,
        effective_base_price: res.effectiveBasePrice,
        subtotal: res.subtotal,
        conversion_spec: res.conversionSpec,
        is_multi_level: packQty > 1,
        show_loss_input: lossRate > 0,
      };
      return updated;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (purchaseItems.length === 1) {
      setPurchaseItems([createDefaultPurchaseItem(false)]);
      return;
    }
    setPurchaseItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof PurchaseLineItem, value: any) => {
    setPurchaseItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'ingredient_name') {
        const found = knownIngredients.find(
          (ing) => ing.name.toLowerCase().trim() === String(value).toLowerCase().trim()
        );
        if (found) {
          item.ingredient_id = found.id;
          item.base_unit = found.base_unit || found.unit || item.base_unit;
          item.category = found.category || item.category;
          if (found.default_purchase_unit) item.purchase_unit = found.default_purchase_unit;
          if (found.default_pack_qty) item.pack_qty = found.default_pack_qty;
          if (found.default_pack_unit) item.pack_unit = found.default_pack_unit;
          if (found.default_capacity_qty) item.capacity_qty = found.default_capacity_qty;
          if (found.default_capacity_unit) item.capacity_unit = found.default_capacity_unit;
          if (found.loss_rate) item.loss_rate = found.loss_rate;
        } else {
          item.ingredient_id = undefined;
        }
      }

      const res = calculatePurchaseConversion({
        purchaseQty: Number(item.purchase_quantity) || 0,
        purchaseUnitPrice: Number(item.purchase_unit_price) || 0,
        purchaseUnit: item.purchase_unit,
        packQty: Number(item.pack_qty) || 1,
        packUnit: item.pack_unit,
        capacityQty: Number(item.capacity_qty) || 1,
        capacityUnit: item.capacity_unit,
        baseUnit: item.base_unit || 'ml',
        lossRate: Number(item.loss_rate) || 0,
      });

      item.total_base_quantity = res.totalBaseQuantity;
      item.subtotal = res.subtotal;
      item.base_unit_price = res.baseUnitPrice;
      item.effective_base_quantity = res.effectiveBaseQuantity;
      item.effective_base_price = res.effectiveBasePrice;
      item.conversion_spec = res.conversionSpec;

      updated[index] = item;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!modalFundId) {
      setErrorMessage(t('tx.error_select_fund') || 'Vui lòng chọn tài khoản quỹ');
      return;
    }

    if (modalAmount <= 0) {
      setErrorMessage(t('tx.error_enter_amount') || 'Vui lòng nhập số tiền hợp lệ lớn hơn 0');
      return;
    }

    if (isPurchaseLogging && modalType === 'outflow') {
      const validItems = purchaseItems.filter(
        (p) => (p.ingredient_name.trim() !== '' || (p.ingredient_id && p.ingredient_id > 0)) && p.purchase_quantity > 0
      );
      if (validItems.length === 0) {
        setErrorMessage('Vui lòng nhập ít nhất 1 nguyên liệu hợp lệ với số lượng > 0');
        return;
      }
      for (const item of validItems) {
        if (item.purchase_quantity <= 0 || item.capacity_qty <= 0 || item.purchase_unit_price < 0) {
          setErrorMessage(`Quy cách hoặc đơn giá của "${item.ingredient_name || 'nguyên liệu'}" không hợp lệ.`);
          return;
        }
      }
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

        if (modalType === 'outflow') {
          if (isPurchaseLogging) {
            const validItems = purchaseItems
              .filter((p) => p.ingredient_name.trim() !== '' && p.purchase_quantity > 0)
              .map((p) => ({
                ingredient_name: p.ingredient_name.trim(),
                ingredient_id: p.ingredient_id,
                category: p.category,
                quantity: Number(p.total_base_quantity) || Number(p.purchase_quantity),
                unit_price: Number(p.effective_base_price) || Number(p.purchase_unit_price),
                unit: p.base_unit || p.purchase_unit || 'kg',
                purchase_unit: p.purchase_unit.trim(),
                purchase_quantity: Number(p.purchase_quantity),
                purchase_unit_price: Number(p.purchase_unit_price),
                pack_qty: Number(p.pack_qty) || 1,
                pack_unit: p.pack_unit.trim(),
                capacity_qty: Number(p.capacity_qty) || 1,
                capacity_unit: p.capacity_unit.trim(),
                total_base_quantity: Number(p.total_base_quantity),
                base_unit: p.base_unit.trim(),
                base_unit_price: Number(p.base_unit_price),
                loss_rate: Number(p.loss_rate) || 0,
                effective_base_quantity: Number(p.effective_base_quantity),
                effective_base_price: Number(p.effective_base_price),
                conversion_spec: p.conversion_spec,
              }));
            payload.purchase_items = validItems;
          }
        }

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
            .filter((p) => p.ingredient_name.trim() !== '' && p.purchase_quantity > 0)
            .map((p) => ({
              ingredient_name: p.ingredient_name.trim(),
              ingredient_id: p.ingredient_id,
              category: p.category,
              quantity: Number(p.total_base_quantity) || Number(p.purchase_quantity),
              unit_price: Number(p.effective_base_price) || Number(p.purchase_unit_price),
              unit: p.base_unit || p.purchase_unit || 'kg',
              purchase_unit: p.purchase_unit.trim(),
              purchase_quantity: Number(p.purchase_quantity),
              purchase_unit_price: Number(p.purchase_unit_price),
              pack_qty: Number(p.pack_qty) || 1,
              pack_unit: p.pack_unit.trim(),
              capacity_qty: Number(p.capacity_qty) || 1,
              capacity_unit: p.capacity_unit.trim(),
              total_base_quantity: Number(p.total_base_quantity),
              base_unit: p.base_unit.trim(),
              base_unit_price: Number(p.base_unit_price),
              loss_rate: Number(p.loss_rate) || 0,
              effective_base_quantity: Number(p.effective_base_quantity),
              effective_base_price: Number(p.effective_base_price),
              conversion_spec: p.conversion_spec,
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
    const list = txCategories
      .filter((c) => c.type === modalType || c.type === 'both')
      .map((c) => ({
        value: c.code || c.name,
        label: c.name,
      }));

    if (list.length === 0) {
      if (modalType === 'outflow') {
        list.push({ value: 'ingredient_purchase', label: 'Mua nguyên liệu' });
        list.push({ value: 'utilities', label: 'Điện nước / Internet' });
        list.push({ value: 'rent', label: 'Tiền thuê mặt bằng' });
        list.push({ value: 'other_expense', label: 'Chi phí khác' });
      } else {
        list.push({ value: 'capital_injection', label: 'Nạp tiền vào quỹ' });
        list.push({ value: 'other_income', label: 'Thu nhập khác' });
      }
    }
    return list;
  }, [txCategories, modalType]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full flex flex-col h-[94dvh] sm:h-auto sm:max-h-[90vh] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 shrink-0 bg-white">
          <div className="flex items-center space-x-2.5">
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-white shadow-xs ${
                modalType === 'inflow' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {modalType === 'inflow' ? '+' : '-'}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                {isEditing ? (t('tx.modal_title_edit') || 'Chỉnh Sửa Giao Dịch') : (t('tx.modal_title_add') || 'Tạo Giao Dịch Mới')}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500">
                {isEditing
                  ? (t('tx.modal_subtitle_edit') || 'Cập nhật thông tin phiếu thu chi hoặc nguyên liệu đã ghi')
                  : (t('tx.modal_subtitle_add') || 'Ghi nhận dòng tiền ra/vào hoặc chi mua nguyên liệu')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="tx-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Transaction Type Segmented Toggle */}
          <div>
            <label className="font-bold text-slate-700 mb-1.5 block text-xs">
              {t('tx.modal_type_label')} *
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setModalType('inflow')}
                className={`py-2 text-xs font-extrabold rounded-xl transition ${
                  modalType === 'inflow'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + {t('tx.type_inflow')} (Tiền Vào)
              </button>
              <button
                type="button"
                onClick={() => setModalType('outflow')}
                className={`py-2 text-xs font-extrabold rounded-xl transition ${
                  modalType === 'outflow'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                - {t('tx.type_outflow')} (Tiền Ra)
              </button>
            </div>
          </div>

          {/* Fund and Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                onChange={(val) => {
                  const catVal = String(val);
                  setModalCategory(catVal);
                  const isPurchaseCat =
                    catVal === 'ingredient_purchase' ||
                    catVal.toLowerCase().includes('nguyên liệu') ||
                    catVal.toLowerCase().includes('hàng hóa') ||
                    catVal.toLowerCase().includes('purchase');
                  if (isPurchaseCat && modalType === 'outflow') {
                    setIsPurchaseLogging(true);
                  }
                }}
                options={categoryOptions}
              />
            </div>
          </div>

          {/* Integrated Itemized Purchases Toggle & Detailed Conversion Engine */}
          {modalType === 'outflow' && (
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                      Chi Mua Nguyên Liệu & Quy Đổi Giá Vốn
                      <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-1.5 py-0.2 rounded-md">
                        Tự động tính cost
                      </span>
                    </span>
                    <p className="text-[11px] text-emerald-700">
                      Nhập theo chai, túi, thùng... tự động quy đổi thành ml, g, cái để tính cost món
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
                  <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-700"></div>
                </label>
              </div>

              {/* Purchase Items List with Detailed Mobile-Friendly Conversion UI */}
              {isPurchaseLogging && (
                <div className="space-y-3 pt-2 border-t border-emerald-200/60">
                  {purchaseItems.map((item, idx) => {
                    const matchedIng = knownIngredients.find(
                      (i) => i.id === item.ingredient_id || i.name.toLowerCase() === item.ingredient_name.toLowerCase()
                    );
                    let presets: IngredientConversionPreset[] = [];
                    if (matchedIng?.saved_conversions) {
                      try {
                        presets = typeof matchedIng.saved_conversions === 'string'
                          ? JSON.parse(matchedIng.saved_conversions)
                          : matchedIng.saved_conversions;
                      } catch {}
                    }

                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl p-3 sm:p-3.5 border border-emerald-200/90 shadow-2xs space-y-2.5 transition-all hover:border-emerald-300"
                      >
                        {/* Line Item Header: Ingredient Selector & Category */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {item.is_custom_new ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  required
                                  autoFocus
                                  placeholder="Nhập tên nguyên liệu mới (vd: Cốt cà phê, Sữa tươi...)"
                                  value={item.ingredient_name}
                                  onChange={(e) =>
                                    handleItemChange(idx, 'ingredient_name', e.target.value)
                                  }
                                  className="flex-1 h-9 px-2.5 border border-amber-300 bg-amber-50/50 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPurchaseItems((prev) => {
                                      const updated = [...prev];
                                      updated[idx] = {
                                        ...updated[idx],
                                        is_custom_new: false,
                                        ingredient_id: undefined,
                                        ingredient_name: '',
                                      };
                                      return updated;
                                    });
                                  }}
                                  className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-lg border border-emerald-200 shrink-0 cursor-pointer"
                                >
                                  ↺ Chọn có sẵn
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <select
                                  required
                                  value={item.ingredient_id || ''}
                                  onChange={(e) => handleSelectIngredient(idx, e.target.value)}
                                  className="flex-1 h-9 px-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                >
                                  <option value="">— Chọn nguyên liệu nhập hàng —</option>
                                  {knownIngredients.map((ing) => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.base_unit || ing.unit}){' '}
                                      {ing.latest_purchase_price > 0
                                        ? `— ${formatCurrency(ing.latest_purchase_price)}/${ing.base_unit || ing.unit}`
                                        : ''}
                                    </option>
                                  ))}
                                  <option value="__custom_new__" className="font-bold text-amber-700">
                                    ➕ + Thêm nguyên liệu mới...
                                  </option>
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 justify-between sm:justify-end">
                            <select
                              value={item.category}
                              onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                              className="h-8 px-2 border border-slate-200 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-700"
                            >
                              <option value="fruit">Hoa quả tươi</option>
                              <option value="ingredient">Nguyên liệu / Sữa</option>
                              <option value="packaging">Bao bì / Ly nắp</option>
                              <option value="other">Khác</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Presets Quick Selector if Available */}
                        {presets.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Quy cách lưu sẵn:</span>
                            {presets.map((pr, pIdx) => (
                              <button
                                key={pIdx}
                                type="button"
                                onClick={() => handleApplyPreset(idx, pr)}
                                className="text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition cursor-pointer"
                              >
                                {pr.label || `${pr.purchase_unit} (${pr.pack_qty > 1 ? `${pr.pack_qty}x` : ''}${pr.capacity_qty}${pr.capacity_unit})`}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Conversion Form: Responsive Grid for Mobile & Desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                          {/* 1. Số lượng mua */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              Số lượng mua *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              required
                              value={item.purchase_quantity === 0 ? '' : item.purchase_quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'purchase_quantity',
                                  e.target.value === '' ? 0 : parseFloat(e.target.value)
                                )
                              }
                              placeholder="2"
                              className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-black text-center text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          {/* 2. Đơn vị mua */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              Đơn vị mua *
                            </label>
                            <select
                              value={item.purchase_unit}
                              onChange={(e) => handleItemChange(idx, 'purchase_unit', e.target.value)}
                              className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                              {COMMON_PURCHASE_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 3. Quy cách mỗi đơn vị */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5 truncate">
                              {item.purchase_unit === 'Thùng' || item.is_multi_level
                                ? 'Quy cách / Đơn vị'
                                : `Mỗi ${item.purchase_unit} chứa`}
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                required
                                value={item.capacity_qty === 0 ? '' : item.capacity_qty}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    'capacity_qty',
                                    e.target.value === '' ? 0 : parseFloat(e.target.value)
                                  )
                                }
                                placeholder="1000"
                                className="w-full min-w-0 h-9 px-1.5 border border-slate-200 rounded-xl text-xs font-black text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <select
                                value={item.capacity_unit}
                                onChange={(e) => handleItemChange(idx, 'capacity_unit', e.target.value)}
                                className="h-9 px-1.5 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 shrink-0"
                              >
                                <option value="ml">ml</option>
                                <option value="l">Lít</option>
                                <option value="g">g</option>
                                <option value="kg">kg</option>
                                <option value="cái">cái</option>
                                <option value="quả">quả</option>
                                <option value="viên">viên</option>
                                <option value="hộp">hộp</option>
                                <option value="lon">lon</option>
                                <option value="gói">gói</option>
                              </select>
                            </div>
                          </div>

                          {/* 4. Giá mỗi đơn vị mua */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5 truncate">
                              Giá mua (đ/{item.purchase_unit}) *
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              required
                              placeholder="120.000"
                              value={item.purchase_unit_price === 0 ? '' : item.purchase_unit_price}
                              onChange={(e) =>
                                handleItemChange(
                                  idx,
                                  'purchase_unit_price',
                                  e.target.value === '' ? 0 : parseFloat(e.target.value)
                                )
                              }
                              className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-black text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        {/* Multi-level toggle & Loss Rate toggle */}
                        <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 font-semibold select-none">
                              <input
                                type="checkbox"
                                checked={item.is_multi_level}
                                onChange={(e) => {
                                  handleItemChange(idx, 'is_multi_level', e.target.checked);
                                  if (!e.target.checked) {
                                    handleItemChange(idx, 'pack_qty', 1);
                                    handleItemChange(idx, 'pack_unit', '');
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span>Quy cách thùng</span>
                            </label>

                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-600 font-semibold select-none">
                              <input
                                type="checkbox"
                                checked={item.show_loss_input}
                                onChange={(e) => {
                                  handleItemChange(idx, 'show_loss_input', e.target.checked);
                                  if (!e.target.checked) {
                                    handleItemChange(idx, 'loss_rate', 0);
                                  }
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                              />
                              <span>Hao hụt %</span>
                            </label>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Thành tiền:</span>
                            <span className="text-xs font-black text-slate-900">
                              {formatCurrency(item.subtotal)}
                            </span>
                          </div>
                        </div>

                        {/* Multi-level Specification Inputs */}
                        {item.is_multi_level && (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 font-bold block mb-0.5">
                                Số lượng gói trong 1 {item.purchase_unit}:
                              </span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.pack_qty}
                                onChange={(e) =>
                                  handleItemChange(idx, 'pack_qty', parseFloat(e.target.value) || 1)
                                }
                                placeholder="12"
                                className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 font-bold block mb-0.5">
                                Tên gói con:
                              </span>
                              <input
                                type="text"
                                value={item.pack_unit}
                                onChange={(e) => handleItemChange(idx, 'pack_unit', e.target.value)}
                                placeholder="Chai, Hộp, Túi..."
                                className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-center bg-white"
                              />
                            </div>

                            <div className="flex items-center text-[11px] text-slate-600 font-medium pt-1 sm:pt-0">
                              = {item.pack_qty} {item.pack_unit || 'gói'} × {item.capacity_qty} {item.capacity_unit}
                            </div>
                          </div>
                        )}

                        {/* Loss Rate Input */}
                        {item.show_loss_input && (
                          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-900 shrink-0">
                                Hao hụt sơ chế:
                              </span>
                              <div className="flex items-center gap-1.5 w-24">
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  max="99"
                                  value={Math.round(item.loss_rate * 100)}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    handleItemChange(idx, 'loss_rate', val / 100);
                                  }}
                                  className="w-full h-8 px-2 border border-amber-300 rounded-lg text-xs font-black text-center bg-white text-amber-950"
                                />
                                <span className="font-bold text-amber-800">%</span>
                              </div>
                            </div>
                            <span className="text-[10px] text-amber-700 font-medium">
                              (Lượng tính cost: {formatQuantityWithUnit(item.effective_base_quantity, item.base_unit)})
                            </span>
                          </div>
                        )}

                        {/* Real-time Calculation Result Banner */}
                        <div className="bg-emerald-100/60 rounded-xl p-2.5 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap text-emerald-950 font-bold text-[11px] sm:text-xs">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>
                              {item.conversion_spec || `${item.purchase_quantity} ${item.purchase_unit}`} ={' '}
                              <strong className="text-emerald-900">
                                {formatQuantityWithUnit(item.total_base_quantity, item.base_unit)}
                              </strong>
                            </span>
                            <span className="text-emerald-400">•</span>
                            <span>
                              Tổng: <strong>{formatCurrency(item.subtotal)}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-right self-end sm:self-auto shrink-0">
                            {item.loss_rate > 0 ? (
                              <span className="bg-emerald-700 text-white font-black text-[11px] sm:text-xs px-2 py-0.5 rounded-lg shadow-2xs">
                                Cost thực tế: {formatCurrency(item.effective_base_price)}/{item.base_unit}
                              </span>
                            ) : (
                              <span className="bg-emerald-700 text-white font-black text-[11px] sm:text-xs px-2 py-0.5 rounded-lg shadow-2xs">
                                Giá quy đổi: {formatCurrency(item.base_unit_price)}/{item.base_unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Row Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddRow(false)}
                      className="inline-flex items-center justify-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white hover:bg-emerald-100/50 px-3 py-2 rounded-xl border border-emerald-300 transition active:scale-95 shadow-2xs cursor-pointer text-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm mặt hàng</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddRow(true)}
                      className="inline-flex items-center justify-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-xl border border-amber-300 transition active:scale-95 shadow-2xs cursor-pointer text-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ NL mới</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 text-xs">
                {t('tx.modal_amount_label')} (VNĐ) *
              </label>
              {isPurchaseLogging && modalType === 'outflow' && (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-md">
                  ⚡ Tự động tính từ danh sách
                </span>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              required
              disabled={isPurchaseLogging && modalType === 'outflow'}
              placeholder="120.000"
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
          <div className="space-y-1.5 text-xs">
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

            <input
              type="datetime-local"
              value={
                modalCreatedAt
                  ? (() => {
                      try {
                        const d = new Date(modalCreatedAt);
                        const offset = d.getTimezoneOffset() * 60000;
                        return new Date(d.getTime() - offset).toISOString().slice(0, 16);
                      } catch {
                        return '';
                      }
                    })()
                  : ''
              }
              onChange={(e) => {
                if (e.target.value) {
                  setModalCreatedAt(new Date(e.target.value).toISOString());
                } else {
                  setModalCreatedAt(null);
                }
              }}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Description & Note */}
          <div>
            <label className="font-bold text-slate-700 mb-1 block text-xs">
              {t('tx.modal_description_label')} / Ghi chú nhà cung cấp
            </label>
            <textarea
              rows={2}
              placeholder="VD: Nhập 2 chai cốt cà phê, 3 thùng sữa tươi Dalat Milk..."
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </form>

        {/* Sticky Action Footer */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-between shrink-0">
          <div className="text-xs font-bold text-slate-600">
            Tổng tiền: <span className="text-rose-600 text-sm font-black">{formatCurrency(modalAmount)}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              form="tx-modal-form"
              disabled={isSubmitting}
              className={`px-4 sm:px-5 py-2 text-xs font-extrabold text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                modalType === 'inflow'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : null}
              <span>{isEditing ? (t('common.save') || 'Lưu thay đổi') : (t('tx.modal_btn_submit') || 'Lưu Giao Dịch')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
