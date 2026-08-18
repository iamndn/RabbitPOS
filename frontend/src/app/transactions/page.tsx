'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Plus,
  Filter,
  Calendar,
  X,
  Building2,
  Wallet,
  ShoppingBag,
  FileText,
  Download,
  Receipt,
  RotateCcw,
  Ban,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Tag,
  Pencil,
  Trash2,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TransactionCategoryModal from '@/components/transactions/TransactionCategoryModal';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { exportToCsv } from '@/lib/exportCsv';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { CartItem, ProductVariant, Product } from '@/components/pos/VariantSelectorModal';
import { CategoryBreakdownResponse } from '@/types/analytics';
import { TransactionCategory } from '@/types/transaction_category';

interface Fund {
  id: number;
  name: string;
  fund_type: string;
}

interface Transaction {
  id: number;
  fund_id: number;
  fund?: Fund;
  transaction_type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  reference_order_id?: number;
  reference_order?: { order_code: string };
  description: string;
  created_by: string;
  cashier_name?: string;
  created_at: string;
}

interface OrderItemApi {
  id: number;
  order_id: number;
  product_variant_id: number;
  variant?: {
    id: number;
    product_id: number;
    variant_name: string;
    retail_price: number;
    cogs_price?: number;
    sku: string;
    product?: Product;
  };
  quantity: number;
  unit_price: number;
  line_total: number;
  selected_toppings: string;
  toppings_price: number;
  notes: string;
}

interface OrderApi {
  id: number;
  order_code: string;
  status: 'completed' | 'cancelled' | 'pending';
  subtotal: number;
  discount_amount: number;
  promotion_id?: number | null;
  promotion_discount: number;
  shipping_fee: number;
  platform_fee_discount: number;
  surcharge: number;
  total_amount: number;
  fund_id: number;
  fund?: Fund;
  items?: OrderItemApi[];
  created_by: string;
  cashier_name?: string;
  cancel_reason?: string;
  cancelled_at?: string;
  created_at: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // Active View Tab: 'transactions' | 'orders'
  const [activeTab, setActiveTab] = useState<'transactions' | 'orders'>('transactions');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<OrderApi[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Filters for Transactions
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filters for Orders
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Modal State: Manual Expense / Inflow / Edit
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalFundId, setModalFundId] = useState<number>(0);
  const [modalType, setModalType] = useState<'inflow' | 'outflow'>('outflow');
  const [modalCategory, setModalCategory] = useState<string>('ingredient_purchase');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalDescription, setModalDescription] = useState<string>('');

  // Modal State: Delete Transaction
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Dynamic Transaction Categories State
  const [txCategories, setTxCategories] = useState<TransactionCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);

  // Modal State: Cancel Order
  const [cancellingOrder, setCancellingOrder] = useState<OrderApi | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelWithRefund, setCancelWithRefund] = useState<boolean>(true);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Expanded Order Items Row
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Category Breakdown State
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [breakdownType, setBreakdownType] = useState<'outflow' | 'inflow'>('outflow');

  const loadCategories = async () => {
    const res = await fetchApi<TransactionCategory[]>('/transaction-categories');
    if (res.status === 'success' && Array.isArray(res.data)) {
      setTxCategories(res.data);
    }
  };

  const loadCategoryBreakdown = async (t: 'outflow' | 'inflow') => {
    setBreakdownType(t);
    const catRes = await fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=${t}`);
    if (catRes.status === 'success' && catRes.data) {
      setCategoryBreakdown(catRes.data);
    }
  };

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

    const [fundRes, txRes, orderRes, prodRes, catRes, txCatRes] = await Promise.all([
      fetchApi<Fund[]>('/funds'),
      fetchApi<Transaction[]>('/transactions'),
      fetchApi<OrderApi[]>('/orders'),
      fetchApi<Product[]>('/products'),
      fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=${breakdownType}`),
      fetchApi<TransactionCategory[]>('/transaction-categories'),
    ]);

    if (fundRes.status === 'success' && Array.isArray(fundRes.data)) {
      setFunds(fundRes.data);
      if (fundRes.data.length > 0 && modalFundId === 0) {
        setModalFundId(fundRes.data[0].id);
      }
    }
    if (txRes.status === 'success' && Array.isArray(txRes.data)) {
      setTransactions(txRes.data);
    }
    if (orderRes.status === 'success' && Array.isArray(orderRes.data)) {
      setOrders(orderRes.data);
    }
    if (prodRes.status === 'success' && Array.isArray(prodRes.data)) {
      setProducts(prodRes.data);
    }
    if (catRes.status === 'success' && catRes.data) {
      setCategoryBreakdown(catRes.data);
    }
    if (txCatRes.status === 'success' && Array.isArray(txCatRes.data)) {
      setTxCategories(txCatRes.data);
    }

    setLoading(false);
  };

  const getCategoryName = (categoryKey: string) => {
    const found = txCategories.find((c) => c.code === categoryKey || c.name === categoryKey);
    if (found) return found.name;
    switch (categoryKey) {
      case 'ingredient_purchase':
        return t('tx.cat_ingredient') || 'Mua nguyên liệu';
      case 'utility_bill':
        return t('tx.cat_utility') || 'Chi phí vận hành';
      case 'sale':
        return t('tx.cat_sale') || 'Doanh thu bán hàng';
      case 'reconciliation_variance':
        return t('tx.cat_reconciliation') || 'Chênh lệch đối soát';
      case 'other':
        return t('tx.cat_other') || 'Khác';
      default:
        return categoryKey.replace('_', ' ');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingTransaction(null);
    setModalType('outflow');
    if (funds.length > 0) setModalFundId(funds[0].id);
    const outflowCats = txCategories.filter((c) => c.type === 'outflow' || c.type === 'both');
    setModalCategory(outflowCats.length > 0 ? (outflowCats[0].code || outflowCats[0].name) : 'ingredient_purchase');
    setModalAmount(0);
    setModalDescription('');
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setModalType(tx.transaction_type);
    setModalFundId(tx.fund_id);
    setModalCategory(tx.category);
    setModalAmount(tx.amount);
    setModalDescription(tx.description || '');
    setIsExpenseModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalFundId || modalAmount <= 0) return;

    if (editingTransaction) {
      const res = await fetchApi<Transaction>(`/transactions/${editingTransaction.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          fund_id: modalFundId,
          transaction_type: modalType,
          category: modalCategory,
          amount: Number(modalAmount),
          description: modalDescription,
        }),
      });

      if (res.status === 'success') {
        setIsExpenseModalOpen(false);
        setEditingTransaction(null);
        setModalAmount(0);
        setModalDescription('');
        loadData();
      } else {
        alert(res.message || 'Failed to update transaction');
      }
    } else {
      const res = await fetchApi<Transaction>('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          fund_id: modalFundId,
          transaction_type: modalType,
          category: modalCategory,
          amount: Number(modalAmount),
          description: modalDescription,
          created_by: 'Manager',
        }),
      });

      if (res.status === 'success') {
        setIsExpenseModalOpen(false);
        setModalAmount(0);
        setModalDescription('');
        loadData();
      } else {
        alert(t('tx.log_failed', { error: res.message }));
      }
    }
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!deletingTransaction) return;
    setDeleteLoading(true);
    const res = await fetchApi<{ id: number }>(`/transactions/${deletingTransaction.id}`, {
      method: 'DELETE',
    });
    setDeleteLoading(false);
    if (res.status === 'success') {
      setDeletingTransaction(null);
      loadData();
    } else {
      alert(res.message || 'Failed to delete transaction');
    }
  };

  const handleOpenCancelModal = (order: OrderApi) => {
    setCancellingOrder(order);
    setCancelReason('');
    setCancelWithRefund(true);
  };

  const handleConfirmCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder || !cancelReason.trim()) return;

    setCancelLoading(true);
    const res = await fetchApi<OrderApi>(`/orders/${cancellingOrder.id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        refund: cancelWithRefund,
        cancel_reason: cancelReason.trim(),
      }),
    });

    if (res.status === 'success') {
      setCancellingOrder(null);
      await loadData();
    } else {
      alert(res.message || 'Failed to cancel order');
    }
    setCancelLoading(false);
  };

  // Re-order Flow: Hydrate cancelled order into POS cart and redirect
  const handleReorder = (order: OrderApi) => {
    if (!order.items || order.items.length === 0) return;

    const newCartItems: CartItem[] = order.items.map((item, idx) => {
      let selectedToppings = [];
      try {
        if (item.selected_toppings) {
          selectedToppings = JSON.parse(item.selected_toppings);
        }
      } catch {
        selectedToppings = [];
      }

      // Try matching product from loaded products
      const matchedProduct =
        products.find((p) => p.variants && p.variants.some((v) => v.id === item.product_variant_id)) || {
          id: item.variant?.product_id || 0,
          category_id: 1,
          name: item.variant?.variant_name || 'Sản phẩm',
          description: '',
          image_url: '',
          tag: 'none',
          variants: [],
        };

      const matchedVariant: ProductVariant = {
        id: item.variant?.id || item.product_variant_id,
        product_id: item.variant?.product_id || matchedProduct.id,
        variant_name: item.variant?.variant_name || 'Regular',
        cogs_price: item.variant?.cogs_price || 0,
        retail_price: item.unit_price,
        sku: item.variant?.sku || '',
      };

      return {
        id: `${matchedProduct.id}-${matchedVariant.id}-${Date.now()}-${idx}`,
        product: matchedProduct,
        selectedVariant: matchedVariant,
        sugarLevel: '100',
        iceLevel: '100',
        selectedToppings: selectedToppings,
        toppingsPrice: item.toppings_price || 0,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        notes: item.notes || '',
      };
    });

    // Save directly to localStorage
    try {
      localStorage.setItem(
        'rabbitpos_active_cart',
        JSON.stringify({
          cartItems: newCartItems,
          discountAmount: order.discount_amount || 0,
          shippingFee: order.shipping_fee || 0,
          platformFeeDiscount: order.platform_fee_discount || 0,
          surcharge: order.surcharge || 0,
        })
      );
      router.push('/');
    } catch (e) {
      console.error('Failed to restore re-order cart', e);
      alert('Không thể khôi phục giỏ hàng');
    }
  };

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeFunds = Array.isArray(funds) ? funds : [];

  const handleExportCsv = () => {
    exportToCsv<Transaction>('rabbitpos_transactions', filteredTransactions, [
      { header: 'ID', accessor: (tx) => tx.id },
      { header: 'Date', accessor: (tx) => new Date(tx.created_at).toLocaleString() },
      { header: 'Type', accessor: (tx) => tx.transaction_type },
      { header: 'Category', accessor: (tx) => tx.category },
      { header: 'Fund Account', accessor: (tx) => tx.fund?.name || tx.fund_id },
      { header: 'Amount', accessor: (tx) => formatCurrency(tx.amount, settings) },
      { header: 'Ref Order', accessor: (tx) => tx.reference_order?.order_code || '' },
      { header: 'Description', accessor: (tx) => tx.description },
      { header: 'Created By', accessor: (tx) => tx.cashier_name || tx.created_by },
    ]);
  };

  const filteredTransactions = safeTransactions.filter((tx) => {
    const matchesFund = selectedFundId ? tx.fund_id === selectedFundId : true;
    const matchesType = selectedType !== 'all' ? tx.transaction_type === selectedType : true;
    const matchesCat = selectedCategory !== 'all' ? tx.category === selectedCategory : true;
    return matchesFund && matchesType && matchesCat;
  });

  const filteredOrders = safeOrders.filter((order) => {
    const matchesSearch =
      order.order_code.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
      (order.cashier_name || '').toLowerCase().includes(orderSearchQuery.toLowerCase());
    const matchesStatus = orderStatusFilter === 'all' ? true : order.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalInflow = safeTransactions
    .filter((tx) => tx.transaction_type === 'inflow')
    .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

  const totalOutflow = safeTransactions
    .filter((tx) => tx.transaction_type === 'outflow')
    .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

  const netCashFlow = totalInflow - totalOutflow;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
              {t('tx.title')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">{t('tx.subtitle')}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Tag className="w-4 h-4 text-indigo-600" /> {t('tx_cat.btn_manage_categories') || 'Quản lý danh mục'}
            </button>
            <button
              onClick={handleExportCsv}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition"
            >
              <Download className="w-4 h-4 text-slate-500" /> {t('common.export_csv')}
            </button>
            <button
              onClick={handleOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" /> {t('tx.add_expense')}
            </button>
          </div>
        </div>

        {/* Tab Navigation: Ledger vs Orders */}
        <div className="flex space-x-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'transactions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            {t('tx.tab_transactions')}
            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">
              {safeTransactions.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Receipt className="w-4 h-4" />
            {t('tx.tab_orders')}
            <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full font-bold">
              {safeOrders.length}
            </span>
          </button>
        </div>

        {/* ── TAB 1: FINANCIAL LEDGER TRANSACTIONS ──────────────────────── */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* KPI Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">{t('tx.inflows')}</span>
                  <div className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(totalInflow, settings)}</div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <ArrowDownLeft className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">{t('tx.outflows')}</span>
                  <div className="text-2xl font-extrabold text-rose-600 mt-1">{formatCurrency(totalOutflow, settings)}</div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500">{t('tx.net_cash_flow')}</span>
                  <div className={`text-2xl font-extrabold mt-1 ${netCashFlow >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                    {formatCurrency(netCashFlow, settings)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Expense Category Breakdown Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    {t('tx.category_breakdown_title')}
                  </h3>
                  <p className="text-xs text-slate-400">{t('tx.category_breakdown_subtitle')}</p>
                </div>
                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => loadCategoryBreakdown('outflow')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      breakdownType === 'outflow'
                        ? 'bg-white text-rose-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('tx.outflows')}
                  </button>
                  <button
                    type="button"
                    onClick={() => loadCategoryBreakdown('inflow')}
                    className={`px-3 py-1 rounded-lg font-bold transition ${
                      breakdownType === 'inflow'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('tx.inflows')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {categoryBreakdown?.categories && categoryBreakdown.categories.length > 0 ? (
                  categoryBreakdown.categories.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase truncate pr-1">
                            {c.category_label}
                          </span>
                          <span
                            className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              breakdownType === 'outflow'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {c.percentage}%
                          </span>
                        </div>
                        <div
                          className={`text-base font-extrabold mt-1 ${
                            breakdownType === 'outflow' ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {formatCurrency(c.total_amount, settings)}
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${c.percentage}%` }}
                          className={`h-full rounded-full ${
                            breakdownType === 'outflow' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 text-right font-medium">
                        {c.count} {t('tx.transactions_count')}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="col-span-4 text-center text-slate-400 py-4 text-xs">{t('tx.no_transactions')}</p>
                )}
              </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedFundId || ''}
                  onChange={(e) => setSelectedFundId(e.target.value ? Number(e.target.value) : null)}
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
                >
                  <option value="">{t('tx.filter_all_funds')}</option>
                  {safeFunds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
                >
                  <option value="all">{t('tx.filter_all_types')}</option>
                  <option value="inflow">{t('tx.type_inflow')}</option>
                  <option value="outflow">{t('tx.type_outflow')}</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
                >
                  <option value="all">{t('tx.filter_all_categories')}</option>
                  {txCategories.length > 0 ? (
                    txCategories.map((c) => (
                      <option key={c.id} value={c.code || c.name}>
                        {c.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="sale">{t('tx.cat_sale')}</option>
                      <option value="ingredient_purchase">{t('tx.cat_ingredient')}</option>
                      <option value="utility_bill">{t('tx.cat_utility')}</option>
                      <option value="reconciliation_variance">{t('tx.cat_reconciliation')}</option>
                      <option value="other">{t('tx.cat_other')}</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Transaction History Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t('tx.date')}</th>
                      <th className="py-3 px-4">{t('tx.fund')}</th>
                      <th className="py-3 px-4">{t('tx.type')}</th>
                      <th className="py-3 px-4">{t('tx.category')}</th>
                      <th className="py-3 px-4">{t('tx.description')}</th>
                      <th className="py-3 px-4 text-right">{t('tx.amount')}</th>
                      <th className="py-3 px-4 text-center">{t('common.actions') || 'Thao tác'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          {t('tx.no_transactions')}
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const isInflow = tx.transaction_type === 'inflow';
                        const dateStr = new Date(tx.created_at).toLocaleString();
                        const isManual = !tx.reference_order_id && tx.category !== 'reconciliation_variance';

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition">
                            <td className="py-3 px-4 text-slate-600 font-mono">{dateStr}</td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {tx.fund?.name || t('tx.unknown_fund')}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${
                                  isInflow
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {isInflow ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                {isInflow ? t('tx.type_inflow') : t('tx.type_outflow')}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {getCategoryName(tx.category)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {tx.description}
                              {tx.reference_order?.order_code && (
                                <span className="ml-1.5 font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {tx.reference_order.order_code}
                                </span>
                              )}
                            </td>
                            <td className={`py-3 px-4 text-right font-extrabold text-sm ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isInflow ? '+' : '-'}{formatCurrency(tx.amount, settings)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isManual ? (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => handleOpenEditModal(tx)}
                                    title={t('common.edit') || 'Chỉnh sửa'}
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingTransaction(tx)}
                                    title={t('common.delete') || 'Xóa'}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                                  {t('tx.system_auto') || 'Tự động'}
                                </span>
                              )}
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
        )}

        {/* ── TAB 2: POS ORDERS & CANCELLATION LIFECYCLE ───────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Orders Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={t('tx.search_orders_placeholder')}
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-700 font-medium"
              >
                <option value="all">{t('tx.filter_all_order_status')}</option>
                <option value="completed">{t('tx.order_status_completed')}</option>
                <option value="cancelled">{t('tx.order_status_cancelled')}</option>
              </select>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t('tx.order_code')}</th>
                      <th className="py-3 px-4">{t('tx.date')}</th>
                      <th className="py-3 px-4">{t('tx.cashier')}</th>
                      <th className="py-3 px-4">{t('tx.fund')}</th>
                      <th className="py-3 px-4">{t('tx.items')}</th>
                      <th className="py-3 px-4">{t('common.status')}</th>
                      <th className="py-3 px-4 text-right">{t('common.total_amount')}</th>
                      <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          {t('tx.no_orders_found')}
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const isCancelled = order.status === 'cancelled';
                        const isExpanded = expandedOrderId === order.id;
                        const itemsCount = (order.items || []).reduce((acc, it) => acc + it.quantity, 0);

                        return (
                          <React.Fragment key={order.id}>
                            <tr className="hover:bg-slate-50 transition">
                              <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                {order.order_code}
                              </td>

                              <td className="py-3 px-4 text-slate-600 font-mono">
                                {new Date(order.created_at).toLocaleString()}
                              </td>

                              <td className="py-3 px-4 font-medium text-slate-800">
                                {order.cashier_name || order.created_by}
                              </td>

                              <td className="py-3 px-4 text-slate-700">
                                {order.fund?.name || `#${order.fund_id}`}
                              </td>

                              <td className="py-3 px-4">
                                <button
                                  type="button"
                                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                  className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-600 font-medium"
                                >
                                  <span>{itemsCount} món</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3 px-4">
                                {isCancelled ? (
                                  <div>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      <Ban className="w-3 h-3" />
                                      {t('tx.order_status_cancelled')}
                                    </span>
                                    {order.cancel_reason && (
                                      <span className="block text-[10px] text-rose-500 italic mt-0.5 truncate max-w-xs">
                                        {order.cancel_reason}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {t('tx.order_status_completed')}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-right font-extrabold text-slate-900 text-sm">
                                {formatCurrency(order.total_amount, settings)}
                              </td>

                              {/* Action Buttons: Cancel vs Re-order */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end space-x-1.5">
                                  {!isCancelled ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenCancelModal(order)}
                                      className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition flex items-center gap-1"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      {t('tx.cancel_order_btn')}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReorder(order)}
                                      className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition flex items-center gap-1 shadow-sm"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      {t('tx.reorder_btn')}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Collapsible Order Items Details Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={8} className="p-4">
                                  <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                                      <ShoppingBag className="w-4 h-4 text-indigo-600" />
                                      {t('tx.order_items_detail')} #{order.order_code}
                                    </h4>
                                    <div className="divide-y divide-slate-100">
                                      {(order.items || []).map((it) => (
                                        <div key={it.id} className="py-1.5 flex justify-between items-center text-slate-700">
                                          <div>
                                            <span className="font-semibold">{it.variant?.product?.name || it.variant?.variant_name || 'Món'}</span>
                                            <span className="text-slate-400 ml-2">x{it.quantity}</span>
                                            {it.notes && <span className="text-slate-500 block text-[11px] italic">{it.notes}</span>}
                                          </div>
                                          <span className="font-bold text-slate-900">{formatCurrency(it.line_total, settings)}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Breakdown summary */}
                                    <div className="pt-2 border-t border-slate-200 space-y-1 text-right text-[11px] text-slate-600">
                                      {order.discount_amount > 0 && <div>Giảm giá: -{formatCurrency(order.discount_amount, settings)}</div>}
                                      {order.promotion_discount > 0 && <div>Khuyến mãi: -{formatCurrency(order.promotion_discount, settings)}</div>}
                                      {order.platform_fee_discount > 0 && <div>Chiết khấu sàn: -{formatCurrency(order.platform_fee_discount, settings)}</div>}
                                      {order.shipping_fee > 0 && <div>Phí ship: +{formatCurrency(order.shipping_fee, settings)}</div>}
                                      {order.surcharge > 0 && <div>Phụ thu: +{formatCurrency(order.surcharge, settings)}</div>}
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
          </div>
        )}
      </div>

      {/* Manual Expense / Inflow Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingTransaction ? (t('tx.modal_edit_title') || 'Chỉnh sửa giao dịch') : (t('tx.modal_add_title') || 'Ghi nhận Thu / Chi thủ công')}
              </h3>
              <button
                onClick={() => {
                  setIsExpenseModalOpen(false);
                  setEditingTransaction(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('tx.modal_type_label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('outflow');
                      const outflowCats = txCategories.filter((c) => c.type === 'outflow' || c.type === 'both');
                      if (outflowCats.length > 0) {
                        setModalCategory(outflowCats[0].code || outflowCats[0].name);
                      } else {
                        setModalCategory('ingredient_purchase');
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      modalType === 'outflow'
                        ? 'border-rose-600 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('tx.outflow_label')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('inflow');
                      const inflowCats = txCategories.filter((c) => c.type === 'inflow' || c.type === 'both');
                      if (inflowCats.length > 0) {
                        setModalCategory(inflowCats[0].code || inflowCats[0].name);
                      } else {
                        setModalCategory('other');
                      }
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      modalType === 'inflow'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {t('tx.inflow_label')}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('tx.modal_fund_label')} *</label>
                <select
                  value={modalFundId}
                  onChange={(e) => setModalFundId(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {safeFunds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.fund_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">{t('tx.modal_category_label')} *</label>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    <span>{t('tx_cat.btn_manage_categories') || 'Quản lý danh mục'}</span>
                  </button>
                </div>
                <select
                  value={modalCategory}
                  onChange={(e) => setModalCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {(() => {
                    const activeCats = txCategories.filter(
                      (c) => c.type === modalType || c.type === 'both'
                    );
                    if (activeCats.length > 0) {
                      return activeCats.map((c) => (
                        <option key={c.id} value={c.code || c.name}>
                          {c.name}
                        </option>
                      ));
                    }
                    return modalType === 'outflow' ? (
                      <>
                        <option value="ingredient_purchase">{t('tx.cat_ingredient_purchase_detail')}</option>
                        <option value="utility_bill">{t('tx.cat_utility_detail')}</option>
                        <option value="other">{t('tx.cat_other_expense')}</option>
                      </>
                    ) : (
                      <>
                        <option value="sale">{t('tx.cat_manual_sale')}</option>
                        <option value="other">{t('tx.cat_other_inflow')}</option>
                      </>
                    );
                  })()}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('tx.modal_amount_label')} *</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="35.000"
                  value={modalAmount === 0 ? '' : modalAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setModalAmount(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('tx.modal_description_label')}</label>
                <textarea
                  rows={2}
                  placeholder={t('tx.description_placeholder')}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsExpenseModalOpen(false);
                    setEditingTransaction(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition flex items-center gap-1.5 ${
                    modalType === 'outflow' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {editingTransaction ? (t('common.save_changes') || 'Lưu thay đổi') : (t('tx.modal_submit') || 'Lưu giao dịch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  {t('tx.cancel_order_modal_title')} #{cancellingOrder.order_code}
                </h3>
              </div>
              <button
                onClick={() => setCancellingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancelOrder} className="space-y-4 text-xs">
              {/* Order Overview Summary */}
              <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 space-y-1">
                <div className="flex justify-between text-slate-700">
                  <span>Số tiền đơn hàng:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(cancellingOrder.total_amount, settings)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Tài khoản thanh toán:</span>
                  <span className="font-bold text-indigo-600">{cancellingOrder.fund?.name || `#${cancellingOrder.fund_id}`}</span>
                </div>
              </div>

              {/* Cancel Reason */}
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wide block mb-1">
                  {t('tx.cancel_reason_label')} *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('tx.cancel_reason_placeholder')}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                />
              </div>

              {/* Refund Checkbox */}
              <label className="flex items-start space-x-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelWithRefund}
                  onChange={(e) => setCancelWithRefund(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    {t('tx.refund_to_fund_checkbox', { fund: cancellingOrder.fund?.name || 'Quỹ' })}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Tự động tạo giao dịch chi hoàn tiền và khấu trừ số dư quỹ tương ứng.
                  </span>
                </div>
              </label>

              {/* Actions */}
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading || !cancelReason.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {cancelLoading ? t('common.loading') : t('tx.confirm_cancel_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Transaction Confirmation Modal */}
      {deletingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {t('tx.confirm_delete_tx_title') || 'Xác nhận xóa giao dịch'}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('tx.confirm_delete_tx_subtitle') || 'Hành động này sẽ tự động điều chỉnh hoàn trả số dư vào quỹ liên quan.'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl space-y-1.5 text-xs text-slate-700 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tx.fund')}:</span>
                <span className="font-semibold">{deletingTransaction.fund?.name || t('tx.unknown_fund')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tx.type')}:</span>
                <span className="font-bold">
                  {deletingTransaction.transaction_type === 'inflow' ? t('tx.type_inflow') : t('tx.type_outflow')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tx.category')}:</span>
                <span className="font-semibold">{getCategoryName(deletingTransaction.category)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tx.amount')}:</span>
                <span className="font-bold text-rose-600">
                  {formatCurrency(deletingTransaction.amount, settings)}
                </span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeletingTransaction(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                {t('common.cancel') || 'Hủy'}
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeleteTransaction}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleteLoading ? (t('common.loading') || 'Đang xử lý...') : (t('common.delete') || 'Xóa giao dịch')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Management Modal */}
      <TransactionCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={txCategories}
        onCategoriesUpdated={() => {
          loadCategories();
          loadCategoryBreakdown(breakdownType);
        }}
      />
    </AppShell>
  );
}
