'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Scale,
  ChevronDown,
  ChevronUp,
  History,
  X,
  PlusCircle,
  Package,
  Sparkles,
  Sliders,
  Calculator,
} from 'lucide-react';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import HorizontalScroller from '@/components/common/HorizontalScroller';
import { fetchApi, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import {
  Ingredient,
  IngredientConversionPreset,
  CostComparisonItem,
  RecipeDetailItem,
  IngredientHistoryRecord,
} from '@/types/purchase';
import { TransactionCategory } from '@/types/transaction_category';
import {
  COMMON_BASE_UNITS,
  COMMON_PURCHASE_UNITS,
  formatQuantityWithUnit,
} from '@/lib/unitConversion';
import {
  POPULAR_RECIPE_TEMPLATES,
  findMatchingRecipeTemplate,
  mapTemplateToIngredients,
  RecipeTemplate,
} from '@/lib/recipeTemplates';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
}

interface PurchasesCostTabProps {
  onOpenExpenseModal?: () => void;
  settings?: SettingsMap | null;
  funds?: Fund[];
  txCategories?: TransactionCategory[];
  onDataChanged?: () => void;
  refreshTrigger?: number;
}

export default function PurchasesCostTab({
  onOpenExpenseModal,
  settings: propSettings,
  funds = [],
  txCategories = [],
  onDataChanged,
  refreshTrigger = 0,
}: PurchasesCostTabProps) {
  const { t } = useTranslation();

  // Active Sub-Tab: 'profit-recovery' | 'purchase-history' | 'ingredients'
  const [activeSubTab, setActiveSubTab] = useState<'profit-recovery' | 'purchase-history' | 'ingredients'>('profit-recovery');

  // Pricing Mode in Cost Estimator: 'latest' | 'average'
  const [pricingBasis, setPricingBasis] = useState<'latest' | 'average'>('latest');

  // Main Data States
  const [costItems, setCostItems] = useState<CostComparisonItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [allHistory, setAllHistory] = useState<IngredientHistoryRecord[]>([]);
  const [totalSpend, setTotalSpend] = useState<number>(0);
  const [settings, setSettings] = useState<SettingsMap | null>(propSettings || null);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_update' | 'low_margin' | 'high_margin' | 'no_recipe'>('all');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [ingSearchQuery, setIngSearchQuery] = useState<string>('');
  const [ingCategoryFilter, setIngCategoryFilter] = useState<string>('all');

  // Expanded Recipe Details Card/Row
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Recipe Editor Modal State
  const [editingRecipeTarget, setEditingRecipeTarget] = useState<CostComparisonItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: number; usage_quantity: number }[]>([]);
  const [simulatedPrice, setSimulatedPrice] = useState<number>(0);
  const [savingRecipe, setSavingRecipe] = useState<boolean>(false);

  // Ingredient Create / Edit Modal State
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingFormName, setIngFormName] = useState<string>('');
  const [ingFormCategory, setIngFormCategory] = useState<string>('fruit');
  const [ingFormBaseUnit, setIngFormBaseUnit] = useState<string>('ml');
  const [ingFormLossRate, setIngFormLossRate] = useState<number>(0.0);
  const [ingFormPrice, setIngFormPrice] = useState<number>(0);
  const [ingFormDefaultPurchaseUnit, setIngFormDefaultPurchaseUnit] = useState<string>('Chai');
  const [ingFormDefaultPackQty, setIngFormDefaultPackQty] = useState<number>(1);
  const [ingFormDefaultPackUnit, setIngFormDefaultPackUnit] = useState<string>('');
  const [ingFormDefaultCapacityQty, setIngFormDefaultCapacityQty] = useState<number>(1000);
  const [ingFormDefaultCapacityUnit, setIngFormDefaultCapacityUnit] = useState<string>('ml');
  const [ingFormPresets, setIngFormPresets] = useState<IngredientConversionPreset[]>([]);
  const [savingIngredient, setSavingIngredient] = useState<boolean>(false);

  // Single Ingredient History Modal State
  const [viewingHistoryIng, setViewingHistoryIng] = useState<Ingredient | null>(null);
  const [ingHistoryRecords, setIngHistoryRecords] = useState<IngredientHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Toast Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [applyingCostId, setApplyingCostId] = useState<string | null>(null);
  const [bulkApplying, setBulkApplying] = useState<boolean>(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [costRes, ingRes, histRes, setRes] = await Promise.all([
        fetchApi<CostComparisonItem[]>('/purchases/cost-comparison'),
        fetchApi<Ingredient[]>('/purchases/ingredients'),
        fetchApi<{ items: IngredientHistoryRecord[]; total_spend: number }>('/purchases/history'),
        propSettings ? Promise.resolve({ status: 'success', data: propSettings }) : fetchApi<SettingsMap>('/settings'),
      ]);

      if (costRes.status === 'success' && Array.isArray(costRes.data)) {
        setCostItems(costRes.data);
      }
      if (ingRes.status === 'success' && Array.isArray(ingRes.data)) {
        setIngredients(ingRes.data);
      }
      if (histRes.status === 'success' && histRes.data) {
        setAllHistory(histRes.data.items || []);
        setTotalSpend(histRes.data.total_spend || 0);
      }
      if (setRes.status === 'success' && setRes.data) {
        setSettings(setRes.data as SettingsMap);
      }
    } catch {
      showToast('error', 'Lỗi khi tải dữ liệu mua hàng & giá vốn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (propSettings) setSettings(propSettings);
  }, [propSettings]);

  const filterCounts = useMemo(() => {
    let needsUpdate = 0;
    let lowMargin = 0;
    let highMargin = 0;
    let noRecipe = 0;

    costItems.forEach((item) => {
      const estCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
      const margin = item.retail_price > 0 ? (item.retail_price - estCost) / item.retail_price : 0;
      if (item.recipe_item_count === 0) {
        noRecipe++;
      } else {
        if (Math.abs(estCost - item.current_cogs) >= 1) needsUpdate++;
        if (margin < 0.5) lowMargin++;
        if (margin >= 0.65) highMargin++;
      }
    });

    return {
      all: costItems.length,
      needsUpdate,
      lowMargin,
      highMargin,
      noRecipe,
    };
  }, [costItems, pricingBasis]);

  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    costItems.forEach((item) => {
      if (item.category_name) set.add(item.category_name);
    });
    return Array.from(set);
  }, [costItems]);

  const categoryOptions: ModernSelectOption[] = useMemo(() => {
    const list: ModernSelectOption[] = [
      { value: 'all', label: `Tất cả danh mục (${costItems.length})` },
    ];
    categoriesList.forEach((cat) => {
      const count = costItems.filter((i) => i.category_name === cat).length;
      list.push({
        value: cat,
        label: `${cat} (${count})`,
      });
    });
    return list;
  }, [categoriesList, costItems]);

  const filteredCostItems = useMemo(() => {
    return costItems.filter((item) => {
      const matchesSearch =
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.variant_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === 'all' || item.category_name === selectedCategory;

      if (!matchesSearch || !matchesCat) return false;

      const estCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
      const margin = item.retail_price > 0 ? (item.retail_price - estCost) / item.retail_price : 0;

      if (statusFilter === 'needs_update') {
        return item.recipe_item_count > 0 && Math.abs(estCost - item.current_cogs) >= 1;
      }
      if (statusFilter === 'low_margin') {
        return item.retail_price > 0 && margin < 0.5;
      }
      if (statusFilter === 'high_margin') {
        return item.retail_price > 0 && margin >= 0.65;
      }
      if (statusFilter === 'no_recipe') {
        return item.recipe_item_count === 0;
      }

      return true;
    });
  }, [costItems, searchQuery, selectedCategory, statusFilter, pricingBasis]);

  const filteredHistory = useMemo(() => {
    return allHistory.filter((item) => {
      const q = historySearch.toLowerCase().trim();
      if (!q) return true;
      return (
        (item.ingredient_name || '').toLowerCase().includes(q) ||
        (item.conversion_spec || '').toLowerCase().includes(q) ||
        (item.purchase_unit || '').toLowerCase().includes(q) ||
        (item.fund_name || '').toLowerCase().includes(q)
      );
    });
  }, [allHistory, historySearch]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch = ing.name.toLowerCase().includes(ingSearchQuery.toLowerCase());
      const matchesCat =
        ingCategoryFilter === 'all' || ing.category === ingCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [ingredients, ingSearchQuery, ingCategoryFilter]);

  const metrics = useMemo(() => {
    const totalItems = costItems.length;
    const itemsWithRecipe = costItems.filter((i) => i.recipe_item_count > 0).length;

    let totalDiff = 0;
    let totalMargin = 0;
    let countedForMargin = 0;

    costItems.forEach((i) => {
      if (i.recipe_item_count > 0) {
        const estCost = pricingBasis === 'latest' ? i.estimated_cogs : i.estimated_cogs_avg;
        totalDiff += estCost - i.current_cogs;
        if (i.retail_price > 0) {
          totalMargin += ((i.retail_price - estCost) / i.retail_price) * 100;
          countedForMargin++;
        }
      }
    });

    const avgMargin = countedForMargin > 0 ? Math.round((totalMargin / countedForMargin) * 10) / 10 : 0;

    return {
      totalItems,
      itemsWithRecipe,
      totalSpend,
      avgMargin,
      totalDiff: Math.round(totalDiff),
    };
  }, [costItems, totalSpend, pricingBasis]);

  const handleApplySingleCost = async (item: CostComparisonItem) => {
    const newCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
    if (newCost <= 0) {
      showToast('error', 'Giá vốn chưa được tính toán qua công thức');
      return;
    }

    const key = `${item.target_type}-${item.target_id}`;
    setApplyingCostId(key);

    try {
      const res = await fetchApi('/purchases/apply-cost', {
        method: 'POST',
        body: JSON.stringify({
          target_type: item.target_type,
          target_id: item.target_id,
          new_cost: newCost,
        }),
      });

      if (res.status === 'success') {
        showToast(
          'success',
          `Đã cập nhật giá vốn món "${item.product_name} (${item.variant_name})" thành ${formatCurrency(
            newCost,
            settings
          )}`
        );
        loadData();
        if (onDataChanged) onDataChanged();
      } else {
        showToast('error', res.message || 'Lỗi khi cập nhật giá vốn');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setApplyingCostId(null);
    }
  };

  const handleBulkApplyAll = async () => {
    const itemsToApply: { target_type: string; target_id: number; new_cost: number }[] = [];

    costItems.forEach((item) => {
      if (item.recipe_item_count > 0) {
        const estCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
        if (estCost > 0 && Math.abs(estCost - item.current_cogs) >= 1) {
          itemsToApply.push({
            target_type: item.target_type,
            target_id: item.target_id,
            new_cost: estCost,
          });
        }
      }
    });

    if (itemsToApply.length === 0) {
      showToast('success', 'Tất cả các món đã đồng bộ giá vốn mới nhất!');
      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn đồng bộ giá vốn mới tính toán cho ${itemsToApply.length} món trên Menu bán hàng?`
      )
    ) {
      return;
    }

    setBulkApplying(true);
    try {
      const res = await fetchApi('/purchases/apply-cost', {
        method: 'POST',
        body: JSON.stringify({ items: itemsToApply }),
      });

      if (res.status === 'success') {
        showToast(
          'success',
          `Đã cập nhật giá vốn thành công cho ${itemsToApply.length} món trên Menu!`
        );
        loadData();
        if (onDataChanged) onDataChanged();
      } else {
        showToast('error', res.message || 'Lỗi khi cập nhật hàng loạt');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setBulkApplying(false);
    }
  };

  const handleOpenRecipeEditor = async (item: CostComparisonItem) => {
    setEditingRecipeTarget(item);
    setSimulatedPrice(item.retail_price || 0);
    try {
      const res = await fetchApi<any[]>(`/purchases/recipes/${item.target_type}/${item.target_id}`);
      if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
        setRecipeLines(
          res.data.map((r) => ({
            ingredient_id: r.ingredient_id,
            usage_quantity: r.usage_quantity,
          }))
        );
      } else {
        const matched = findMatchingRecipeTemplate(item.product_name, item.category_name);
        if (matched && ingredients.length > 0) {
          const mapped = mapTemplateToIngredients(matched, ingredients);
          setRecipeLines(mapped.map((m) => ({ ingredient_id: m.ingredient_id, usage_quantity: m.usage_quantity })));
        } else {
          setRecipeLines([{ ingredient_id: ingredients[0]?.id || 0, usage_quantity: 60 }]);
        }
      }
    } catch {
      setRecipeLines([{ ingredient_id: ingredients[0]?.id || 0, usage_quantity: 60 }]);
    }
  };

  const handleApplyPresetTemplate = (template: RecipeTemplate) => {
    if (ingredients.length === 0) return;
    const mapped = mapTemplateToIngredients(template, ingredients);
    setRecipeLines(mapped.map((m) => ({ ingredient_id: m.ingredient_id, usage_quantity: m.usage_quantity })));
    showToast('success', `Đã nạp công thức mẫu "${template.name}"`);
  };

  const handleSaveRecipe = async () => {
    if (!editingRecipeTarget) return;

    const validItems = recipeLines.filter(
      (r) => r.ingredient_id > 0 && r.usage_quantity > 0
    );

    setSavingRecipe(true);
    try {
      const res = await fetchApi(
        `/purchases/recipes/${editingRecipeTarget.target_type}/${editingRecipeTarget.target_id}`,
        {
          method: 'POST',
          body: JSON.stringify({ items: validItems }),
        }
      );

      if (res.status === 'success') {
        showToast('success', 'Đã lưu công thức & cập nhật bảng tính giá vốn thành công!');
        setEditingRecipeTarget(null);
        loadData();
        if (onDataChanged) onDataChanged();
      } else {
        showToast('error', res.message || 'Lỗi khi lưu công thức');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleOpenAddIngredient = () => {
    setEditingIngredient(null);
    setIngFormName('');
    setIngFormCategory('fruit');
    setIngFormBaseUnit('ml');
    setIngFormLossRate(0.0);
    setIngFormPrice(0);
    setIngFormDefaultPurchaseUnit('Chai');
    setIngFormDefaultPackQty(1);
    setIngFormDefaultPackUnit('');
    setIngFormDefaultCapacityQty(1000);
    setIngFormDefaultCapacityUnit('ml');
    setIngFormPresets([]);
    setIsIngredientModalOpen(true);
  };

  const handleOpenEditIngredient = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setIngFormName(ing.name);
    setIngFormCategory(ing.category || 'fruit');
    const baseUnit = ing.base_unit || ing.unit || 'ml';
    setIngFormBaseUnit(baseUnit);
    setIngFormLossRate(ing.loss_rate || 0.0);
    setIngFormPrice(ing.latest_purchase_price || 0);
    setIngFormDefaultPurchaseUnit(ing.default_purchase_unit || (baseUnit === 'ml' ? 'Chai' : baseUnit === 'g' ? 'Túi' : 'Cái'));
    setIngFormDefaultPackQty(ing.default_pack_qty || 1);
    setIngFormDefaultPackUnit(ing.default_pack_unit || '');
    setIngFormDefaultCapacityQty(ing.default_capacity_qty || (baseUnit === 'ml' ? 1000 : baseUnit === 'g' ? 500 : 1));
    setIngFormDefaultCapacityUnit(ing.default_capacity_unit || baseUnit);

    let parsedPresets: IngredientConversionPreset[] = [];
    if (ing.saved_conversions) {
      try {
        parsedPresets = typeof ing.saved_conversions === 'string'
          ? JSON.parse(ing.saved_conversions)
          : ing.saved_conversions;
      } catch {}
    }
    setIngFormPresets(parsedPresets);
    setIsIngredientModalOpen(true);
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingFormName.trim()) return;

    setSavingIngredient(true);
    try {
      const payload = {
        name: ingFormName.trim(),
        category: ingFormCategory,
        base_unit: ingFormBaseUnit.trim(),
        unit: ingFormBaseUnit.trim(),
        loss_rate: Number(ingFormLossRate) || 0,
        latest_purchase_price: Number(ingFormPrice) || 0,
        default_purchase_unit: ingFormDefaultPurchaseUnit.trim(),
        default_pack_qty: Number(ingFormDefaultPackQty) || 1,
        default_pack_unit: ingFormDefaultPackUnit.trim(),
        default_capacity_qty: Number(ingFormDefaultCapacityQty) || 1,
        default_capacity_unit: ingFormDefaultCapacityUnit.trim(),
        saved_conversions: JSON.stringify(ingFormPresets),
      };

      if (editingIngredient) {
        const res = await fetchApi(`/purchases/ingredients/${editingIngredient.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.status === 'success') {
          showToast('success', 'Đã cập nhật nguyên liệu thành công');
          setIsIngredientModalOpen(false);
          loadData();
          if (onDataChanged) onDataChanged();
        } else {
          showToast('error', res.message || 'Lỗi khi cập nhật nguyên liệu');
        }
      } else {
        const res = await fetchApi('/purchases/ingredients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.status === 'success') {
          showToast('success', 'Đã thêm nguyên liệu mới thành công');
          setIsIngredientModalOpen(false);
          loadData();
          if (onDataChanged) onDataChanged();
        } else {
          showToast('error', res.message || 'Lỗi khi thêm nguyên liệu');
        }
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setSavingIngredient(false);
    }
  };

  const handleDeleteIngredient = async (ing: Ingredient) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nguyên liệu "${ing.name}"?`)) return;

    try {
      const res = await fetchApi(`/purchases/ingredients/${ing.id}`, {
        method: 'DELETE',
      });
      if (res.status === 'success') {
        showToast('success', 'Đã xóa nguyên liệu thành công');
        loadData();
        if (onDataChanged) onDataChanged();
      } else {
        showToast('error', res.message || 'Không thể xóa nguyên liệu');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    }
  };

  const handleOpenIngredientHistory = async (ing: Ingredient) => {
    setViewingHistoryIng(ing);
    setHistoryLoading(true);
    try {
      const res = await fetchApi<{ ingredient: Ingredient; history: IngredientHistoryRecord[] }>(
        `/purchases/ingredients/${ing.id}/history`
      );
      if (res.status === 'success' && res.data) {
        setIngHistoryRecords(res.data.history || []);
      }
    } catch {
      showToast('error', 'Lỗi khi tải lịch sử nhập hàng');
    } finally {
      setHistoryLoading(false);
    }
  };

  const recipePreviewCost = useMemo(() => {
    if (!editingRecipeTarget) return 0;
    let total = 0;
    recipeLines.forEach((line) => {
      const ing = ingredients.find((i) => i.id === line.ingredient_id);
      if (ing && line.usage_quantity > 0) {
        const price = pricingBasis === 'latest' ? ing.latest_purchase_price : ing.average_purchase_price;
        total += price * line.usage_quantity;
      }
    });
    return Math.round(total);
  }, [recipeLines, ingredients, editingRecipeTarget, pricingBasis]);

  const matchedTemplate = useMemo(() => {
    if (!editingRecipeTarget) return null;
    return findMatchingRecipeTemplate(editingRecipeTarget.product_name, editingRecipeTarget.category_name);
  }, [editingRecipeTarget]);

  const simulatedProfit = useMemo(() => {
    return (simulatedPrice || 0) - recipePreviewCost;
  }, [simulatedPrice, recipePreviewCost]);

  const simulatedMarginPct = useMemo(() => {
    if (!simulatedPrice || simulatedPrice <= 0) return 0;
    return (
      Math.round(((simulatedPrice - recipePreviewCost) / simulatedPrice) * 1000) / 10
    );
  }, [simulatedPrice, recipePreviewCost]);

  return (
    <div className="space-y-4 w-full">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-bold transition-all animate-in slide-in-from-top duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner with Summary KPIs */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Scale className="w-6 h-6 text-emerald-700 shrink-0" />
              <span>Quản Lý Mua Hàng & Lợi Nhuận Thu Hồi</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Theo dõi biến động giá nguyên liệu, định lượng BOM công thức và kiểm soát biên lợi nhuận thực tế
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
            {onOpenExpenseModal && (
              <button
                type="button"
                onClick={onOpenExpenseModal}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Ghi Nhận Mua Hàng</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <div className="col-span-2 sm:col-span-1 bg-emerald-50/80 rounded-2xl p-3 sm:p-3.5 border border-emerald-200/90 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase block">Biên Lãi Gộp TB Menu</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg sm:text-xl font-black text-emerald-950">{metrics.avgMargin}%</span>
                <span className="text-[10px] text-emerald-700 font-semibold">(lợi nhuận gộp)</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 sm:p-3.5 border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block">Đã Định Lượng BOM</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 block mt-0.5">
                {metrics.itemsWithRecipe}/{metrics.totalItems} <span className="text-xs font-semibold text-slate-500">món</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-3 sm:p-3.5 border border-slate-200 flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase block">Nguyên Liệu Theo Dõi</span>
              <span className="text-lg sm:text-xl font-black text-slate-900 block mt-0.5">
                {ingredients.length} <span className="text-xs font-semibold text-slate-500">mặt hàng</span>
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Package className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3 Streamlined Sub-Tabs */}
        <HorizontalScroller
          wrapperClassName="border-b border-slate-100 pt-1"
          className="gap-1 sm:gap-2"
          scrollAmount={200}
          arrowSize="sm"
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('profit-recovery')}
            className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeSubTab === 'profit-recovery'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Lợi Nhuận & Giá Vốn Món</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('purchase-history')}
            className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeSubTab === 'purchase-history'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Lịch Sử Mua Hàng & Giá Cả</span>
            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {allHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('ingredients')}
            className={`pb-2.5 sm:pb-3 px-2.5 sm:px-3 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 sm:gap-2 border-b-2 transition shrink-0 cursor-pointer ${
              activeSubTab === 'ingredients'
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Bảng Giá Nguyên Liệu</span>
            <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {ingredients.length}
            </span>
          </button>
        </HorizontalScroller>
      </div>

      {/* ── TAB 1: PROFIT MARGIN & MENU RECOVERY ───────────────────────────────── */}
      {activeSubTab === 'profit-recovery' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm món, đồ uống, topping..."
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
                    {filteredCostItems.length} món
                  </span>
                )}
              </div>

              {/* Category Filter on Mobile & Desktop */}
              <div className="w-full sm:w-48 shrink-0">
                <ModernSelect
                  value={selectedCategory}
                  onChange={(val) => setSelectedCategory(String(val))}
                  options={categoryOptions}
                />
              </div>
            </div>

            {/* Quick Status Filter Chips */}
            <HorizontalScroller
              className="gap-1.5 py-0.5"
              scrollAmount={180}
              arrowSize="sm"
            >
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition shrink-0 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Tất cả ({filterCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('needs_update')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'needs_update'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                    : 'bg-amber-50 text-amber-900 border-amber-200/80 hover:bg-amber-100'
                }`}
              >
                ⚠️ Cần cập nhật ({filterCounts.needsUpdate})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('high_margin')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'high_margin'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100'
                }`}
              >
                ✅ Biên lãi cao ≥65% ({filterCounts.highMargin})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('low_margin')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'low_margin'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 text-rose-900 border-rose-200/80 hover:bg-rose-100'
                }`}
              >
                🔥 Biên lãi thấp &lt;50% ({filterCounts.lowMargin})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('no_recipe')}
                className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'no_recipe'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-indigo-50 text-indigo-900 border-indigo-200/80 hover:bg-indigo-100'
                }`}
              >
                📋 Chưa có BOM ({filterCounts.noRecipe})
              </button>
            </HorizontalScroller>

            {/* Pricing Mode Switcher & Sync Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setPricingBasis('latest')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                    pricingBasis === 'latest'
                      ? 'bg-white text-emerald-900 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tính theo giá quy đổi đợt nhập gần nhất"
                >
                  ⚡ Giá đợt gần nhất
                </button>
                <button
                  type="button"
                  onClick={() => setPricingBasis('average')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer text-xs ${
                    pricingBasis === 'average'
                      ? 'bg-white text-emerald-900 shadow-xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Tính theo giá quy đổi bình quân các lần nhập"
                >
                  📊 Giá bình quân
                </button>
              </div>

              <button
                type="button"
                onClick={handleBulkApplyAll}
                disabled={bulkApplying}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-2xs transition active:scale-95 cursor-pointer ml-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bulkApplying ? 'animate-spin' : ''}`} />
                <span>Đồng bộ giá vốn Menu</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
          ) : filteredCostItems.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 font-semibold text-xs sm:text-sm">
              Không tìm thấy món hoặc topping nào phù hợp
            </div>
          ) : (
            <>
              {/* Desktop View: Table (hidden md:block) */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Món / Topping</th>
                        <th className="py-3 px-3">Danh Mục</th>
                        <th className="py-3 px-3 text-right">Giá Bán Lẻ</th>
                        <th className="py-3 px-3 text-right">Giá Vốn (COGS)</th>
                        <th className="py-3 px-3 text-right">Lãi Dự Tính</th>
                        <th className="py-3 px-3 text-center">Biên Lãi Gộp</th>
                        <th className="py-3 px-3 text-center">Định Lượng</th>
                        <th className="py-3 px-4 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCostItems.map((item) => {
                        const estCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
                        const isExpanded = expandedItemId === `${item.target_type}-${item.target_id}`;
                        const hasRecipe = item.recipe_item_count > 0;
                        const unitProfit = item.retail_price - estCost;
                        const marginPct =
                          item.retail_price > 0
                            ? Math.round(((item.retail_price - estCost) / item.retail_price) * 1000) / 10
                            : 0;

                        return (
                          <React.Fragment key={`${item.target_type}-${item.target_id}`}>
                            <tr className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  {item.image_url ? (
                                    <img
                                      src={getImageUrl(item.image_url) || ''}
                                      alt={item.product_name}
                                      className="w-9 h-9 rounded-xl object-cover border border-slate-100 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 font-black flex items-center justify-center text-xs border border-emerald-100 shrink-0">
                                      {item.product_name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                                      <span>{item.product_name}</span>
                                      {item.variant_name && item.variant_name !== 'Mặc định' && (
                                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-100">
                                          {item.variant_name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-600 font-medium">
                                {item.category_name}
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900">
                                {formatCurrency(item.retail_price, settings)}
                              </td>
                              <td className="py-3 px-3 text-right font-black text-slate-900">
                                {hasRecipe ? (
                                  <span className="text-slate-900">{formatCurrency(estCost, settings)}</span>
                                ) : (
                                  <span className="text-slate-400 font-normal italic">Chưa định lượng</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-black text-emerald-700">
                                {hasRecipe ? `+${formatCurrency(unitProfit, settings)}` : '—'}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {hasRecipe ? (
                                  <span className="inline-flex items-center font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200/80 px-2 py-0.5 rounded-lg text-xs">
                                    {marginPct}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {hasRecipe ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {item.recipe_item_count} NL
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    Chưa BOM
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  {hasRecipe && Math.abs(estCost - item.current_cogs) >= 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleApplySingleCost(item)}
                                      disabled={applyingCostId === `${item.target_type}-${item.target_id}`}
                                      className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition active:scale-95 cursor-pointer"
                                      title="Áp dụng giá vốn tính toán vào Menu bán hàng"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecipeEditor(item)}
                                    className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Scale className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>{hasRecipe ? 'Công thức' : '+ Định lượng'}</span>
                                  </button>
                                  {hasRecipe && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedItemId(
                                          isExpanded ? null : `${item.target_type}-${item.target_id}`
                                        )
                                      }
                                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                      title={isExpanded ? 'Thu gọn' : 'Xem chi tiết định lượng'}
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {isExpanded && item.recipe_details && item.recipe_details.length > 0 && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={8} className="p-3 px-4 border-t border-slate-100">
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                                      Chi tiết định lượng nguyên liệu cấu thành:
                                    </span>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                      {item.recipe_details.map((rd) => (
                                        <div
                                          key={rd.ingredient_id}
                                          className="bg-white p-2 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between shadow-2xs"
                                        >
                                          <div className="min-w-0 pr-2">
                                            <span className="font-bold text-slate-800 block truncate">{rd.ingredient_name}</span>
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                              {formatQuantityWithUnit(rd.usage_quantity, rd.base_unit || rd.unit)} ×{' '}
                                              {formatCurrency(rd.effective_unit_cost, settings)}/{rd.base_unit || rd.unit}
                                            </span>
                                          </div>
                                          <span className="font-black text-emerald-800 text-xs shrink-0">
                                            {formatCurrency(rd.line_cost, settings)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile View: Cards (md:hidden) */}
              <div className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                {filteredCostItems.map((item) => {
                  const estCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
                  const isExpanded = expandedItemId === `${item.target_type}-${item.target_id}`;
                  const hasRecipe = item.recipe_item_count > 0;
                  const unitProfit = item.retail_price - estCost;
                  const marginPct =
                    item.retail_price > 0
                      ? Math.round(((item.retail_price - estCost) / item.retail_price) * 1000) / 10
                      : 0;

                  return (
                    <div key={`${item.target_type}-${item.target_id}`} className="p-3 sm:p-4 hover:bg-slate-50/60 transition">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3">
                        {/* Product Header Info */}
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 w-full sm:w-auto">
                          {item.image_url ? (
                            <img
                              src={getImageUrl(item.image_url) || ''}
                              alt={item.product_name}
                              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl object-cover border border-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 text-emerald-700 font-black flex items-center justify-center text-xs sm:text-sm border border-emerald-100 shrink-0">
                              {item.product_name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                                {item.product_name}
                              </h3>
                              {item.variant_name && item.variant_name !== 'Mặc định' && (
                                <span className="text-[9px] sm:text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-100">
                                  {item.variant_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                              <span className="text-slate-400">{item.category_name}</span>
                              <span>•</span>
                              <span className="font-bold text-slate-800">
                                Giá bán: {formatCurrency(item.retail_price, settings)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Cost, Margin & Actions */}
                        <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <div className="flex items-center gap-1.5 justify-start sm:justify-end">
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Giá vốn:</span>
                              <span className="font-black text-slate-900 text-xs sm:text-sm">
                                {hasRecipe ? formatCurrency(estCost, settings) : 'Chưa định lượng'}
                              </span>
                            </div>
                            {hasRecipe && (
                              <div className="flex items-center gap-1.5 justify-start sm:justify-end text-[11px] mt-0.5">
                                <span className="font-bold text-emerald-700">
                                  Lãi: +{formatCurrency(unitProfit, settings)}
                                </span>
                                <span className="font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded text-[10px]">
                                  {marginPct}%
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasRecipe && Math.abs(estCost - item.current_cogs) >= 1 && (
                              <button
                                type="button"
                                onClick={() => handleApplySingleCost(item)}
                                disabled={applyingCostId === `${item.target_type}-${item.target_id}`}
                                className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                                title="Áp dụng giá vốn tính toán vào Menu bán hàng"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleOpenRecipeEditor(item)}
                              className="px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1"
                            >
                              <Scale className="w-3.5 h-3.5 text-emerald-700" />
                              <span>{hasRecipe ? 'Công thức' : '+ Định lượng'}</span>
                            </button>

                            {hasRecipe && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedItemId(
                                    isExpanded ? null : `${item.target_type}-${item.target_id}`
                                  )
                                }
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                                title={isExpanded ? 'Thu gọn' : 'Xem chi tiết định lượng'}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Recipe Details */}
                      {isExpanded && item.recipe_details && item.recipe_details.length > 0 && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/80 rounded-2xl p-2.5 sm:p-3 space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">
                            Chi tiết định lượng nguyên liệu cấu thành:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2">
                            {item.recipe_details.map((rd) => (
                              <div
                                key={rd.ingredient_id}
                                className="bg-white p-2 sm:p-2.5 rounded-xl border border-slate-200/70 text-xs flex items-center justify-between shadow-2xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <span className="font-bold text-slate-800 block truncate">{rd.ingredient_name}</span>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {formatQuantityWithUnit(rd.usage_quantity, rd.base_unit || rd.unit)} ×{' '}
                                    {formatCurrency(rd.effective_unit_cost, settings)}/{rd.base_unit || rd.unit}
                                  </span>
                                </div>
                                <span className="font-black text-emerald-800 text-xs shrink-0">
                                  {formatCurrency(rd.line_cost, settings)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: COMPLETE PURCHASE HISTORY & PRICES ─────────────────────────── */}
      {activeSubTab === 'purchase-history' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm nguyên liệu, quy cách, quỹ chi trả..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="app-input pl-9 pr-24 py-2 text-xs placeholder:text-xs"
              />
              {historySearch ? (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md pointer-events-none">
                  {filteredHistory.length} đợt
                </span>
              )}
            </div>

            <div className="text-xs font-bold text-slate-700 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl border sm:border-0 border-slate-100 flex items-center justify-between sm:justify-end gap-1.5 shrink-0">
              <span className="text-slate-500 font-medium">Tổng tiền đã nhập:</span>
              <span className="text-rose-600 font-black text-sm">{formatCurrency(totalSpend, settings)}</span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 font-semibold text-xs sm:text-sm">
              Chưa có lịch sử mua hàng nào được ghi nhận
            </div>
          ) : (
            <>
              {/* Mobile Card View (md:hidden) */}
              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {filteredHistory.map((rec) => {
                  const baseUnit = rec.base_unit || 'ml';
                  const pUnit = rec.purchase_unit || baseUnit;
                  const pQty = rec.purchase_quantity || rec.quantity;
                  const pPrice = rec.purchase_unit_price || rec.unit_price;
                  const spec = rec.conversion_spec || `${pQty} ${pUnit}`;
                  const effectivePrice = rec.effective_base_price || rec.base_unit_price || rec.unit_price;

                  return (
                    <div
                      key={rec.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs space-y-2"
                    >
                      {/* Header: Name + Date */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-slate-900 text-sm truncate">{rec.ingredient_name}</h4>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            📅 {new Date(rec.created_at).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {rec.fund_name && (
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                            {rec.fund_name}
                          </span>
                        )}
                      </div>

                      {/* Specs */}
                      <div className="text-xs text-slate-600 font-semibold bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100 flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Quy cách:</span>
                        <span className="text-slate-800 font-bold truncate max-w-[200px]">{spec}</span>
                      </div>

                      {/* Quantity & Unit price */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block">Số lượng & Đơn giá</span>
                          <span className="font-black text-slate-900">
                            {pQty} {pUnit} × {formatCurrency(pPrice, settings)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-semibold block">Thành tiền</span>
                          <span className="font-black text-rose-600 text-sm">
                            {formatCurrency(rec.subtotal, settings)}
                          </span>
                        </div>
                      </div>

                      {/* Cost breakdown */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-[11px] font-bold text-slate-500">Giá vốn quy đổi:</span>
                        <span className="font-extrabold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg text-xs">
                          {formatCurrency(effectivePrice, settings)}/{baseUnit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Table (hidden md:block) */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Ngày Nhập</th>
                        <th className="py-3 px-3">Tên Nguyên Liệu</th>
                        <th className="py-3 px-3 text-right">Số Lượng Mua</th>
                        <th className="py-3 px-3">Quy Cách Chi Tiết</th>
                        <th className="py-3 px-3 text-right">Giá Mua</th>
                        <th className="py-3 px-3 text-right">Tổng Tiền</th>
                        <th className="py-3 px-3 text-right">Giá Quy Đổi Cơ Sở</th>
                        <th className="py-3 px-4">Tài Khoản Quỹ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((rec) => {
                        const baseUnit = rec.base_unit || 'ml';
                        const pUnit = rec.purchase_unit || baseUnit;
                        const pQty = rec.purchase_quantity || rec.quantity;
                        const pPrice = rec.purchase_unit_price || rec.unit_price;
                        const spec = rec.conversion_spec || `${pQty} ${pUnit}`;
                        const effectivePrice = rec.effective_base_price || rec.base_unit_price || rec.unit_price;

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-semibold text-slate-500 whitespace-nowrap">
                              {new Date(rec.created_at).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 px-3 font-extrabold text-slate-900">{rec.ingredient_name}</td>
                            <td className="py-3 px-3 text-right font-black text-slate-800">
                              {pQty} {pUnit}
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-medium">{spec}</td>
                            <td className="py-3 px-3 text-right font-bold text-slate-800">
                              {formatCurrency(pPrice, settings)}/{pUnit}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-rose-600">
                              {formatCurrency(rec.subtotal, settings)}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-emerald-800">
                              <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {formatCurrency(effectivePrice, settings)}/{baseUnit}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600">{rec.fund_name || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 3: INGREDIENTS PRICING & SPECIFICATIONS ───────────────────────── */}
      {activeSubTab === 'ingredients' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Toolbar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nguyên liệu, bao bì..."
                  value={ingSearchQuery}
                  onChange={(e) => setIngSearchQuery(e.target.value)}
                  className="app-input pl-9 pr-24 py-2 text-xs placeholder:text-xs"
                />
                {ingSearchQuery ? (
                  <button
                    type="button"
                    onClick={() => setIngSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md pointer-events-none">
                    {filteredIngredients.length} NL
                  </span>
                )}
              </div>

              <select
                value={ingCategoryFilter}
                onChange={(e) => setIngCategoryFilter(e.target.value)}
                className="app-select w-auto h-9 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
              >
                <option value="all">Tất cả phân loại</option>
                <option value="fruit">Hoa quả tươi</option>
                <option value="ingredient">Nguyên liệu / Sữa</option>
                <option value="packaging">Bao bì / Ly nắp</option>
                <option value="other">Khác</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleOpenAddIngredient}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm Nguyên Liệu</span>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 shadow-sm text-slate-400 font-semibold text-xs sm:text-sm">
              Không tìm thấy nguyên liệu nào phù hợp
            </div>
          ) : (
            <>
              {/* Mobile View: Cards Grid (md:hidden) */}
              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {filteredIngredients.map((ing) => {
                  const baseUnit = ing.base_unit || ing.unit || 'ml';
                  const defaultSpec = ing.default_purchase_unit
                    ? `${ing.default_purchase_unit} (${ing.default_pack_qty && ing.default_pack_qty > 1 ? `${ing.default_pack_qty}x ` : ''}${ing.default_capacity_qty || 1000}${ing.default_capacity_unit || baseUnit})`
                    : `1 ${baseUnit}`;

                  return (
                    <div
                      key={ing.id}
                      className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-3.5 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-slate-900 text-sm truncate">{ing.name}</h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                            <span className="font-bold text-emerald-900 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                              Base: {baseUnit}
                            </span>
                            <span>•</span>
                            <span className="text-slate-600">Hao hụt: {Math.round(ing.loss_rate * 100)}%</span>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                            ing.category === 'fruit'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : ing.category === 'packaging'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {ing.category === 'fruit'
                            ? 'Hoa quả'
                            : ing.category === 'packaging'
                            ? 'Bao bì'
                            : 'Nguyên liệu'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block">Giá gần nhất</span>
                          <span className="font-extrabold text-emerald-700 text-sm">
                            {formatCurrency(ing.latest_purchase_price, settings)}/{baseUnit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-slate-400 block">Quy cách mặc định</span>
                          <span className="font-bold text-slate-700">{defaultSpec}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenIngredientHistory(ing)}
                          className="px-2.5 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Lịch sử</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditIngredient(ing)}
                          className="px-2.5 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIngredient(ing)}
                          className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                          title="Xóa nguyên liệu"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View: Table (hidden md:block) */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="py-3 px-4">Tên Nguyên Liệu</th>
                        <th className="py-3 px-3">Phân Loại</th>
                        <th className="py-3 px-3">Đơn Vị Cơ Sở (Base Unit)</th>
                        <th className="py-3 px-3">Quy Cách Mặc Định</th>
                        <th className="py-3 px-3 text-right">Hao Hụt (%)</th>
                        <th className="py-3 px-3 text-right">Giá Quy Đổi Gần Nhất</th>
                        <th className="py-3 px-3 text-right">Giá Quy Đổi BQ</th>
                        <th className="py-3 px-4 text-center">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredIngredients.map((ing) => {
                        const baseUnit = ing.base_unit || ing.unit || 'ml';
                        const defaultSpec = ing.default_purchase_unit
                          ? `${ing.default_purchase_unit} (${ing.default_pack_qty && ing.default_pack_qty > 1 ? `${ing.default_pack_qty}x ` : ''}${ing.default_capacity_qty || 1000}${ing.default_capacity_unit || baseUnit})`
                          : `1 ${baseUnit}`;

                        return (
                          <tr key={ing.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 font-extrabold text-slate-900">{ing.name}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  ing.category === 'fruit'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : ing.category === 'packaging'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {ing.category === 'fruit'
                                  ? 'Hoa quả'
                                  : ing.category === 'packaging'
                                  ? 'Bao bì'
                                  : 'Nguyên liệu'}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-emerald-900">
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                                {baseUnit}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 font-medium">{defaultSpec}</td>
                            <td className="py-3 px-3 text-right font-bold text-amber-700">
                              {ing.loss_rate > 0 ? `${Math.round(ing.loss_rate * 100)}%` : '0%'}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                              {formatCurrency(ing.latest_purchase_price, settings)}/{baseUnit}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-600">
                              {formatCurrency(ing.average_purchase_price, settings)}/{baseUnit}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenIngredientHistory(ing)}
                                  className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition active:scale-95 cursor-pointer"
                                  title="Xem lịch sử giá nhập hàng"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditIngredient(ing)}
                                  className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition active:scale-95 cursor-pointer"
                                  title="Chỉnh sửa nguyên liệu"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteIngredient(ing)}
                                  className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition active:scale-95 cursor-pointer"
                                  title="Xóa nguyên liệu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MODAL 1: RECIPE BOM EDITOR ─────────────────────────────────────────── */}
      {editingRecipeTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-700" />
                  Định Lượng Công Thức (BOM)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingRecipeTarget.product_name} ({editingRecipeTarget.variant_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecipeTarget(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1-Click Recipe Template Preset Bar */}
            <div className="bg-slate-50 rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Thư Viện Công Thức Món Mẫu F&B</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">1-Click nạp định lượng chuẩn</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {matchedTemplate && (
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTemplate(matchedTemplate)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-black border border-amber-300 shadow-2xs transition active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-700" />
                    <span>✨ Gợi ý chuẩn: {matchedTemplate.name}</span>
                  </button>
                )}

                <select
                  onChange={(e) => {
                    const selected = POPULAR_RECIPE_TEMPLATES.find((t) => t.id === e.target.value);
                    if (selected) handleApplyPresetTemplate(selected);
                    e.target.value = '';
                  }}
                  defaultValue=""
                  className="h-7 px-2 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 bg-white hover:bg-slate-50 transition cursor-pointer"
                >
                  <option value="" disabled>
                    + Chọn từ 11+ mẫu công thức khác...
                  </option>
                  {POPULAR_RECIPE_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      [{tmpl.category}] {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Interactive Live Cost & Profit Simulator Widget */}
            <div className="bg-gradient-to-br from-emerald-50/90 to-slate-50 rounded-2xl p-3.5 border border-emerald-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-200/50 pb-2">
                <span className="text-[11px] font-black text-emerald-950 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Mô Phỏng Giá Bán & Biên Lợi Nhuận Thực Tế</span>
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border shadow-2xs ${
                    simulatedMarginPct >= 65
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : simulatedMarginPct >= 50
                      ? 'bg-amber-500 text-white border-amber-600'
                      : 'bg-rose-600 text-white border-rose-700'
                  }`}
                >
                  {simulatedMarginPct >= 65
                    ? '🟢 Lãi cao (Lý tưởng)'
                    : simulatedMarginPct >= 50
                    ? '🟡 Lãi vừa (Tiêu chuẩn)'
                    : '🔴 Lãi thấp (Cần tăng giá)'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100/80">
                  <span className="text-[10px] font-bold text-slate-500 block">Tiền vốn 1 ly (COGS)</span>
                  <span className="text-base sm:text-lg font-black text-emerald-950 block mt-0.5">
                    {formatCurrency(recipePreviewCost, settings)}
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100/80">
                  <span className="text-[10px] font-bold text-slate-500 block">Giá bán mô phỏng</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="number"
                      step="1000"
                      min="0"
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(parseFloat(e.target.value) || 0)}
                      className="w-full h-7 px-1.5 border border-slate-200 rounded-lg text-xs font-black text-slate-900 bg-white"
                    />
                  </div>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-emerald-100/80 text-right">
                  <span className="text-[10px] font-bold text-slate-500 block">Tiền lời / Tỷ suất</span>
                  <div className="flex items-baseline justify-end gap-1 mt-0.5">
                    <span className="text-sm sm:text-base font-black text-emerald-900">
                      {formatCurrency(simulatedProfit, settings)}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-700">
                      ({simulatedMarginPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipe Lines */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Định lượng nguyên liệu cho 1 ly</span>
                <span className="text-[10px] text-slate-400 font-semibold">Tự tính theo giá nhập gần nhất</span>
              </label>

              {recipeLines.map((line, idx) => {
                const selectedIng = ingredients.find((i) => i.id === line.ingredient_id);
                const baseUnit = selectedIng?.base_unit || selectedIng?.unit || 'ml';
                const unitPrice = selectedIng?.latest_purchase_price || 0;
                const lineCost = Math.round(line.usage_quantity * unitPrice);

                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-2 text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <select
                        value={line.ingredient_id}
                        onChange={(e) => {
                          const newIngId = Number(e.target.value);
                          setRecipeLines((prev) => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], ingredient_id: newIngId };
                            return updated;
                          });
                        }}
                        className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-bold bg-white"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({formatCurrency(ing.latest_purchase_price, settings)}/{ing.base_unit || ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-28 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={line.usage_quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setRecipeLines((prev) => {
                              const updated = [...prev];
                              updated[idx] = { ...updated[idx], usage_quantity: val };
                              return updated;
                            });
                          }}
                          className="w-full h-9 pr-8 pl-2 border border-slate-200 rounded-xl text-xs font-black text-right bg-white"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                          {baseUnit}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-black text-emerald-800 w-16 text-right shrink-0">
                      {formatCurrency(lineCost)}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setRecipeLines((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                      title="Xóa nguyên liệu này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setRecipeLines((prev) => [
                    ...prev,
                    { ingredient_id: ingredients[0]?.id || 0, usage_quantity: 30 },
                  ]);
                }}
                className="w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Thêm nguyên liệu vào công thức</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setEditingRecipeTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                disabled={savingRecipe}
                className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${savingRecipe ? 'animate-spin' : ''}`} />
                <span>Lưu Công Thức</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: INGREDIENT ADD / EDIT ────────────────────────────────────── */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-700" />
                <span>{editingIngredient ? 'Chỉnh Sửa Thông Tin Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsIngredientModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3.5 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tên Nguyên Liệu / Vật Tư *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Cốt cà phê, Sữa đặc, Sữa tươi, Ly 500ml..."
                  value={ingFormName}
                  onChange={(e) => setIngFormName(e.target.value)}
                  className="w-full h-9.5 px-3 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Phân Loại</label>
                  <select
                    value={ingFormCategory}
                    onChange={(e) => setIngFormCategory(e.target.value)}
                    className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white"
                  >
                    <option value="fruit">Hoa quả tươi</option>
                    <option value="ingredient">Nguyên liệu / Sữa</option>
                    <option value="packaging">Bao bì / Ly nắp</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Đơn Vị Cơ Sở (Base Unit) *
                  </label>
                  <select
                    value={ingFormBaseUnit}
                    onChange={(e) => setIngFormBaseUnit(e.target.value)}
                    className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-emerald-950"
                  >
                    {COMMON_BASE_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Giá quy đổi cơ sở (đ/{ingFormBaseUnit})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="VD: 120"
                    value={ingFormPrice === 0 ? '' : ingFormPrice}
                    onChange={(e) => setIngFormPrice(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tỷ Lệ Hao Hụt (%)
                  </label>
                  <div className="relative w-full">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="99"
                      value={Math.round(ingFormLossRate * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setIngFormLossRate(val / 100);
                      }}
                      className="w-full h-9 pr-6 pl-2 border border-slate-200 rounded-xl text-xs font-black text-center"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Quy Cách Mua Hàng Mặc Định:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Đơn vị mua</span>
                    <select
                      value={ingFormDefaultPurchaseUnit}
                      onChange={(e) => setIngFormDefaultPurchaseUnit(e.target.value)}
                      className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                    >
                      {COMMON_PURCHASE_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Chứa (số lượng)</span>
                    <input
                      type="number"
                      value={ingFormDefaultCapacityQty}
                      onChange={(e) => setIngFormDefaultCapacityQty(parseFloat(e.target.value) || 1)}
                      className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-black text-center bg-white"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Đơn vị con</span>
                    <select
                      value={ingFormDefaultCapacityUnit}
                      onChange={(e) => setIngFormDefaultCapacityUnit(e.target.value)}
                      className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white"
                    >
                      <option value="ml">ml</option>
                      <option value="l">Lít</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="cái">cái</option>
                      <option value="quả">quả</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-950">
                    Các quy cách mua hàng lưu sẵn (Presets):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIngFormPresets((prev) => [
                        ...prev,
                        {
                          label: `${ingFormDefaultPurchaseUnit} (${ingFormDefaultCapacityQty}${ingFormDefaultCapacityUnit})`,
                          purchase_unit: ingFormDefaultPurchaseUnit,
                          pack_qty: 1,
                          pack_unit: '',
                          capacity_qty: ingFormDefaultCapacityQty,
                          capacity_unit: ingFormDefaultCapacityUnit,
                        },
                      ]);
                    }}
                    className="text-[10px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 transition cursor-pointer"
                  >
                    + Thêm quy cách
                  </button>
                </div>

                {ingFormPresets.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Chưa có quy cách lưu sẵn. Hệ thống sẽ tự động lưu khi nhập hàng.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {ingFormPresets.map((pr, pIdx) => (
                      <div
                        key={pIdx}
                        className="bg-white p-2 rounded-xl border border-emerald-200 text-xs flex items-center justify-between gap-2"
                      >
                        <span className="font-bold text-emerald-900">
                          {pr.purchase_unit} ({pr.pack_qty > 1 ? `${pr.pack_qty}x ` : ''}{pr.capacity_qty}{pr.capacity_unit})
                        </span>
                        <button
                          type="button"
                          onClick={() => setIngFormPresets((prev) => prev.filter((_, idx) => idx !== pIdx))}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 pb-safe">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingIngredient}
                  className="px-5 py-2.5 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${savingIngredient ? 'animate-spin' : ''}`} />
                  <span>{editingIngredient ? 'Lưu Thay Đổi' : 'Thêm Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: INGREDIENT PURCHASE PRICE HISTORY ───────────────────────── */}
      {viewingHistoryIng && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Lịch Sử Giá Nhập Hàng & Quy Đổi
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nguyên liệu: <strong>{viewingHistoryIng.name}</strong> • Base Unit:{' '}
                  <strong>{viewingHistoryIng.base_unit || viewingHistoryIng.unit}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingHistoryIng(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : ingHistoryRecords.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                Chưa có đợt nhập hàng nào được ghi nhận cho nguyên liệu này
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto max-h-[55vh] custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Ngày Nhập</th>
                        <th className="py-2.5 px-3 text-right">Giá Mua</th>
                        <th className="py-2.5 px-3">Quy Cách</th>
                        <th className="py-2.5 px-3 text-right">Tổng Tiền</th>
                        <th className="py-2.5 px-3 text-right">Cost Quy Đổi</th>
                        <th className="py-2.5 px-3">Quỹ Chi Trả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ingHistoryRecords.map((rec) => {
                        const baseUnit = viewingHistoryIng.base_unit || viewingHistoryIng.unit || 'ml';
                        const pUnit = rec.purchase_unit || baseUnit;
                        const pQty = rec.purchase_quantity || rec.quantity;
                        const pPrice = rec.purchase_unit_price || rec.unit_price;
                        const spec = rec.conversion_spec || `${pQty} ${pUnit}`;
                        const effectivePrice = rec.effective_base_price || rec.base_unit_price || rec.unit_price;

                        return (
                          <tr key={rec.id} className="hover:bg-slate-50 transition">
                            <td className="py-2.5 px-3 font-semibold text-slate-500 whitespace-nowrap">
                              {new Date(rec.created_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(pPrice, settings)}/{pUnit}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">{spec}</td>
                            <td className="py-2.5 px-3 text-right font-black text-rose-600">
                              {formatCurrency(rec.subtotal, settings)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-emerald-800">
                              <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                                {formatCurrency(effectivePrice, settings)}/{baseUnit}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">{rec.fund_name || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end pb-safe">
              <button
                type="button"
                onClick={() => setViewingHistoryIng(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
