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
  Clock,
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
  ChevronLeft,
  ChevronRight,
  Eye,
  Tag,
  Pencil,
  Trash2,
  Scale,
  Coins,
  History,
  Mail,
  RefreshCw,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import TransactionCategoryModal from '@/components/transactions/TransactionCategoryModal';
import TransactionModal from '@/components/transactions/TransactionModal';
import PurchasesCostTab from '@/components/transactions/PurchasesCostTab';
import ModernDateRangePicker, { DatePeriod, computeDateRange, getLocalMonthStr, getLocalDateStr, toLocalDateStr } from '@/components/common/ModernDateRangePicker';
import ModernSelect from '@/components/common/ModernSelect';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { exportToCsv } from '@/lib/exportCsv';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { CartItem, ProductVariant, Product } from '@/components/pos/VariantSelectorModal';
import { CategoryBreakdownResponse, FundsPeriodSummaryResponse } from '@/types/analytics';
import { TransactionCategory } from '@/types/transaction_category';
import { PurchaseItem } from '@/types/purchase';

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('vi-VN');
  } catch {
    return dateStr;
  }
};

interface Fund {
  id: number;
  name: string;
  fund_type: string;
  current_balance: number;
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
  purchase_items?: PurchaseItem[];
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
  note?: string;
  created_at: string;
}

export type TransactionTab = 'purchases' | 'ledger' | 'orders';

export default function TransactionsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();

  // Active View Tab: 'purchases' (Default) | 'ledger' | 'orders'
  const [activeTab, setActiveTab] = useState<TransactionTab>('purchases');
  const [showFundsSection, setShowFundsSection] = useState<boolean>(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [orders, setOrders] = useState<OrderApi[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<SettingsMap | null>(null);

  // Funds Management & Audit States
  const [periodSummary, setPeriodSummary] = useState<FundsPeriodSummaryResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getLocalMonthStr());
  const [fundsPeriod, setFundsPeriod] = useState<DatePeriod>('month');
  const [fundsCustomFrom, setFundsCustomFrom] = useState<string>(() => computeDateRange('month').from);
  const [fundsCustomTo, setFundsCustomTo] = useState<string>(() => computeDateRange('month').to);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);

  // Reconciliation Modal States
  const [selectedFundForReconcile, setSelectedFundForReconcile] = useState<Fund | null>(null);
  const [actualBalanceInput, setActualBalanceInput] = useState<number>(0);
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [reconciling, setReconciling] = useState<boolean>(false);
  const [sendEmailAfterReconcile, setSendEmailAfterReconcile] = useState<boolean>(false);
  const [reconcileToast, setReconcileToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setReconcileToast({ type, message });
    setTimeout(() => setReconcileToast(null), 5000);
  };

  // Filters for Transactions
  const [selectedFundId, setSelectedFundId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [period, setPeriod] = useState<DatePeriod>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => computeDateRange('month').from);
  const [customTo, setCustomTo] = useState<string>(() => computeDateRange('month').to);

  // Filters for Orders
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [debouncedOrderSearch, setDebouncedOrderSearch] = useState<string>('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // Pagination States (25 items/page)
  const PAGE_SIZE = 25;
  const [txPage, setTxPage] = useState<number>(1);
  const [orderPage, setOrderPage] = useState<number>(1);

  // Read URL query params on mount (?tab=purchases|ledger|orders)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'purchases') {
        setActiveTab('purchases');
      } else if (tabParam === 'ledger' || tabParam === 'transactions') {
        setActiveTab('ledger');
      } else if (tabParam === 'funds') {
        setActiveTab('ledger');
        setShowFundsSection(true);
      } else if (tabParam === 'orders') {
        setActiveTab('orders');
      }
      const fundIdParam = params.get('fund_id');
      if (fundIdParam) {
        const parsed = parseInt(fundIdParam, 10);
        if (!isNaN(parsed)) {
          setSelectedFundId(parsed);
        }
      }
    }
  }, []);

  const handleTabChange = (newTab: TransactionTab) => {
    setActiveTab(newTab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', newTab);
      router.replace(`/transactions?${params.toString()}`, { scroll: false });
    }
  };

  // Debounce order search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedOrderSearch(orderSearchQuery);
      setOrderPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [orderSearchQuery]);

  // Modal State: Manual Expense / Inflow / Edit
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [modalFundId, setModalFundId] = useState<number>(0);
  const [modalType, setModalType] = useState<'inflow' | 'outflow'>('outflow');
  const [modalCategory, setModalCategory] = useState<string>('ingredient_purchase');
  const [modalAmount, setModalAmount] = useState<number>(0);
  const [modalDescription, setModalDescription] = useState<string>('');
  const [modalCreatedAt, setModalCreatedAt] = useState<string | null>(null);

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

  // Breakdown States
  const [breakdownType, setBreakdownType] = useState<'outflow' | 'inflow'>('outflow');
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownResponse | null>(null);
  const [inflowTotal, setInflowTotal] = useState<number>(0);
  const [outflowTotal, setOutflowTotal] = useState<number>(0);
  const [inflowCount, setInflowCount] = useState<number>(0);
  const [outflowCount, setOutflowCount] = useState<number>(0);
  const [breakdownPeriod, setBreakdownPeriod] = useState<DatePeriod>('month');
  const [breakdownFromDate, setBreakdownFromDate] = useState<string>(() => computeDateRange('month').from);
  const [breakdownToDate, setBreakdownToDate] = useState<string>(() => computeDateRange('month').to);
  const [breakdownLoading, setBreakdownLoading] = useState<boolean>(false);

  const loadCategories = async () => {
    const res = await fetchApi<TransactionCategory[]>('/transaction-categories');
    if (res.status === 'success' && Array.isArray(res.data)) {
      setTxCategories(res.data);
    }
  };

  const loadCategoryBreakdown = async (
    t: 'outflow' | 'inflow' = breakdownType,
    p: DatePeriod = breakdownPeriod,
    f: string = breakdownFromDate,
    to: string = breakdownToDate
  ) => {
    setBreakdownLoading(true);
    setBreakdownType(t);
    try {
      let customQuery = '';
      if (p === 'custom' && f && to) {
        customQuery = `&from=${encodeURIComponent(f)}&to=${encodeURIComponent(to)}`;
      }

      // Concurrently fetch both Inflows & Outflows for the period so total KPI is always live & automatic
      const [outRes, inRes] = await Promise.all([
        fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=outflow&period=${p}${customQuery}`),
        fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=inflow&period=${p}${customQuery}`),
      ]);

      if (outRes.status === 'success' && outRes.data) {
        setOutflowTotal(outRes.data.total_amount || 0);
        setOutflowCount(outRes.data.total_count || 0);
        if (t === 'outflow') {
          setCategoryBreakdown(outRes.data);
        }
      }
      if (inRes.status === 'success' && inRes.data) {
        setInflowTotal(inRes.data.total_amount || 0);
        setInflowCount(inRes.data.total_count || 0);
        if (t === 'inflow') {
          setCategoryBreakdown(inRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to load category breakdown', err);
    } finally {
      setBreakdownLoading(false);
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

    const [fundRes, txRes, orderRes, prodRes, outRes, inRes, txCatRes] = await Promise.all([
      fetchApi<Fund[]>('/funds'),
      fetchApi<Transaction[]>('/transactions'),
      fetchApi<OrderApi[]>('/orders'),
      fetchApi<Product[]>('/products'),
      fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=outflow&period=${breakdownPeriod}`),
      fetchApi<CategoryBreakdownResponse>(`/transactions/category-breakdown?type=inflow&period=${breakdownPeriod}`),
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
    if (outRes.status === 'success' && outRes.data) {
      setOutflowTotal(outRes.data.total_amount || 0);
      setOutflowCount(outRes.data.total_count || 0);
      if (breakdownType === 'outflow') {
        setCategoryBreakdown(outRes.data);
      }
    }
    if (inRes.status === 'success' && inRes.data) {
      setInflowTotal(inRes.data.total_amount || 0);
      setInflowCount(inRes.data.total_count || 0);
      if (breakdownType === 'inflow') {
        setCategoryBreakdown(inRes.data);
      }
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

  const loadPeriodSummary = async () => {
    setSummaryLoading(true);
    const res = await fetchApi<FundsPeriodSummaryResponse>(`/funds/period-summary?month=${selectedMonth}`);
    if (res.status === 'success' && res.data) {
      setPeriodSummary(res.data);
    }
    setSummaryLoading(false);
  };

  useEffect(() => {
    loadPeriodSummary();
  }, [selectedMonth]);

  const openReconcileModal = (fund: Fund) => {
    setSelectedFundForReconcile(fund);
    setActualBalanceInput(fund.current_balance || 0);
    setReconcileNotes('');
  };

  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundForReconcile) return;

    setReconciling(true);
    const fundName = selectedFundForReconcile.name;
    const res = await fetchApi<any>(`/funds/${selectedFundForReconcile.id}/reconcile`, {
      method: 'POST',
      body: JSON.stringify({
        actual_balance: Number(actualBalanceInput),
        notes: reconcileNotes,
        created_by: 'Store Manager',
      }),
    });

    if (res.status === 'success') {
      setSelectedFundForReconcile(null);
      await loadData();
      await loadPeriodSummary();
      showToast('success', t('funds.reconcile_success', { name: fundName }));

      if (sendEmailAfterReconcile) {
        const today = new Date().toISOString().slice(0, 10);
        fetchApi<any>('/analytics/send-daily-report-email', {
          method: 'POST',
          body: JSON.stringify({ date: today }),
        }).then((emailRes) => {
          if (emailRes.status !== 'success') {
            console.warn('[TransactionsPage] Email report dispatch failed after reconciliation:', emailRes.message);
          }
        }).catch(console.warn);
      }
      setSendEmailAfterReconcile(false);
    } else {
      showToast('error', t('funds.reconcile_failed', { error: res.message }));
    }
    setReconciling(false);
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
    setModalCreatedAt(null);
    setIsExpenseModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setModalType(tx.transaction_type);
    setModalFundId(tx.fund_id);
    setModalCategory(tx.category);
    setModalAmount(tx.amount);
    setModalDescription(tx.description || '');
    setModalCreatedAt(tx.created_at || null);
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
          created_at: modalCreatedAt ? new Date(modalCreatedAt).toISOString() : undefined,
        }),
      });

      if (res.status === 'success') {
        setIsExpenseModalOpen(false);
        setEditingTransaction(null);
        setModalAmount(0);
        setModalDescription('');
        setModalCreatedAt(null);
        loadData();
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to update transaction', 'danger');
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
          created_at: modalCreatedAt ? new Date(modalCreatedAt).toISOString() : undefined,
        }),
      });

      if (res.status === 'success') {
        setIsExpenseModalOpen(false);
        setModalAmount(0);
        setModalDescription('');
        setModalCreatedAt(null);
        loadData();
      } else {
        showAlert(t('common.error') || 'Lỗi', t('tx.log_failed', { error: res.message }), 'danger');
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
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to delete transaction', 'danger');
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
      showAlert(t('common.error') || 'Lỗi', res.message || 'Failed to cancel order', 'danger');
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
      showAlert(t('common.error') || 'Lỗi', 'Không thể khôi phục giỏ hàng', 'danger');
    }
  };

  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeFunds = Array.isArray(funds) ? funds : [];

  const handleExportCsv = () => {
    if (activeTab === 'orders') {
      exportToCsv<OrderApi>('rabbitpos_orders', filteredOrders, [
        { header: 'Order Code', accessor: (o) => o.order_code },
        { header: 'Date', accessor: (o) => new Date(o.created_at).toLocaleString() },
        { header: 'Status', accessor: (o) => o.status },
        { header: 'Fund Account', accessor: (o) => o.fund?.name || (o.fund_id === 1 ? 'Tiền mặt' : 'Chuyển khoản') },
        { header: 'Cashier', accessor: (o) => o.cashier_name || o.created_by || '' },
        { header: 'Subtotal', accessor: (o) => formatCurrency(o.subtotal, settings) },
        { header: 'Discount', accessor: (o) => formatCurrency((o.discount_amount || 0) + (o.promotion_discount || 0) + (o.platform_fee_discount || 0), settings) },
        { header: 'Shipping Fee', accessor: (o) => formatCurrency(o.shipping_fee || 0, settings) },
        { header: 'Surcharge', accessor: (o) => formatCurrency(o.surcharge || 0, settings) },
        { header: 'Total Amount', accessor: (o) => formatCurrency(o.total_amount, settings) },
        { header: 'Notes', accessor: (o) => o.note || '' },
      ]);
    } else {
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
    }
  };

  const filteredTransactions = safeTransactions.filter((tx) => {
    const matchesFund = selectedFundId ? tx.fund_id === selectedFundId : true;
    const matchesType = selectedType !== 'all' ? tx.transaction_type === selectedType : true;
    const matchesCat = selectedCategory !== 'all' ? tx.category === selectedCategory : true;
    const txDate = toLocalDateStr(tx.created_at);
    const matchesDate = (!customFrom || txDate >= customFrom) && (!customTo || txDate <= customTo);
    return matchesFund && matchesType && matchesCat && matchesDate;
  });

  const totalTxPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

  const filteredOrders = safeOrders.filter((order) => {
    const matchesSearch =
      debouncedOrderSearch.trim() === '' ||
      order.order_code.toLowerCase().includes(debouncedOrderSearch.toLowerCase()) ||
      (order.cashier_name || '').toLowerCase().includes(debouncedOrderSearch.toLowerCase());
    const matchesStatus = orderStatusFilter === 'all' ? true : order.status === orderStatusFilter;
    const orderDate = toLocalDateStr(order.created_at);
    const matchesDate = (!customFrom || orderDate >= customFrom) && (!customTo || orderDate <= customTo);
    return matchesSearch && matchesStatus && matchesDate;
  });

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE);

  const totalInflow = filteredTransactions
    .filter((tx) => tx.transaction_type === 'inflow')
    .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

  const totalOutflow = filteredTransactions
    .filter((tx) => tx.transaction_type === 'outflow')
    .reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);

  const netCashFlow = totalInflow - totalOutflow;

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto w-full max-w-full overflow-x-hidden">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-emerald-700 shrink-0" />
              {t('tx.title') || 'Sổ Thu Chi & Giao Dịch'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('tx.subtitle') || 'Nhập hàng & định lượng giá vốn, sổ thu chi dòng tiền và lịch sử đơn hàng'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'ledger' && (
              <>
                <ModernDateRangePicker
                  period={period}
                  customFrom={customFrom}
                  customTo={customTo}
                  onChange={({ period: newP, from, to }) => {
                    setPeriod(newP);
                    setCustomFrom(from);
                    setCustomTo(to);
                  }}
                  align="right"
                />
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5 text-indigo-600" /> {t('tx_cat.btn_manage_categories') || 'Danh mục'}
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" /> {t('common.export_csv')}
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> {t('tx.add_expense')}
                </button>
              </>
            )}

            {activeTab === 'orders' && (
              <>
                <ModernDateRangePicker
                  period={period}
                  customFrom={customFrom}
                  customTo={customTo}
                  onChange={({ period: newP, from, to }) => {
                    setPeriod(newP);
                    setCustomFrom(from);
                    setCustomTo(to);
                  }}
                  align="right"
                />
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" /> {t('common.export_csv')}
                </button>
              </>
            )}

            {activeTab === 'purchases' && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> + Ghi Nhận Mua Hàng
              </button>
            )}
          </div>
        </div>

        {/* Sticky Tab Navigation Bar: 3 Tabs (Purchases & Costing, Ledger, Orders) */}
        <div className="sticky top-14 z-30 bg-slate-50/95 backdrop-blur-xs pt-1 pb-2 border-b border-slate-200/80">
          <div className="flex space-x-1 sm:space-x-2 bg-slate-200/70 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {/* TAB 1: Purchases & Recipe Costing (Default) */}
            <button
              type="button"
              onClick={() => handleTabChange('purchases')}
              className={`flex-1 min-w-[140px] py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('tx.tab_purchases') || '📦 Nhập hàng & Giá vốn'}</span>
            </button>

            {/* TAB 2: Financial Ledger */}
            <button
              type="button"
              onClick={() => handleTabChange('ledger')}
              className={`flex-1 min-w-[120px] py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{t('tx.tab_ledger') || '💸 Sổ thu chi'}</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold">
                {safeTransactions.length}
              </span>
            </button>

            {/* TAB 3: Order History */}
            <button
              type="button"
              onClick={() => handleTabChange('orders')}
              className={`flex-1 min-w-[140px] py-2 px-3 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'orders'
                  ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{t('tx.tab_orders') || '🧾 Lịch sử đơn hàng'}</span>
              <span className="bg-amber-50 text-amber-700 text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold">
                {safeOrders.length}
              </span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: PURCHASES & RECIPE COST ESTIMATOR (Default) ───────────── */}
        {activeTab === 'purchases' && (
          <PurchasesCostTab
            onOpenExpenseModal={handleOpenCreateModal}
            settings={settings}
            funds={safeFunds}
            txCategories={txCategories}
            onDataChanged={loadData}
          />
        )}

        {/* ── TAB 2: FINANCIAL LEDGER TRANSACTIONS ──────────────────────── */}
        {activeTab === 'ledger' && (
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

            {/* Expense / Income Category Breakdown Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-indigo-600" />
                    {t('tx.category_breakdown_title')}
                  </h3>
                  <p className="text-xs text-slate-400">{t('tx.category_breakdown_subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Date Range Picker for Breakdown */}
                  <ModernDateRangePicker
                    period={breakdownPeriod}
                    customFrom={breakdownFromDate}
                    customTo={breakdownToDate}
                    onChange={({ period, from, to }) => {
                      setBreakdownPeriod(period);
                      setBreakdownFromDate(from);
                      setBreakdownToDate(to);
                      loadCategoryBreakdown(breakdownType, period, from, to);
                    }}
                  />

                  {/* Inflow vs Outflow Type Switch */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        loadCategoryBreakdown('outflow', breakdownPeriod, breakdownFromDate, breakdownToDate);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${breakdownType === 'outflow'
                        ? 'bg-white text-rose-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      {t('tx.outflows')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        loadCategoryBreakdown('inflow', breakdownPeriod, breakdownFromDate, breakdownToDate);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${breakdownType === 'inflow'
                        ? 'bg-white text-emerald-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {t('tx.inflows')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-shown Period Total Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-emerald-100/80 shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                      {t('tx.inflows') || 'Tổng Thu'}
                    </span>
                    <div className="text-base sm:text-lg font-black text-emerald-600 mt-0.5">
                      +{formatCurrency(inflowTotal, settings)}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200/60">
                    {inflowCount} {t('tx.transactions_count') || 'giao dịch'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-rose-100/80 shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                      {t('tx.outflows') || 'Tổng Chi'}
                    </span>
                    <div className="text-base sm:text-lg font-black text-rose-600 mt-0.5">
                      -{formatCurrency(outflowTotal, settings)}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-200/60">
                    {outflowCount} {t('tx.transactions_count') || 'giao dịch'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-indigo-100/80 shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                      {t('tx.net_cash_flow') || 'Thu Chi Ròng'}
                    </span>
                    <div className={`text-base sm:text-lg font-black mt-0.5 ${inflowTotal - outflowTotal >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {inflowTotal - outflowTotal >= 0 ? '+' : ''}{formatCurrency(inflowTotal - outflowTotal, settings)}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${
                    inflowTotal - outflowTotal >= 0 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' 
                      : 'bg-rose-50 text-rose-700 border-rose-200/60'
                  }`}>
                    {inflowTotal - outflowTotal >= 0 ? 'Dương quỹ' : 'Âm quỹ'}
                  </span>
                </div>
              </div>

              {breakdownLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 animate-pulse">
                      <div className="h-3 bg-slate-200 rounded w-24" />
                      <div className="h-6 bg-slate-200 rounded w-32" />
                      <div className="h-1.5 bg-slate-200 rounded-full w-full" />
                      <div className="h-2.5 bg-slate-100 rounded w-16 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : (
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
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${breakdownType === 'outflow'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                            >
                              {c.percentage}%
                            </span>
                          </div>
                          <div
                            className={`text-base font-extrabold mt-1 ${breakdownType === 'outflow' ? 'text-rose-600' : 'text-emerald-600'
                              }`}
                          >
                            {formatCurrency(c.total_amount, settings)}
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            style={{ width: `${c.percentage}%` }}
                            className={`h-full rounded-full ${breakdownType === 'outflow' ? 'bg-rose-500' : 'bg-emerald-500'
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
              )}
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-[130px] sm:w-44 sm:flex-initial">
                  <ModernSelect
                    size="sm"
                    value={selectedFundId ?? ''}
                    placeholder={t('tx.filter_all_funds')}
                    clearable={true}
                    onChange={(val) => {
                      setSelectedFundId(val ? Number(val) : null);
                      setTxPage(1);
                    }}
                    options={[
                      { value: '', label: t('tx.filter_all_funds') || 'Tất cả nguồn tiền' },
                      ...safeFunds.map((f) => ({
                        value: f.id,
                        label: f.name,
                        subLabel: f.fund_type,
                        icon: <Wallet className="w-3.5 h-3.5 text-indigo-500" />,
                      })),
                    ]}
                  />
                </div>

                <div className="flex-1 min-w-[110px] sm:w-36 sm:flex-initial">
                  <ModernSelect
                    size="sm"
                    value={selectedType}
                    onChange={(val) => {
                      setSelectedType(String(val));
                      setTxPage(1);
                    }}
                    options={[
                      { value: 'all', label: t('tx.filter_all_types') || 'Tất cả loại' },
                      { value: 'inflow', label: t('tx.type_inflow') || 'Khoản thu (+)', badge: '+', badgeColor: 'emerald' },
                      { value: 'outflow', label: t('tx.type_outflow') || 'Khoản chi (-)', badge: '-', badgeColor: 'rose' },
                    ]}
                  />
                </div>

                <div className="w-full sm:w-48 sm:flex-initial">
                  <ModernSelect
                    size="sm"
                    searchable={true}
                    searchPlaceholder="Tìm danh mục..."
                    value={selectedCategory}
                    onChange={(val) => {
                      setSelectedCategory(String(val));
                      setTxPage(1);
                    }}
                    options={[
                      { value: 'all', label: t('tx.filter_all_categories') || 'Tất cả danh mục' },
                      ...(txCategories.length > 0
                        ? txCategories.map((c) => ({
                          value: c.code || c.name,
                          label: c.name,
                          badge: c.type === 'inflow' ? 'Thu' : c.type === 'outflow' ? 'Chi' : 'Thu/Chi',
                          badgeColor: (c.type === 'inflow' ? 'emerald' : c.type === 'outflow' ? 'rose' : 'indigo') as any,
                        }))
                        : [
                          { value: 'sale', label: t('tx.cat_sale') || 'Doanh thu bán hàng' },
                          { value: 'ingredient_purchase', label: t('tx.cat_ingredient') || 'Mua nguyên liệu' },
                          { value: 'utility_bill', label: t('tx.cat_utility') || 'Chi phí vận hành' },
                          { value: 'reconciliation_variance', label: t('tx.cat_reconciliation') || 'Chênh lệch đối soát' },
                        ]),
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Transaction History Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Desktop Table View (md and up) */}
              <div className="hidden md:block overflow-x-auto">
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
                      paginatedTransactions.map((tx) => {
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
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-fit ${isInflow
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
                              <div>{tx.description}</div>
                              {tx.reference_order?.order_code && (
                                <span className="mt-0.5 inline-block font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                                  {tx.reference_order.order_code}
                                </span>
                              )}
                              {tx.purchase_items && tx.purchase_items.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {tx.purchase_items.map((pi, pidx) => (
                                    <span
                                      key={pidx}
                                      className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md"
                                    >
                                      📦 {pi.ingredient?.name || pi.ingredient_name}: {pi.quantity} {pi.unit || pi.ingredient?.unit} @ {formatCurrency(pi.unit_price, settings)}
                                    </span>
                                  ))}
                                </div>
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

              {/* Mobile Cards View (< md) */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    {t('tx.no_transactions')}
                  </div>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isInflow = tx.transaction_type === 'inflow';
                    const dateStr = new Date(tx.created_at).toLocaleString();
                    const isManual = !tx.reference_order_id && tx.category !== 'reconciliation_variance';

                    return (
                      <div key={tx.id} className="p-4 space-y-2.5 bg-white">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                                isInflow
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {isInflow ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                              {isInflow ? t('tx.type_inflow') : t('tx.type_outflow')}
                            </span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                              {getCategoryName(tx.category)}
                            </span>
                          </div>
                          <span className={`font-extrabold text-base ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isInflow ? '+' : '-'}{formatCurrency(tx.amount, settings)}
                          </span>
                        </div>

                        {tx.description && (
                          <div className="text-xs text-slate-700">
                            <div>{tx.description}</div>
                            {tx.reference_order?.order_code && (
                              <span className="mt-0.5 inline-block font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                                {tx.reference_order.order_code}
                              </span>
                            )}
                            {tx.purchase_items && tx.purchase_items.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {tx.purchase_items.map((pi, pidx) => (
                                  <span
                                    key={pidx}
                                    className="inline-flex items-center text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-md"
                                  >
                                    📦 {pi.ingredient?.name || pi.ingredient_name}: {pi.quantity} {pi.unit || pi.ingredient?.unit} @ {formatCurrency(pi.unit_price, settings)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{tx.fund?.name || t('tx.unknown_fund')}</span>
                            <span>•</span>
                            <span className="font-mono text-slate-400">{dateStr}</span>
                          </div>
                          {isManual ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditModal(tx)}
                                className="p-1.5 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition"
                                title={t('common.edit')}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingTransaction(tx)}
                                className="p-1.5 text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg transition"
                                title={t('common.delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 rounded">
                              {t('tx.system_auto') || 'Tự động'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Transactions Pagination Controls */}
              {totalTxPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50 text-xs">
                  <span className="text-slate-500">
                    Trang {txPage} / {totalTxPages} ({filteredTransactions.length} giao dịch)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                      disabled={txPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-700 px-2">{txPage}</span>
                    <button
                      onClick={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                      disabled={txPage === totalTxPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Fund Management & Reconciliation Section Inside Ledger */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-700" />
                    <span>Quản Lý Tài Khoản Quỹ & Đối Soát Định Kỳ</span>
                  </h3>
                  <p className="text-xs text-slate-500">Xem số dư thực tế, đối soát lệch quỹ và bảng cân đối đầu/cuối kỳ</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFundsSection(!showFundsSection)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 transition active:scale-95 cursor-pointer self-start sm:self-auto"
                >
                  {showFundsSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>{showFundsSection ? 'Thu gọn' : 'Mở rộng đối soát quỹ'}</span>
                </button>
              </div>

              {showFundsSection && (
                <div className="space-y-6 pt-2">
                  {/* Funds Real-Time Balance Cards */}
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(Array.isArray(funds) ? funds : []).map((fund) => {
                        const isBank = fund.fund_type === 'bank';

                        return (
                          <div
                            key={fund.id}
                            className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-3 hover:border-indigo-200 transition"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`p-2.5 rounded-xl ${isBank ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                  {isBank ? <Building2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900 text-sm">{fund.name}</h4>
                                  <span className="text-[11px] font-semibold text-slate-400 capitalize">
                                    {t('funds.fund_type_label', { type: fund.fund_type })}
                                  </span>
                                </div>
                              </div>

                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> {t('funds.active_badge')}
                              </span>
                            </div>

                            {/* Balance Display */}
                            <div className="bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[11px] text-slate-500 font-medium">{t('funds.theoretical_balance')}</span>
                                <div className="text-xl font-black text-slate-900 mt-0.5">
                                  {formatCurrency(fund.current_balance, settings)}
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center space-x-2 pt-2 border-t border-slate-200/60">
                              <button
                                onClick={() => openReconcileModal(fund)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                              >
                                <Scale className="w-3.5 h-3.5" /> {t('funds.reconcile_count')}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedFundId(fund.id);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" /> {t('funds.history')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── PERIODIC BALANCE SUMMARY ─── */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-indigo-600" />
                          {t('funds.period_summary_title')}
                        </h4>
                        <p className="text-[11px] text-slate-500">{t('funds.period_summary_subtitle')}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-600">{t('funds.select_month')}:</span>
                        <ModernDateRangePicker
                          period={fundsPeriod}
                          customFrom={fundsCustomFrom}
                          customTo={fundsCustomTo}
                          onChange={({ period: newP, from, to }) => {
                            setFundsPeriod(newP);
                            setFundsCustomFrom(from);
                            setFundsCustomTo(to);
                            setSelectedMonth(from.slice(0, 7));
                          }}
                          align="right"
                        />
                      </div>
                    </div>

                    {/* Table & Cards */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                          <tr>
                            <th className="py-2.5 px-3">{t('funds.fund_name')}</th>
                            <th className="py-2.5 px-3 text-right">{t('funds.opening_balance')}</th>
                            <th className="py-2.5 px-3 text-right text-emerald-600">(+) {t('funds.period_inflow')}</th>
                            <th className="py-2.5 px-3 text-right text-rose-600">(-) {t('funds.period_outflow')}</th>
                            <th className="py-2.5 px-3 text-right">{t('funds.closing_balance')}</th>
                            <th className="py-2.5 px-3 text-right">{t('funds.prev_closing_balance')}</th>
                            <th className="py-2.5 px-3 text-right">{t('funds.growth_rate')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {summaryLoading ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                                {t('common.loading')}
                              </td>
                            </tr>
                          ) : periodSummary?.funds && periodSummary.funds.length > 0 ? (
                            <>
                              {periodSummary.funds.map((f) => (
                                <tr key={f.fund_id} className="hover:bg-slate-50 transition">
                                  <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-2">
                                    <span
                                      className={`w-2 h-2 rounded-full ${f.fund_type === 'bank' ? 'bg-blue-500' : 'bg-emerald-500'}`}
                                    />
                                    {f.fund_name}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                                    {formatCurrency(f.current_month.opening_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">
                                    +{formatCurrency(f.current_month.total_inflow, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-rose-600">
                                    -{formatCurrency(f.current_month.total_outflow, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                                    {formatCurrency(f.current_month.closing_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-400">
                                    {formatCurrency(f.prev_month.closing_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${f.growth_pct >= 0
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}
                                    >
                                      {f.growth_pct >= 0 ? '+' : ''}
                                      {f.growth_pct.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              ))}

                              {periodSummary?.totals && (
                                <tr className="bg-slate-50 font-extrabold text-slate-900 border-t-2 border-slate-200">
                                  <td className="py-2.5 px-3 uppercase text-xs">{t('common.all')}</td>
                                  <td className="py-2.5 px-3 text-right">
                                    {formatCurrency(periodSummary.totals.current_month.opening_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-emerald-600">
                                    +{formatCurrency(periodSummary.totals.current_month.total_inflow, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-rose-600">
                                    -{formatCurrency(periodSummary.totals.current_month.total_outflow, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-indigo-600 text-xs">
                                    {formatCurrency(periodSummary.totals.current_month.closing_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-500">
                                    {formatCurrency(periodSummary.totals.prev_month.closing_balance, settings)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${periodSummary.totals.growth_pct >= 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                        }`}
                                    >
                                      {periodSummary.totals.growth_pct >= 0 ? '+' : ''}
                                      {periodSummary.totals.growth_pct.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              )}
                            </>
                          ) : (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-slate-400 text-xs">
                                {t('funds.no_summary_data')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: POS ORDERS & CANCELLATION LIFECYCLE ───────────────── */}
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

              <div className="w-full sm:w-44">
                <ModernSelect
                  size="sm"
                  value={orderStatusFilter}
                  onChange={(val) => {
                    setOrderStatusFilter(String(val));
                    setOrderPage(1);
                  }}
                  options={[
                    { value: 'all', label: t('tx.filter_all_order_status') || 'Tất cả trạng thái' },
                    { value: 'completed', label: t('tx.order_status_completed') || 'Hoàn thành', badge: 'Completed', badgeColor: 'emerald' },
                    { value: 'cancelled', label: t('tx.order_status_cancelled') || 'Đã hủy', badge: 'Cancelled', badgeColor: 'rose' },
                  ]}
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Desktop Table View (md and up) */}
              <div className="hidden md:block overflow-x-auto">
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
                      paginatedOrders.map((order) => {
                        const isCancelled = order.status === 'cancelled';
                        const isExpanded = expandedOrderId === order.id;
                        const items = order.items || [];
                        const itemCount = items.reduce((acc, it) => acc + (it.quantity || 0), 0);

                        return (
                          <React.Fragment key={order.id}>
                            <tr
                              className={`hover:bg-slate-50 transition cursor-pointer ${
                                isCancelled ? 'opacity-60 bg-rose-50/20' : ''
                              } ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            >
                              <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                <div className="flex items-center space-x-1.5">
                                  {isExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span>{order.order_code}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                {formatDateTime(order.created_at)}
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-700">
                                {order.cashier_name || order.created_by || '—'}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {order.fund?.name || (funds.find((f) => f.id === order.fund_id)?.name ?? '—')}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-700">
                                {itemCount} {t('pos.items_count') || 'món'}
                              </td>
                              <td className="py-3 px-4">
                                {isCancelled ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                                    <Ban className="w-3 h-3 mr-1" />
                                    {t('tx.order_status_cancelled') || 'Đã hủy'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {t('tx.order_status_completed') || 'Hoàn thành'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-extrabold text-slate-900">
                                {formatCurrency(order.total_amount, settings)}
                              </td>
                              <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end space-x-1.5">
                                  <button
                                    onClick={() => handleReorder(order)}
                                    title={t('tx.reorder_tooltip') || 'Đặt lại đơn này'}
                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  {!isCancelled && (
                                    <button
                                      onClick={() => setCancellingOrder(order)}
                                      title={t('tx.cancel_order_tooltip') || 'Hủy đơn hàng'}
                                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                                    >
                                      <Ban className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {/* Expanded Order Items Row */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70">
                                <td colSpan={8} className="p-4 border-t border-slate-100">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                      <span className="font-semibold text-slate-700 uppercase tracking-wider">
                                        {t('tx.order_items_detail') || 'Chi tiết món'} ({items.length} mặt hàng)
                                      </span>
                                      {order.note && (
                                        <span className="text-slate-500 italic">
                                          Ghi chú: {order.note}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                      {items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs space-y-1 shadow-2xs"
                                        >
                                          <div className="flex justify-between items-start">
                                            <span className="font-bold text-slate-800">
                                              {item.variant?.product?.name || item.variant?.variant_name || 'Sản phẩm'}
                                            </span>
                                            <span className="font-semibold text-slate-900">
                                              x{item.quantity}
                                            </span>
                                          </div>
                                          {item.variant?.variant_name && item.variant?.variant_name !== 'Default' && (
                                            <div className="text-[11px] text-slate-400 font-medium">
                                              Size/Loại: {item.variant.variant_name}
                                            </div>
                                          )}
                                          {item.selected_toppings && item.selected_toppings !== '[]' && (
                                            <div className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md inline-block">
                                              + {item.selected_toppings}
                                            </div>
                                          )}
                                          <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
                                            <span className="text-slate-400">Đơn giá: {formatCurrency(item.unit_price, settings)}</span>
                                            <span className="font-bold text-indigo-600">{formatCurrency(item.line_total, settings)}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {isCancelled && order.cancel_reason && (
                                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5 text-xs text-rose-700 flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>Lý do hủy: {order.cancel_reason} ({formatDateTime(order.cancelled_at || '')})</span>
                                      </div>
                                    )}
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

              {/* Mobile Orders View (< md) */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    {t('tx.no_orders_found')}
                  </div>
                ) : (
                  paginatedOrders.map((order) => {
                    const isCancelled = order.status === 'cancelled';
                    const isExpanded = expandedOrderId === order.id;
                    const items = order.items || [];
                    const itemCount = items.reduce((acc, it) => acc + (it.quantity || 0), 0);

                    return (
                      <div
                        key={order.id}
                        className={`p-3.5 space-y-2.5 transition ${
                          isCancelled ? 'bg-rose-50/20' : 'bg-white'
                        }`}
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-indigo-600 text-xs">
                              {order.order_code}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-400">
                              {formatDateTime(order.created_at)}
                            </span>
                          </div>
                          {isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              Đã hủy
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              Hoàn thành
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            {itemCount} món • {order.fund?.name || (funds.find((f) => f.id === order.fund_id)?.name ?? 'Tiền mặt')}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm">
                            {formatCurrency(order.total_amount, settings)}
                          </span>
                        </div>

                        {/* Expandable items on mobile */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                            <div className="font-semibold text-slate-600 text-[11px] uppercase tracking-wider">
                              Chi tiết món:
                            </div>
                            <div className="space-y-1.5 bg-slate-50 p-2 rounded-xl">
                              {items.map((item) => (
                                <div key={item.id} className="flex justify-between items-start text-xs">
                                  <div>
                                    <span className="font-bold text-slate-800">
                                      {item.variant?.product?.name || item.variant?.variant_name}
                                    </span>
                                    {item.variant?.variant_name && item.variant?.variant_name !== 'Default' && (
                                      <span className="text-[10px] text-slate-400 ml-1">
                                        ({item.variant.variant_name})
                                      </span>
                                    )}
                                    {item.selected_toppings && item.selected_toppings !== '[]' && (
                                      <div className="text-[10px] text-indigo-600">
                                        + {item.selected_toppings}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="font-semibold text-slate-700">x{item.quantity}</span>
                                    <span className="text-slate-400 text-[10px] ml-1.5">
                                      {formatCurrency(item.line_total, settings)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {isCancelled && order.cancel_reason && (
                              <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100">
                                Lý do hủy: {order.cancel_reason}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                            className="text-slate-400 hover:text-slate-600 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                          </button>
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleReorder(order)}
                              className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Đặt lại</span>
                            </button>
                            {!isCancelled && (
                              <button
                                type="button"
                                onClick={() => setCancellingOrder(order)}
                                className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition cursor-pointer"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Hủy đơn</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Orders Pagination Controls */}
              {totalOrderPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-slate-100 bg-slate-50 text-xs">
                  <span className="text-slate-500">
                    Trang {orderPage} / {totalOrderPages} ({filteredOrders.length} đơn hàng)
                  </span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                      disabled={orderPage === 1}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-700 px-2">{orderPage}</span>
                    <button
                      onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                      disabled={orderPage === totalOrderPages}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal (with Integrated Purchase Logging) */}
      <TransactionModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingTransaction(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        funds={safeFunds}
        txCategories={txCategories}
        initialData={
          editingTransaction
            ? {
                id: editingTransaction.id,
                fund_id: editingTransaction.fund_id,
                transaction_type: editingTransaction.transaction_type,
                category: editingTransaction.category,
                amount: editingTransaction.amount,
                description: editingTransaction.description,
                created_at: editingTransaction.created_at,
              }
            : null
        }
      />

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

      {/* Reconcile Dialog Modal */}
      {selectedFundForReconcile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-indigo-600">
                <Scale className="w-5 h-5" />
                <h2 className="font-bold text-base text-slate-900">
                  {t('funds.reconcile_fund_title', { name: selectedFundForReconcile.name })}
                </h2>
              </div>
              <button
                onClick={() => setSelectedFundForReconcile(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReconciliation} className="space-y-4 text-xs">
              {/* Theoretical Balance Card */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-slate-500 font-semibold">{t('funds.theoretical_balance_label')}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {formatCurrency(selectedFundForReconcile.current_balance, settings)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-800 mb-1 block">{t('funds.actual_balance_label')}</label>
                <input
                  type="number"
                  step="1000"
                  min="0"
                  required
                  placeholder="500.000"
                  value={actualBalanceInput === 0 ? '' : actualBalanceInput}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setActualBalanceInput(raw === '' ? 0 : parseInt(raw, 10));
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-base font-extrabold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Live Variance Calculation */}
              {(() => {
                const variance = actualBalanceInput - selectedFundForReconcile.current_balance;
                if (variance === 0) {
                  return (
                    <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{t('funds.variance_none')}</span>
                    </div>
                  );
                } else if (variance > 0) {
                  return (
                    <div className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{t('funds.variance_surplus', { amount: formatCurrency(variance, settings) })}</span>
                    </div>
                  );
                } else {
                  return (
                    <div className="p-3 bg-rose-50 text-rose-900 rounded-xl border border-rose-200 flex items-center gap-2 font-medium">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{t('funds.variance_deficit', { amount: formatCurrency(Math.abs(variance), settings) })}</span>
                    </div>
                  );
                }
              })()}

              <div>
                <label className="font-semibold text-slate-700 mb-1 block">{t('funds.reconcile_notes_label')}</label>
                <textarea
                  rows={2}
                  placeholder={t('funds.reconcile_notes_placeholder')}
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email report option after reconciliation */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <input
                  type="checkbox"
                  checked={sendEmailAfterReconcile}
                  onChange={(e) => setSendEmailAfterReconcile(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <Mail className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800">{t('email_report.funds_prompt_label')}</span>
              </label>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedFundForReconcile(null)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={reconciling}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {reconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('funds.submit_reconcile')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Toast Notification */}
      {reconcileToast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-2xl text-sm font-semibold ${reconcileToast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
          {reconcileToast.message}
        </div>
      )}
    </AppShell>
  );
}
