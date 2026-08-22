'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Layers,
  Sparkles,
  ArrowUpRight,
  Package,
  Calendar,
  History,
  X,
  Scale,
  Percent,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import ModernSelect from '@/components/common/ModernSelect';
import TransactionModal from '@/components/transactions/TransactionModal';
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

export default function PurchasesPage() {
  const { t } = useTranslation();

  // Active Tab: 'cost-estimator' | 'ingredients'
  const [activeTab, setActiveTab] = useState<'cost-estimator' | 'ingredients'>('cost-estimator');

  // Pricing Mode in Cost Estimator: 'latest' | 'average'
  const [pricingBasis, setPricingBasis] = useState<'latest' | 'average'>('latest');

  // Main Data States
  const [costItems, setCostItems] = useState<CostComparisonItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [txCategories, setTxCategories] = useState<TransactionCategory[]>([]);
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [ingSearchQuery, setIngSearchQuery] = useState<string>('');
  const [ingCategoryFilter, setIngCategoryFilter] = useState<string>('all');

  // Expanded Recipe Details Row
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingRecipeTarget, setEditingRecipeTarget] = useState<CostComparisonItem | null>(null);
  const [recipeLines, setRecipeLines] = useState<
    { ingredient_id: number; usage_quantity: number }[]
  >([]);
  const [savingRecipe, setSavingRecipe] = useState<boolean>(false);

  // Ingredient Create / Edit Modal
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState<boolean>(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [ingFormName, setIngFormName] = useState<string>('');
  const [ingFormCategory, setIngFormCategory] = useState<string>('fruit');
  const [ingFormUnit, setIngFormUnit] = useState<string>('kg');
  const [ingFormYieldRate, setIngFormYieldRate] = useState<number>(1.0);
  const [savingIngredient, setSavingIngredient] = useState<boolean>(false);

  // Ingredient History Modal
  const [viewingHistoryIng, setViewingHistoryIng] = useState<Ingredient | null>(null);
  const [ingHistoryRecords, setIngHistoryRecords] = useState<IngredientHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Toast Notification
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
      const [costRes, ingRes, fundsRes, txCatRes, setRes] = await Promise.all([
        fetchApi<CostComparisonItem[]>('/purchases/cost-comparison'),
        fetchApi<Ingredient[]>('/purchases/ingredients'),
        fetchApi<Fund[]>('/funds'),
        fetchApi<TransactionCategory[]>('/transaction-categories'),
        fetchApi<SettingsMap>('/settings'),
      ]);

      if (costRes.status === 'success' && Array.isArray(costRes.data)) {
        setCostItems(costRes.data);
      }
      if (ingRes.status === 'success' && Array.isArray(ingRes.data)) {
        setIngredients(ingRes.data);
      }
      if (fundsRes.status === 'success' && Array.isArray(fundsRes.data)) {
        setFunds(fundsRes.data);
      }
      if (txCatRes.status === 'success' && Array.isArray(txCatRes.data)) {
        setTxCategories(txCatRes.data);
      }
      if (setRes.status === 'success' && setRes.data) {
        setSettings(setRes.data);
      }
    } catch {
      showToast('error', 'Lỗi khi tải dữ liệu nhập hàng & giá vốn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Cost Estimator Items
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    costItems.forEach((item) => {
      if (item.category_name) set.add(item.category_name);
    });
    return Array.from(set);
  }, [costItems]);

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

  // Filtered Ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      const matchesSearch = ing.name.toLowerCase().includes(ingSearchQuery.toLowerCase());
      const matchesCat =
        ingCategoryFilter === 'all' || ing.category === ingCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [ingredients, ingSearchQuery, ingCategoryFilter]);

  // Summary Metrics
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

  // 1-Click Apply Cost
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
          `Đã cập nhật giá vốn món "${item.product_name} (${item.variant_name})" thành ${formatCurrency(
            newCost,
            settings
          )}`
        );
        loadData();
      } else {
        showToast('error', res.message || 'Lỗi khi cập nhật giá vốn');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setApplyingCostId(null);
    }
  };

  // Bulk Apply All Calculated Costs
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
          `Đã cập nhật giá vốn thành công cho ${itemsToApply.length} món ăn trên Menu!`
        );
        loadData();
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
      } else {
        showToast('error', res.message || 'Lỗi khi lưu công thức');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    } finally {
      setSavingRecipe(false);
    }
  };

  // Ingredient History Modal
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

  // Ingredient Add / Edit Handlers
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
          showToast('success', 'Đã cập nhật thông tin nguyên liệu thành công');
          setIsIngredientModalOpen(false);
          loadData();
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
          showToast('success', 'Đã thêm nguyên liệu mới vào danh mục thành công');
          setIsIngredientModalOpen(false);
          loadData();
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
      } else {
        showToast('error', res.message || 'Không thể xóa nguyên liệu');
      }
    } catch {
      showToast('error', 'Không thể kết nối máy chủ');
    }
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-7xl mx-auto w-full pb-10">
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Nhập Hàng & Định Lượng Giá Vốn
              </h1>
              <p className="text-xs text-slate-500">
                Theo dõi biến động giá nguyên liệu, tính toán giá vốn theo công thức & đồng bộ vào Menu
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddIngredient}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-2xl transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Nguyên Liệu</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-2xl shadow-sm transition active:scale-95 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>+ Chi Nhập Hàng</span>
            </button>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Nguyên liệu theo dõi
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900">{ingredients.length}</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                {metrics.fruitCount} hoa quả • {metrics.supplyCount} vật tư
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Đã định lượng công thức
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-slate-900">
                {metrics.itemsWithRecipe} <span className="text-xs text-slate-400">/ {metrics.totalItems}</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                {metrics.totalItems > 0
                  ? Math.round((metrics.itemsWithRecipe / metrics.totalItems) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Biên Lãi Gộp Dự Tính
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-extrabold text-emerald-700">
                {Math.round(metrics.avgMargin * 10) / 10}%
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                Theo giá nhập
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Chênh lệch giá vốn
            </span>
            <div className="flex items-baseline justify-between">
              <span
                className={`text-xl font-extrabold ${
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
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
              >
                {bulkApplying ? 'Đang cập nhật...' : 'Đồng bộ tất cả'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Selector & Controls Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-2xs">
          {/* Main Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('cost-estimator')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 ${
                activeTab === 'cost-estimator'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bảng Tính & Cập Nhật Giá Vốn (BOM)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ingredients')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 ${
                activeTab === 'ingredients'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Danh Mục & Giá Nhập Nguyên Liệu</span>
            </button>
          </div>

          {/* Estimator Controls (Pricing basis toggle & bulk apply) */}
          {activeTab === 'cost-estimator' && (
            <div className="flex flex-wrap items-center gap-2 px-2">
              <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold text-slate-600">
                <span className="px-2 text-slate-400">Giá tính:</span>
                <button
                  type="button"
                  onClick={() => setPricingBasis('latest')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    pricingBasis === 'latest'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Giá nhập gần nhất
                </button>
                <button
                  type="button"
                  onClick={() => setPricingBasis('average')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    pricingBasis === 'average'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Giá trung bình
                </button>
              </div>

              <button
                type="button"
                onClick={handleBulkApplyCosts}
                disabled={bulkApplying}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bulkApplying ? 'animate-spin' : ''}`} />
                <span>Áp Dụng Tất Cả Giá Vốn Mới</span>
              </button>
            </div>
          )}
        </div>

        {/* ── TAB 1: RECIPE COST ESTIMATOR & MENU SYNC ────────────────────────── */}
        {activeTab === 'cost-estimator' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
            {/* Search & Category Filter */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm món ăn, đồ uống, size..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    selectedCategory === 'all'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({costItems.length})
                </button>
                {categoriesList.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Table of Cost Comparisons */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <th className="py-3 px-4">Mặt Hàng & Quy Cách</th>
                    <th className="py-3 px-3 text-right">Giá Bán Lẻ</th>
                    <th className="py-3 px-3 text-right">Giá Vốn Hiện Tại (Menu)</th>
                    <th className="py-3 px-3 text-right">
                      Giá Vốn Tính Toán ({pricingBasis === 'latest' ? 'Mới nhất' : 'Trung bình'})
                    </th>
                    <th className="py-3 px-3 text-right">Chênh Lệch & Biên Lãi</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCostItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                        Không tìm thấy sản phẩm nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredCostItems.map((item) => {
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
                                    className="w-9 h-9 rounded-xl object-cover border border-slate-200"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold">
                                    {item.target_type === 'topping' ? 'TP' : 'M'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-extrabold text-slate-900">
                                    {item.product_name}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <span className="font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded">
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
                                  Chưa có định lượng
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
                                    title="Áp dụng giá vốn tính toán vào Menu"
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
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
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

                          {/* Expanded Recipe Breakdown Details */}
                          {isExpanded && item.recipe_details && (
                            <tr className="bg-emerald-50/40">
                              <td colSpan={6} className="p-4">
                                <div className="space-y-2 max-w-4xl mx-auto bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-1 border-b border-slate-100">
                                    <span className="flex items-center gap-1">
                                      <Scale className="w-3.5 h-3.5 text-emerald-600" />
                                      Chi tiết định lượng nguyên liệu cho: {item.product_name} (
                                      {item.variant_name})
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: INGREDIENTS CATALOG & PRICE TRACKER ──────────────────────── */}
        {activeTab === 'ingredients' && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xs overflow-hidden">
            {/* Search & Category Filter */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm nguyên liệu, hoa quả, bao bì..."
                  value={ingSearchQuery}
                  onChange={(e) => setIngSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => setIngCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    ingCategoryFilter === 'packaging'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Bao bì & Ly nắp
                </button>
              </div>
            </div>

            {/* Ingredients Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <th className="py-3 px-4">Tên Nguyên Liệu</th>
                    <th className="py-3 px-3">Phân Loại</th>
                    <th className="py-3 px-3">Đơn Vị Tính</th>
                    <th className="py-3 px-3 text-center">Tỷ Lệ Thu Hồi (Yield)</th>
                    <th className="py-3 px-3 text-right">Giá Nhập Gần Nhất</th>
                    <th className="py-3 px-3 text-right">Giá Nhập Trung Bình</th>
                    <th className="py-3 px-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                        Chưa có nguyên liệu nào. Nhấn "+ Thêm Nguyên Liệu" hoặc nhập hàng trong giao dịch chi.
                      </td>
                    </tr>
                  ) : (
                    filteredIngredients.map((ing) => (
                      <tr key={ing.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-extrabold text-slate-900">{ing.name}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              ing.category === 'fruit'
                                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                : ing.category === 'packaging'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
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
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {Math.round(ing.yield_rate * 100)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">
                          {formatCurrency(ing.latest_purchase_price, settings)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-600">
                          {formatCurrency(ing.average_purchase_price, settings)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenIngredientHistory(ing)}
                              title="Xem lịch sử các lần nhập hàng"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition active:scale-95 cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                              <span>Lịch sử</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditIngredient(ing)}
                              title="Chỉnh sửa nguyên liệu"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteIngredient(ing)}
                              title="Xóa nguyên liệu"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── MODAL 1: RECIPE BOM BUILDER MODAL ──────────────────────────────── */}
        {editingRecipeTarget && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    🧪
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Định Lượng Công Thức (BOM)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Món: <span className="font-bold text-slate-800">{editingRecipeTarget.product_name}</span> (
                      {editingRecipeTarget.variant_name})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingRecipeTarget(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-600 border-b border-slate-200">
                        <th className="pb-1.5 font-bold w-1/2">Nguyên Liệu</th>
                        <th className="pb-1.5 font-bold w-24 text-right">Định lượng</th>
                        <th className="pb-1.5 font-bold w-16">ĐVT</th>
                        <th className="pb-1.5 font-bold w-28 text-right">Chi phí ước tính</th>
                        <th className="pb-1.5 font-bold w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recipeLines.map((line, idx) => {
                        const ing = ingredients.find((i) => i.id === Number(line.ingredient_id));
                        const yieldRate = ing && ing.yield_rate > 0 ? ing.yield_rate : 1.0;
                        const effectivePrice = ing ? ing.latest_purchase_price / yieldRate : 0;
                        const lineCost = Math.round(Number(line.usage_quantity || 0) * effectivePrice);

                        return (
                          <tr key={idx}>
                            <td className="py-2 pr-2">
                              <select
                                value={line.ingredient_id}
                                onChange={(e) => {
                                  const updated = [...recipeLines];
                                  updated[idx].ingredient_id = Number(e.target.value);
                                  setRecipeLines(updated);
                                }}
                                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              >
                                {ingredients.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.name} ({i.unit} - {formatCurrency(i.latest_purchase_price)})
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="py-2 pr-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                required
                                value={line.usage_quantity === 0 ? '' : line.usage_quantity}
                                onChange={(e) => {
                                  const updated = [...recipeLines];
                                  updated[idx].usage_quantity =
                                    e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  setRecipeLines(updated);
                                }}
                                className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                              />
                            </td>

                            <td className="py-2 pr-2 font-semibold text-slate-500 text-xs">
                              {ing?.unit || 'kg'}
                            </td>

                            <td className="py-2 pr-2 text-right font-extrabold text-emerald-800">
                              {formatCurrency(lineCost, settings)}
                            </td>

                            <td className="py-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (recipeLines.length === 1) {
                                    setRecipeLines([
                                      {
                                        ingredient_id: ingredients[0]?.id || 0,
                                        usage_quantity: 0.1,
                                      },
                                    ]);
                                    return;
                                  }
                                  setRecipeLines(recipeLines.filter((_, i) => i !== idx));
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      setRecipeLines([
                        ...recipeLines,
                        { ingredient_id: ingredients[0]?.id || 0, usage_quantity: 0.1 },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-xl border border-indigo-200 transition active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm Nguyên Liệu</span>
                  </button>

                  <div className="text-right">
                    <span className="text-xs text-slate-500">Giá vốn dự kiến: </span>
                    <span className="text-sm font-extrabold text-emerald-800">
                      {formatCurrency(
                        recipeLines.reduce((acc, line) => {
                          const ing = ingredients.find((i) => i.id === Number(line.ingredient_id));
                          const yieldRate = ing && ing.yield_rate > 0 ? ing.yield_rate : 1.0;
                          const effectivePrice = ing ? ing.latest_purchase_price / yieldRate : 0;
                          return acc + (Number(line.usage_quantity || 0) * effectivePrice);
                        }, 0),
                        settings
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecipeTarget(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  disabled={savingRecipe}
                  onClick={handleSaveRecipe}
                  className="px-5 py-2 text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                >
                  {savingRecipe ? 'Đang lưu...' : 'Lưu Công Thức'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 2: INGREDIENT HISTORY MODAL ──────────────────────────────── */}
        {viewingHistoryIng && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    📜
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Lịch Sử Nhập Hàng: {viewingHistoryIng.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Giá gần nhất: {formatCurrency(viewingHistoryIng.latest_purchase_price, settings)} • Trung bình:{' '}
                      {formatCurrency(viewingHistoryIng.average_purchase_price, settings)} / {viewingHistoryIng.unit}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingHistoryIng(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {historyLoading ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400">
                  Đang tải lịch sử nhập hàng...
                </div>
              ) : ingHistoryRecords.length === 0 ? (
                <div className="py-10 text-center text-xs font-semibold text-slate-400">
                  Chưa có lịch sử nhập hàng nào được ghi nhận cho nguyên liệu này.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100 sticky top-0">
                        <th className="py-2.5 px-3">Thời gian</th>
                        <th className="py-2.5 px-3 text-right">Số lượng</th>
                        <th className="py-2.5 px-3 text-right">Đơn giá nhập</th>
                        <th className="py-2.5 px-3 text-right">Thành tiền</th>
                        <th className="py-2.5 px-3">Nguồn tiền & Thu ngân</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ingHistoryRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {new Date(rec.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {rec.quantity} {viewingHistoryIng.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                            {formatCurrency(rec.unit_price, settings)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                            {formatCurrency(rec.subtotal, settings)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            <span className="font-semibold text-slate-800">{rec.fund_name || 'Quỹ'}</span>
                            {rec.cashier_name && <span> • {rec.cashier_name}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewingHistoryIng(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL 3: INGREDIENT CREATE / EDIT MODAL ───────────────────────── */}
        {isIngredientModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto animate-in zoom-in-95 duration-150 border border-slate-100">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingIngredient ? 'Chỉnh Sửa Nguyên Liệu' : 'Thêm Nguyên Liệu Mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveIngredient} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 mb-1 block">Tên nguyên liệu *</label>
                  <input
                    type="text"
                    required
                    placeholder="Vd: Cam sành, Cà rốt, Sữa đặc, Ly 500ml..."
                    value={ingFormName}
                    onChange={(e) => setIngFormName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">Phân loại</label>
                    <select
                      value={ingFormCategory}
                      onChange={(e) => setIngFormCategory(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="fruit">Hoa quả tươi</option>
                      <option value="ingredient">Nguyên liệu & Sữa</option>
                      <option value="packaging">Bao bì & Ly nắp</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 mb-1 block">Đơn vị tính *</label>
                    <input
                      type="text"
                      required
                      placeholder="kg, lít, lon, hộp, cái..."
                      value={ingFormUnit}
                      onChange={(e) => setIngFormUnit(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                    </input>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      Tỷ lệ thu hồi (Yield Rate)
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold">
                      {Math.round(ingFormYieldRate * 100)}% thành phẩm
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="1.0"
                    value={ingFormYieldRate}
                    onChange={(e) => setIngFormYieldRate(parseFloat(e.target.value) || 1.0)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ví dụ: 0.45 cho Cam ép lấy nước, 0.55 cho Cà rốt ép, 1.0 cho Sữa đặc/Ly nắp.
                  </p>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsIngredientModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingIngredient}
                    className="px-5 py-2 text-xs font-extrabold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                  >
                    {savingIngredient ? 'Đang lưu...' : 'Lưu Nguyên Liệu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Integrated Outflow Expense Transaction Modal */}
        <TransactionModal
          isOpen={isExpenseModalOpen}
          onClose={() => setIsExpenseModalOpen(false)}
          onSuccess={() => {
            loadData();
          }}
          funds={funds}
          txCategories={txCategories}
        />
      </div>
    </AppShell>
  );
}
