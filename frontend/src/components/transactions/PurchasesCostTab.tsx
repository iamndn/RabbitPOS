'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Layers,
  Scale,
  ChevronDown,
  ChevronUp,
  History,
  X,
  PlusCircle,
  DollarSign,
  Percent,
} from 'lucide-react';
import ModernSelect, { ModernSelectOption } from '@/components/common/ModernSelect';
import { fetchApi, getImageUrl } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import {
  Ingredient,
  CostComparisonItem,
  RecipeDetailItem,
  IngredientHistoryRecord,
} from '@/types/purchase';
import { TransactionCategory } from '@/types/transaction_category';

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
}

export default function PurchasesCostTab({
  onOpenExpenseModal,
  settings: propSettings,
  funds = [],
  txCategories = [],
  onDataChanged,
}: PurchasesCostTabProps) {
  const { t } = useTranslation();

  // Active Sub-Tab: 'cost-estimator' | 'ingredients'
  const [activeSubTab, setActiveSubTab] = useState<'cost-estimator' | 'ingredients'>('cost-estimator');

  // Pricing Mode in Cost Estimator: 'latest' | 'average'
  const [pricingBasis, setPricingBasis] = useState<'latest' | 'average'>('latest');

  // Main Data States
  const [costItems, setCostItems] = useState<CostComparisonItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [settings, setSettings] = useState<SettingsMap | null>(propSettings || null);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [ingSearchQuery, setIngSearchQuery] = useState<string>('');
  const [ingCategoryFilter, setIngCategoryFilter] = useState<string>('all');

  // Expanded Recipe Details Card/Row
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Recipe Editor Modal State
  const [editingRecipeTarget, setEditingRecipeTarget] = useState<CostComparisonItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<{ ingredient_id: number; usage_quantity: number }[]>([]);
  const [savingRecipe, setSavingRecipe] = useState<boolean>(false);

  // Ingredient Create / Edit Modal State
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingFormName, setIngFormName] = useState<string>('');
  const [ingFormCategory, setIngFormCategory] = useState<string>('fruit');
  const [ingFormUnit, setIngFormUnit] = useState<string>('kg');
  const [ingFormYieldRate, setIngFormYieldRate] = useState<number>(1.0);
  const [savingIngredient, setSavingIngredient] = useState<boolean>(false);

  // Ingredient History Modal State
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
      const [costRes, ingRes, setRes] = await Promise.all([
        fetchApi<CostComparisonItem[]>('/purchases/cost-comparison'),
        fetchApi<Ingredient[]>('/purchases/ingredients'),
        propSettings ? Promise.resolve({ status: 'success', data: propSettings }) : fetchApi<SettingsMap>('/settings'),
      ]);

      if (costRes.status === 'success' && Array.isArray(costRes.data)) {
        setCostItems(costRes.data);
      }
      if (ingRes.status === 'success' && Array.isArray(ingRes.data)) {
        setIngredients(ingRes.data);
      }
      if (setRes.status === 'success' && setRes.data) {
        setSettings(setRes.data as SettingsMap);
      }
    } catch {
      showToast('error', 'Lỗi khi tải dữ liệu giá vốn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update local settings if prop updates
  useEffect(() => {
    if (propSettings) setSettings(propSettings);
  }, [propSettings]);

  // Categories list for filtering
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
      return matchesSearch && matchesCat;
    });
  }, [costItems, searchQuery, selectedCategory]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch = ing.name.toLowerCase().includes(ingSearchQuery.toLowerCase());
      const matchesCat =
        ingCategoryFilter === 'all' || ing.category === ingCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [ingredients, ingSearchQuery, ingCategoryFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const totalItems = costItems.length;
    const itemsWithRecipe = costItems.filter((i) => i.recipe_item_count > 0).length;
    const fruitCount = ingredients.filter((i) => i.category === 'fruit').length;
    const supplyCount = ingredients.filter((i) => i.category !== 'fruit').length;

    let totalDiff = 0;
    let totalMargin = 0;
    let marginCount = 0;

    costItems.forEach((i) => {
      if (i.recipe_item_count > 0) {
        const estCost = pricingBasis === 'latest' ? i.estimated_cogs : i.estimated_cogs_avg;
        totalDiff += estCost - i.current_cogs;
        if (i.retail_price > 0) {
          totalMargin += ((i.retail_price - estCost) / i.retail_price) * 100;
          marginCount++;
        }
      }
    });

    const avgDiff = itemsWithRecipe > 0 ? totalDiff / itemsWithRecipe : 0;
    const avgMargin = marginCount > 0 ? totalMargin / marginCount : 0;

    return {
      totalItems,
      itemsWithRecipe,
      fruitCount,
      supplyCount,
      avgDiff,
      avgMargin,
    };
  }, [costItems, ingredients, pricingBasis]);

  // 1-Click Apply Single Cost to Menu
  const handleApplySingleCost = async (item: CostComparisonItem) => {
    const key = `${item.target_type}-${item.target_id}`;
    const newCost = pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;

    if (newCost <= 0) {
      showToast('error', 'Chưa có định lượng công thức hoặc giá nguyên liệu bằng 0');
      return;
    }

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
          `Đã cập nhật giá vốn "${item.product_name} (${item.variant_name})" thành ${formatCurrency(
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

  // Bulk Apply All Costs
  const handleBulkApplyCosts = async () => {
    const itemsToApply = costItems
      .filter((i) => {
        const estCost = pricingBasis === 'latest' ? i.estimated_cogs : i.estimated_cogs_avg;
        return i.recipe_item_count > 0 && estCost > 0 && Math.abs(estCost - i.current_cogs) > 10;
      })
      .map((i) => ({
        target_type: i.target_type,
        target_id: i.target_id,
        new_cost: pricingBasis === 'latest' ? i.estimated_cogs : i.estimated_cogs_avg,
      }));

    if (itemsToApply.length === 0) {
      showToast('success', 'Tất cả món ăn đã khớp với giá vốn tính toán từ công thức!');
      return;
    }

    if (
      !window.confirm(
        `Bạn có chắc muốn cập nhật giá vốn Menu cho ${itemsToApply.length} món ăn/topping theo giá nhập hiện tại không?`
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

  // Recipe Editor Handlers
  const handleOpenRecipeEditor = async (item: CostComparisonItem) => {
    setEditingRecipeTarget(item);
    try {
      const res = await fetchApi<any[]>(`/purchases/recipes/${item.target_type}/${item.target_id}`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        if (res.data.length > 0) {
          setRecipeLines(
            res.data.map((r) => ({
              ingredient_id: r.ingredient_id,
              usage_quantity: r.usage_quantity,
            }))
          );
        } else {
          setRecipeLines([{ ingredient_id: ingredients[0]?.id || 0, usage_quantity: 0.1 }]);
        }
      } else {
        setRecipeLines([{ ingredient_id: ingredients[0]?.id || 0, usage_quantity: 0.1 }]);
      }
    } catch {
      setRecipeLines([{ ingredient_id: ingredients[0]?.id || 0, usage_quantity: 0.1 }]);
    }
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

  // Ingredient Handlers
  const handleOpenAddIngredient = () => {
    setEditingIngredient(null);
    setIngFormName('');
    setIngFormCategory('fruit');
    setIngFormUnit('kg');
    setIngFormYieldRate(1.0);
    setIsIngredientModalOpen(true);
  };

  const handleOpenEditIngredient = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setIngFormName(ing.name);
    setIngFormCategory(ing.category || 'fruit');
    setIngFormUnit(ing.unit || 'kg');
    setIngFormYieldRate(ing.yield_rate || 1.0);
    setIsIngredientModalOpen(true);
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingFormName.trim()) return;

    setSavingIngredient(true);
    try {
      if (editingIngredient) {
        const res = await fetchApi(`/purchases/ingredients/${editingIngredient.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: ingFormName.trim(),
            category: ingFormCategory,
            unit: ingFormUnit.trim(),
            yield_rate: Number(ingFormYieldRate),
          }),
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
          body: JSON.stringify({
            name: ingFormName.trim(),
            category: ingFormCategory,
            unit: ingFormUnit.trim(),
            yield_rate: Number(ingFormYieldRate),
          }),
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

  // Recipe Editor Live Calculation
  const recipePreviewCost = useMemo(() => {
    if (!editingRecipeTarget) return 0;
    let total = 0;
    recipeLines.forEach((line) => {
      const ing = ingredients.find((i) => i.id === line.ingredient_id);
      if (ing && line.usage_quantity > 0) {
        const yieldRate = ing.yield_rate > 0 ? ing.yield_rate : 1.0;
        const effectivePrice = (pricingBasis === 'latest' ? ing.latest_purchase_price : ing.average_purchase_price) / yieldRate;
        total += effectivePrice * line.usage_quantity;
      }
    });
    return Math.round(total);
  }, [recipeLines, ingredients, editingRecipeTarget, pricingBasis]);

  const recipeMarginPct = useMemo(() => {
    if (!editingRecipeTarget || editingRecipeTarget.retail_price <= 0) return 0;
    return Math.round(((editingRecipeTarget.retail_price - recipePreviewCost) / editingRecipeTarget.retail_price) * 1000) / 10;
  }, [editingRecipeTarget, recipePreviewCost]);

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

      {/* Top KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="app-label text-[10px] sm:text-[11px] mb-0.5">Nguyên liệu theo dõi</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-2xl font-black text-slate-900">{ingredients.length}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
              {metrics.fruitCount} quả • {metrics.supplyCount} vật tư
            </span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="app-label text-[10px] sm:text-[11px] mb-0.5">Đã định lượng (BOM)</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-2xl font-black text-slate-900">
              {metrics.itemsWithRecipe} <span className="text-xs text-slate-400 font-semibold">/ {metrics.totalItems}</span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
              {metrics.totalItems > 0 ? Math.round((metrics.itemsWithRecipe / metrics.totalItems) * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="app-label text-[10px] sm:text-[11px] mb-0.5">Biên Lãi Gộp Dự Tính</span>
          <div className="flex items-baseline justify-between">
            <span className="text-lg sm:text-2xl font-black text-emerald-700">
              {Math.round(metrics.avgMargin * 10) / 10}%
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-lg">
              Theo giá nhập
            </span>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <span className="app-label text-[10px] sm:text-[11px] mb-0.5">Chênh lệch giá vốn</span>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-lg sm:text-2xl font-black ${
                metrics.avgDiff > 0
                  ? 'text-rose-600'
                  : metrics.avgDiff < 0
                  ? 'text-emerald-600'
                  : 'text-slate-800'
              }`}
            >
              {metrics.avgDiff > 0 ? '+' : ''}
              {formatCurrency(metrics.avgDiff, settings)}
            </span>
            <button
              type="button"
              onClick={handleBulkApplyCosts}
              disabled={bulkApplying}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline active:scale-95 transition cursor-pointer"
            >
              {bulkApplying ? 'Đang đồng bộ...' : 'Đồng bộ'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Sub-tab Toolbar & Search/Filter Controls */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Sub-view switcher tabs */}
          <div className="flex bg-slate-100/90 p-1 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('cost-estimator')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === 'cost-estimator'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Giá Vốn & Định Lượng (BOM)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('ingredients')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeSubTab === 'ingredients'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Bảng Giá Nguyên Liệu</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {activeSubTab === 'ingredients' ? (
              <button
                type="button"
                onClick={handleOpenAddIngredient}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thêm Nguyên Liệu</span>
              </button>
            ) : (
              <>
                {/* Pricing Basis Toggle */}
                <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setPricingBasis('latest')}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      pricingBasis === 'latest'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Giá mới nhất
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingBasis('average')}
                    className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      pricingBasis === 'average'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    Giá TB
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleBulkApplyCosts}
                  disabled={bulkApplying}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${bulkApplying ? 'animate-spin' : ''}`} />
                  <span>Áp Dụng Tất Cả Giá Vốn</span>
                </button>
              </>
            )}

            {onOpenExpenseModal && (
              <button
                type="button"
                onClick={onOpenExpenseModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>+ Ghi Nhận Mua Hàng</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t border-slate-100">
          {activeSubTab === 'cost-estimator' ? (
            <>
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm món, trà, size, topping..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="app-input pl-9"
                />
              </div>
              <div className="w-full sm:w-60 shrink-0">
                <ModernSelect
                  options={categoryOptions}
                  value={selectedCategory}
                  onChange={(v) => setSelectedCategory(v || 'all')}
                  placeholder="Chọn phân loại..."
                />
              </div>
            </>
          ) : (
            <>
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm nguyên liệu, hoa quả, bao bì..."
                  value={ingSearchQuery}
                  onChange={(e) => setIngSearchQuery(e.target.value)}
                  className="app-input pl-9"
                />
              </div>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setIngCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    ingCategoryFilter === 'all'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({ingredients.length})
                </button>
                <button
                  type="button"
                  onClick={() => setIngCategoryFilter('fruit')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    ingCategoryFilter === 'fruit'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Hoa quả tươi
                </button>
                <button
                  type="button"
                  onClick={() => setIngCategoryFilter('ingredient')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    ingCategoryFilter === 'ingredient'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Nguyên liệu & Sữa
                </button>
                <button
                  type="button"
                  onClick={() => setIngCategoryFilter('packaging')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    ingCategoryFilter === 'packaging'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Bao bì & Ly
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── VIEW 1: RECIPE COST ESTIMATOR & MENU SYNC ────────────────────────── */}
      {activeSubTab === 'cost-estimator' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
          ) : filteredCostItems.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-semibold text-sm">
              Không tìm thấy sản phẩm nào phù hợp
            </div>
          ) : (
            <>
              {/* MOBILE VIEW (< 768px): Thumb-Friendly Card Grid */}
              <div className="grid grid-cols-1 gap-3 md:hidden">
                {filteredCostItems.map((item) => {
                  const itemKey = `${item.target_type}-${item.target_id}`;
                  const isExpanded = expandedItemId === itemKey;
                  const calculatedCost =
                    pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
                  const diff = calculatedCost - item.current_cogs;
                  const hasRecipe = item.recipe_item_count > 0;

                  return (
                    <div
                      key={itemKey}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3"
                    >
                      {/* Card Header: Product Thumb, Name & Retail Price */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {item.image_url && getImageUrl(item.image_url) ? (
                            <img
                              src={getImageUrl(item.image_url)!}
                              alt={item.product_name}
                              className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-extrabold text-xs shrink-0">
                              {item.target_type === 'topping' ? 'TP' : 'MÓN'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">
                              {item.product_name}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                {item.variant_name}
                              </span>
                              <span>•</span>
                              <span className="truncate">{item.category_name || 'Topping'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Retail Price Tag */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase block">Giá bán</span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            {formatCurrency(item.retail_price, settings)}
                          </span>
                        </div>
                      </div>

                      {/* Cost Comparison Metric Box */}
                      <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                        {/* Current Menu COGS */}
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block">Vốn Menu</span>
                          <span className="font-bold text-slate-700 text-xs">
                            {formatCurrency(item.current_cogs, settings)}
                          </span>
                        </div>

                        {/* Calculated COGS from Recipe */}
                        <div>
                          <span className="text-[10px] font-semibold text-slate-500 block">Vốn mới ({pricingBasis === 'latest' ? 'gần nhất' : 'TB'})</span>
                          {hasRecipe ? (
                            <span className="font-black text-emerald-800 text-sm">
                              {formatCurrency(calculatedCost, settings)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Chưa có định lượng
                            </span>
                          )}
                        </div>

                        {/* Delta Badge & Profit Margin */}
                        <div className="text-right">
                          {hasRecipe ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span
                                className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                  diff > 0
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : diff < 0
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {diff > 0 ? (
                                  <TrendingUp className="w-3 h-3 text-rose-600 shrink-0" />
                                ) : diff < 0 ? (
                                  <TrendingDown className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : null}
                                <span>{diff > 0 ? '+' : ''}{formatCurrency(diff, settings)}</span>
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                                Lãi {Math.round(item.margin_percentage * 10) / 10}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      </div>

                      {/* Expandable Recipe Breakdown Accordion */}
                      {isExpanded && item.recipe_details && (
                        <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200 space-y-1.5 animate-in fade-in-50 duration-150">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900 border-b border-emerald-200/60 pb-1">
                            <span className="flex items-center gap-1">
                              <Scale className="w-3 h-3 text-emerald-600" />
                              Chi tiết {item.recipe_details.length} nguyên liệu:
                            </span>
                            <span>Tổng: {formatCurrency(calculatedCost, settings)}</span>
                          </div>
                          <div className="space-y-1 pt-0.5">
                            {item.recipe_details.map((rd, ridx) => (
                              <div
                                key={ridx}
                                className="bg-white p-2 rounded-lg border border-emerald-100 flex items-center justify-between text-[11px]"
                              >
                                <div>
                                  <span className="font-bold text-slate-800">{rd.ingredient_name}</span>
                                  <span className="text-slate-400 block text-[10px]">
                                    {rd.usage_quantity} {rd.unit}
                                    {rd.yield_rate < 1.0 && ` • Thu hồi ${Math.round(rd.yield_rate * 100)}%`}
                                  </span>
                                </div>
                                <div className="text-right font-bold text-emerald-700">
                                  {formatCurrency(rd.line_cost, settings)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Footer Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenRecipeEditor(item)}
                          className="flex-1 py-2 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>🧪 Công thức</span>
                        </button>

                        {hasRecipe && (
                          <button
                            type="button"
                            onClick={() => handleApplySingleCost(item)}
                            disabled={applyingCostId === itemKey}
                            className="flex-1 py-2 px-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${applyingCostId === itemKey ? 'animate-spin' : ''}`} />
                            <span>🔄 Cập nhật giá</span>
                          </button>
                        )}

                        {hasRecipe && (
                          <button
                            type="button"
                            onClick={() => setExpandedItemId(isExpanded ? null : itemKey)}
                            className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition cursor-pointer"
                            title="Xem chi tiết nguyên liệu"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW (>= 768px): Clean Compact Data Table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">Món & Quy Cách</th>
                      <th className="py-3 px-3 text-right">Giá Bán Lẻ</th>
                      <th className="py-3 px-3 text-right">Giá Vốn Menu</th>
                      <th className="py-3 px-3 text-right">
                        Giá Vốn Mới ({pricingBasis === 'latest' ? 'Gần nhất' : 'Trung bình'})
                      </th>
                      <th className="py-3 px-3 text-right">Chênh Lệch & Lãi Gộp</th>
                      <th className="py-3 px-4 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCostItems.map((item) => {
                      const itemKey = `${item.target_type}-${item.target_id}`;
                      const isExpanded = expandedItemId === itemKey;
                      const calculatedCost =
                        pricingBasis === 'latest' ? item.estimated_cogs : item.estimated_cogs_avg;
                      const diff = calculatedCost - item.current_cogs;
                      const hasRecipe = item.recipe_item_count > 0;

                      return (
                        <React.Fragment key={itemKey}>
                          <tr className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-3">
                                {item.image_url && getImageUrl(item.image_url) ? (
                                  <img
                                    src={getImageUrl(item.image_url)!}
                                    alt={item.product_name}
                                    className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold shrink-0">
                                    {item.target_type === 'topping' ? 'TP' : 'M'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-extrabold text-slate-900">
                                    {item.product_name}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                      {item.variant_name}
                                    </span>
                                    <span>•</span>
                                    <span>{item.category_name || 'Topping'}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(item.retail_price, settings)}
                            </td>

                            <td className="py-3 px-3 text-right font-bold text-slate-600">
                              {formatCurrency(item.current_cogs, settings)}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {hasRecipe ? (
                                <div>
                                  <span className="font-extrabold text-emerald-800 text-sm">
                                    {formatCurrency(calculatedCost, settings)}
                                  </span>
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    {item.recipe_item_count} nguyên liệu
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                                  Chưa định lượng
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right">
                              {hasRecipe ? (
                                <div className="space-y-0.5">
                                  <div
                                    className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-1.5 py-0.5 rounded-md ${
                                      diff > 0
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : diff < 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {diff > 0 ? (
                                      <TrendingUp className="w-3 h-3 text-rose-600" />
                                    ) : diff < 0 ? (
                                      <TrendingDown className="w-3 h-3 text-emerald-600" />
                                    ) : null}
                                    <span>
                                      {diff > 0 ? '+' : ''}
                                      {formatCurrency(diff, settings)}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    Lãi: {Math.round(item.margin_percentage * 10) / 10}%
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRecipeEditor(item)}
                                  title="Cấu hình công thức & định lượng"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition active:scale-95 cursor-pointer"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Công thức</span>
                                </button>

                                {hasRecipe && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplySingleCost(item)}
                                    disabled={applyingCostId === itemKey}
                                    title="Áp dụng giá vốn mới vào Menu"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition active:scale-95 cursor-pointer"
                                  >
                                    <RefreshCw
                                      className={`w-3 h-3 ${
                                        applyingCostId === itemKey ? 'animate-spin' : ''
                                      }`}
                                    />
                                    <span>Áp dụng</span>
                                  </button>
                                )}

                                {hasRecipe && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedItemId(isExpanded ? null : itemKey)
                                    }
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Recipe Breakdown */}
                          {isExpanded && item.recipe_details && (
                            <tr className="bg-emerald-50/40">
                              <td colSpan={6} className="p-4">
                                <div className="space-y-2 max-w-4xl mx-auto bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                                    <span className="flex items-center gap-1">
                                      <Scale className="w-3.5 h-3.5 text-emerald-600" />
                                      Chi tiết định lượng nguyên liệu cho: {item.product_name} ({item.variant_name})
                                    </span>
                                    <span className="text-emerald-800">
                                      Tổng giá vốn: {formatCurrency(calculatedCost, settings)}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-[11px]">
                                    {item.recipe_details.map((rd, ridx) => (
                                      <div
                                        key={ridx}
                                        className="bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-0.5"
                                      >
                                        <div className="font-bold text-slate-900 flex justify-between">
                                          <span>{rd.ingredient_name}</span>
                                          <span className="text-emerald-700 font-extrabold">
                                            {formatCurrency(rd.line_cost, settings)}
                                          </span>
                                        </div>
                                        <div className="text-slate-500 text-[10px] flex justify-between">
                                          <span>
                                            Dùng: {rd.usage_quantity} {rd.unit}
                                            {rd.yield_rate < 1.0 && ` (Thu hồi: ${Math.round(rd.yield_rate * 100)}%)`}
                                          </span>
                                          <span>
                                            @ {formatCurrency(rd.latest_purchase_price, settings)}/{rd.unit}
                                          </span>
                                        </div>
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
            </>
          )}
        </div>
      )}

      {/* ── VIEW 2: INGREDIENTS CATALOG & PRICE TRACKER ──────────────────────── */}
      {activeSubTab === 'ingredients' && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-slate-200">
              <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
            </div>
          ) : filteredIngredients.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 font-semibold text-sm">
              Không tìm thấy nguyên liệu nào
            </div>
          ) : (
            <>
              {/* Mobile Card Grid for Ingredients */}
              <div className="grid grid-cols-1 gap-2.5 md:hidden">
                {filteredIngredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{ing.name}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                            ĐVT: {ing.unit}
                          </span>
                          <span>•</span>
                          <span>Thu hồi: {Math.round((ing.yield_rate || 1.0) * 100)}%</span>
                        </div>
                      </div>
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
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400 block">Giá gần nhất</span>
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {formatCurrency(ing.latest_purchase_price, settings)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold text-slate-400 block">Giá trung bình</span>
                        <span className="font-bold text-slate-700">
                          {formatCurrency(ing.average_purchase_price, settings)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenIngredientHistory(ing)}
                        className="p-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Lịch sử giá</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditIngredient(ing)}
                        className="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteIngredient(ing)}
                        className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table for Ingredients */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-3 px-4">Tên Nguyên Liệu</th>
                      <th className="py-3 px-3">Phân Loại</th>
                      <th className="py-3 px-3">Đơn Vị Tính</th>
                      <th className="py-3 px-3 text-right">Tỷ Lệ Thu Hồi</th>
                      <th className="py-3 px-3 text-right">Giá Gần Nhất</th>
                      <th className="py-3 px-3 text-right">Giá Trung Bình</th>
                      <th className="py-3 px-4 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIngredients.map((ing) => (
                      <tr key={ing.id} className="hover:bg-slate-50/80 transition">
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
                        <td className="py-3 px-3 font-semibold text-slate-700">{ing.unit}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-700">
                          {Math.round((ing.yield_rate || 1.0) * 100)}%
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                          {formatCurrency(ing.latest_purchase_price, settings)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-600">
                          {formatCurrency(ing.average_purchase_price, settings)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenIngredientHistory(ing)}
                              className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition active:scale-95 cursor-pointer"
                              title="Xem lịch sử giá nhập"
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
                    ))}
                  </tbody>
                </table>
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
                  <Scale className="w-5 h-5 text-indigo-600" />
                  Định Lượng Công Thức (BOM)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingRecipeTarget.product_name} ({editingRecipeTarget.variant_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecipeTarget(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Pricing KPI card */}
            <div className="bg-emerald-50/80 rounded-2xl p-3.5 border border-emerald-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">Giá vốn tính toán</span>
                <span className="text-xl font-black text-emerald-950">
                  {formatCurrency(recipePreviewCost, settings)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Giá bán lẻ / Lãi</span>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="font-bold text-slate-800">
                    {formatCurrency(editingRecipeTarget.retail_price, settings)}
                  </span>
                  <span className="font-black text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                    {recipeMarginPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* Recipe Line Items */}
            <div className="space-y-2.5">
              <label className="app-label">Thành phần nguyên liệu định lượng</label>
              {recipeLines.map((line, idx) => {
                const selectedIng = ingredients.find((i) => i.id === line.ingredient_id);
                return (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center gap-2"
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
                        className="app-select h-9 text-xs"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({formatCurrency(ing.latest_purchase_price, settings)}/{ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
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
                          className="app-input h-9 pr-8 text-xs font-bold text-right"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                          {selectedIng?.unit || 'kg'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRecipeLines((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
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
                    { ingredient_id: ingredients[0]?.id || 0, usage_quantity: 0.05 },
                  ]);
                }}
                className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-emerald-500 text-slate-600 hover:text-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Thêm nguyên liệu vào công thức</span>
              </button>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingIngredient ? 'Chỉnh Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsIngredientModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3">
              <div>
                <label className="app-label">Tên Nguyên Liệu / Vật Tư *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Xoài cát Chu, Sữa đặc, Cà phê Robusta..."
                  value={ingFormName}
                  onChange={(e) => setIngFormName(e.target.value)}
                  className="app-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="app-label">Phân Loại</label>
                  <select
                    value={ingFormCategory}
                    onChange={(e) => setIngFormCategory(e.target.value)}
                    className="app-select"
                  >
                    <option value="fruit">Hoa quả tươi</option>
                    <option value="ingredient">Nguyên liệu / Sữa</option>
                    <option value="packaging">Bao bì / Ly nắp</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="app-label">Đơn Vị Tính (ĐVT)</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: kg, hộp, quả, chai, túi..."
                    value={ingFormUnit}
                    onChange={(e) => setIngFormUnit(e.target.value)}
                    className="app-input"
                  />
                </div>
              </div>

              <div>
                <label className="app-label">Tỷ Lệ Thu Hồi Sau Sơ Chế (Yield Rate: 0.1 - 1.0)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    value={ingFormYieldRate}
                    onChange={(e) => setIngFormYieldRate(parseFloat(e.target.value) || 1.0)}
                    className="app-input w-28 text-center font-bold"
                  />
                  <span className="text-xs text-slate-500 font-semibold">
                    = {Math.round(ingFormYieldRate * 100)}% thành phẩm (vd: dưa hấu gọt vỏ 65%)
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
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
                  <span>{editingIngredient ? 'Cập Nhật' : 'Thêm Mới'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: INGREDIENT PURCHASE PRICE HISTORY ───────────────────────── */}
      {viewingHistoryIng && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  Lịch Sử Giá Nhập Hàng
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nguyên liệu: <strong>{viewingHistoryIng.name}</strong> ({viewingHistoryIng.unit})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingHistoryIng(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
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
              <div className="divide-y divide-slate-100 space-y-2">
                {ingHistoryRecords.map((rec) => (
                  <div key={rec.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800">
                        {formatCurrency(rec.unit_price, settings)} / {viewingHistoryIng.unit}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rec.created_at).toLocaleDateString('vi-VN')} • Số lượng: {rec.quantity} {viewingHistoryIng.unit}
                      </span>
                    </div>
                    <span className="font-extrabold text-slate-900">
                      {formatCurrency(rec.subtotal, settings)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-end">
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
