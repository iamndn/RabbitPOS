'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store as StoreIcon,
  Plus,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit2,
  Trash2,
  ArrowRight,
  TrendingUp,
  Coins,
  Building2,
  ShoppingBag,
  Power,
  RotateCw,
  Sparkles,
  BarChart3,
  Calendar,
  Globe,
  DollarSign,
  PieChart,
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { fetchApi, getImageUrl } from '@/lib/api';
import { useStore } from '@/lib/StoreContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { formatCurrency } from '@/lib/utils';
import ModernDateRangePicker, {
  DatePeriod,
  computeDateRange,
} from '@/components/common/ModernDateRangePicker';
import StoreFormModal from '@/components/stores/StoreFormModal';
import MemberManagerModal from '@/components/stores/MemberManagerModal';
import {
  Store,
  OverviewAllStoresResponse,
  StoreOverviewItem,
} from '@/types/store';

function getBusinessBadge(type?: string) {
  switch (type) {
    case 'fnb':
    case 'fb':
      return { label: 'F&B / Ăn uống', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'cafe':
      return { label: 'Cà phê & Đồ uống', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'bakery':
      return { label: 'Tiệm bánh', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'retail':
      return { label: 'Bán lẻ', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    default:
      return { label: 'Khác', color: 'bg-slate-50 text-slate-700 border-slate-200' };
  }
}

export default function StoresPage() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { isSuperAdmin, activeStore, switchStore, refreshStores } = useStore();

  const [stores, setStores] = useState<Store[]>([]);
  const [overview, setOverview] = useState<OverviewAllStoresResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Date Range Filter for Cross-Store Executive Overview
  const [period, setPeriod] = useState<DatePeriod>('today');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);
  const [storeForMembers, setStoreForMembers] = useState<Store | null>(null);

  // Guard: super_admin only
  useEffect(() => {
    if (!isSuperAdmin) {
      router.push('/');
    }
  }, [isSuperAdmin, router]);

  const loadStores = async () => {
    setLoading(true);
    try {
      const storesRes = await fetchApi<Store[]>('/stores', { skipCache: true });
      if (storesRes.status === 'success' && storesRes.data) {
        setStores(storesRes.data);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách cửa hàng: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = async (start: string, end: string) => {
    setOverviewLoading(true);
    try {
      const res = await fetchApi<OverviewAllStoresResponse>(
        `/analytics/overview-all-stores?start_date=${start}&end_date=${end}`,
        { skipCache: true }
      );
      if (res.status === 'success' && res.data) {
        setOverview(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load overview:', err);
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadData = () => {
    loadStores();
    const { from: start, to: end } = computeDateRange(period, customFrom, customTo);
    loadOverview(start, end);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadStores();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      const { from: start, to: end } = computeDateRange(period, customFrom, customTo);
      loadOverview(start, end);
    }
  }, [isSuperAdmin, period, customFrom, customTo]);

  const handleOpenCreateModal = () => {
    setStoreToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (store: Store) => {
    setStoreToEdit(store);
    setIsFormModalOpen(true);
  };

  const handleOpenMemberModal = (store: Store) => {
    setStoreForMembers(store);
    setIsMemberModalOpen(true);
  };

  const handleToggleStoreStatus = async (store: Store) => {
    const actionText = store.is_active ? 'Tạm dừng hoạt động' : 'Kích hoạt lại';
    const ok = await confirm({
      title: `${actionText} cửa hàng`,
      message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} cửa hàng '${store.name}'?`,
      type: store.is_active ? 'warning' : 'info',
      confirmText: actionText,
    });
    if (!ok) return;

    try {
      const res = await fetchApi(`/stores/${store.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !store.is_active }),
      });

      if (res.status === 'success') {
        toast.success(`${actionText} cửa hàng thành công`);
        loadStores();
        const { from: start, to: end } = computeDateRange(period, customFrom, customTo);
        loadOverview(start, end);
        refreshStores();
      } else {
        toast.error(res.message || 'Thao tác thất bại');
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại');
    }
  };

  const handleSwitchToStore = (store: Store) => {
    switchStore(store.id);
    toast.success(`Đã chuyển sang cửa hàng: ${store.name}`);
    router.push('/');
  };

  // Filtered store list
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [stores, statusFilter, searchQuery]);

  if (!isSuperAdmin) return null;

  const totalMembers = stores.reduce((acc, s) => acc + (s.member_count || 0), 0);
  const activeCount = stores.filter((s) => s.is_active).length;

  const periodLabel =
    period === 'today' || period === 'day'
      ? 'Hôm nay'
      : period === 'yesterday'
      ? 'Hôm qua'
      : period === 'week'
      ? 'Tuần này'
      : period === 'month'
      ? 'Tháng này'
      : period === 'year'
      ? 'Năm nay'
      : 'Kỳ đã chọn';

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                <StoreIcon className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Quản lý Hệ thống Đa Cửa hàng
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Nền tảng Multi-Store: Khởi tạo chi nhánh, sao chép menu và phân quyền nhân sự
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Thêm Cửa hàng Mới</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 text-blue-700 rounded-2xl shrink-0">
              <StoreIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-slate-400 font-bold block truncate">
                Tổng số cửa hàng
              </span>
              <span className="text-lg sm:text-2xl font-black text-slate-900">
                {stores.length}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-slate-400 font-bold block truncate">
                Đang hoạt động
              </span>
              <span className="text-lg sm:text-2xl font-black text-emerald-700">
                {activeCount}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-slate-400 font-bold block truncate">
                Tổng nhân sự gán
              </span>
              <span className="text-lg sm:text-2xl font-black text-slate-900">
                {overview?.total_staff_count ?? totalMembers}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl shrink-0">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-slate-400 font-bold block truncate">
                Doanh thu ({periodLabel})
              </span>
              <span className="text-base sm:text-xl font-black text-amber-800 truncate block">
                {formatCurrency(overview?.total_range_revenue ?? overview?.total_today_revenue ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Cross-Store Executive Overview Section */}
        {overview && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Hiệu suất Kinh doanh Toàn Hệ thống
                  </h2>
                  <p className="text-xs text-slate-500">
                    So sánh doanh thu, số đơn, giá trị đơn TB (AOV) và lợi nhuận gộp giữa các cửa hàng
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ModernDateRangePicker
                  period={period}
                  customFrom={customFrom}
                  customTo={customTo}
                  onChange={({ period: newP, from: f, to: t }) => {
                    setPeriod(newP);
                    setCustomFrom(f);
                    setCustomTo(t);
                  }}
                  align="right"
                />
              </div>
            </div>

            {/* Range Metrics Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 block">Doanh thu Toàn Hệ thống</span>
                <span className="text-base sm:text-lg font-black text-slate-900">
                  {formatCurrency(overview.total_range_revenue ?? overview.total_today_revenue ?? 0)}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{periodLabel}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 block">Tổng Đơn hàng</span>
                <span className="text-base sm:text-lg font-black text-blue-700">
                  {(overview.total_range_orders ?? overview.total_today_orders ?? 0).toLocaleString()} đơn
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{periodLabel}</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 block">Giá trị Đơn TB (AOV)</span>
                <span className="text-base sm:text-lg font-black text-amber-700">
                  {formatCurrency(
                    (overview.total_range_orders && overview.total_range_orders > 0)
                      ? (overview.total_range_revenue ?? 0) / overview.total_range_orders
                      : 0
                  )}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Doanh thu / đơn</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-bold text-slate-400 block">Lợi nhuận Gộp Ước tính</span>
                <span className="text-base sm:text-lg font-black text-emerald-700">
                  {formatCurrency(overview.total_range_profit ?? 0)}
                </span>
                <span className="text-[10px] text-emerald-600 block mt-0.5">
                  {(overview.total_range_revenue && overview.total_range_revenue > 0)
                    ? `Biên LN: ${(((overview.total_range_profit ?? 0) / overview.total_range_revenue) * 100).toFixed(1)}%`
                    : 'Biên LN: 0%'}
                </span>
              </div>
            </div>

            {/* Store Breakdown Cards */}
            {overview.stores && overview.stores.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {overview.stores.map((item) => {
                  const itemRev = item.range_revenue ?? item.today_revenue;
                  const itemOrd = item.range_orders ?? item.today_orders;
                  const itemAov = item.range_aov ?? (itemOrd > 0 ? itemRev / itemOrd : 0);
                  const itemProf = item.range_profit ?? 0;
                  const itemMargin = itemRev > 0 ? (itemProf / itemRev) * 100 : 0;
                  const isCurrent = item.store_id === activeStore?.id;
                  const badge = getBusinessBadge(item.business_type);

                  return (
                    <div
                      key={item.store_id}
                      className={`p-4 rounded-2xl border transition space-y-3 ${
                        isCurrent
                          ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-500/20'
                          : 'bg-slate-50 border-slate-200/80 hover:bg-white hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {item.store_name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1 rounded">
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 font-semibold">
                              {item.store_code}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded border ${
                            item.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-400 border-slate-200'
                          }`}
                        >
                          {item.is_active ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Doanh thu ({periodLabel})</span>
                          <span className="text-xs font-black text-slate-900">
                            {formatCurrency(itemRev, { currency_symbol: item.currency })}
                          </span>
                          <span className="text-[9px] text-slate-500 block">{itemOrd} đơn</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">Lợi nhuận & Biên LN</span>
                          <span className="text-xs font-black text-emerald-700">
                            {formatCurrency(itemProf, { currency_symbol: item.currency })}
                          </span>
                          <span className="text-[9px] text-emerald-600 block">Biên LN: {itemMargin.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-[10px] text-slate-500">
                        <span>AOV: <strong className="text-slate-800">{formatCurrency(itemAov, { currency_symbol: item.currency })}</strong></span>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => {
                              const s = stores.find((x) => x.id === item.store_id);
                              if (s) handleSwitchToStore(s);
                            }}
                            className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                          >
                            <span>Chuyển</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Store List Header with Search & Filter Controls */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <span>Danh sách Cửa hàng</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {filteredStores.length}
              </span>
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, mã, địa chỉ..."
                  className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Status filter */}
              <div className="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'active'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Hoạt động
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    statusFilter === 'inactive'
                      ? 'bg-white text-amber-800 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tạm dừng
                </button>
              </div>
            </div>
          </div>

          {/* Stores Grid Cards */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Đang tải danh sách cửa hàng...
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Không tìm thấy cửa hàng nào phù hợp với điều kiện tìm kiếm.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStores.map((store) => {
                const isCurrent = store.id === activeStore?.id;
                const badge = getBusinessBadge(store.business_type);
                const initials = store.name ? store.name.slice(0, 2).toUpperCase() : 'RP';

                return (
                  <div
                    key={store.id}
                    className={`p-5 rounded-3xl border transition flex flex-col justify-between space-y-4 ${
                      isCurrent
                        ? 'bg-emerald-50/40 border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                    }`}
                  >
                    {/* Top Row: Avatar & Badges */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          {store.logo_url ? (
                            <img
                              src={getImageUrl(store.logo_url) || store.logo_url}
                              alt={store.name}
                              className="w-11 h-11 rounded-2xl object-contain bg-white border border-slate-200 p-1 shrink-0 shadow-xs"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {initials}
                            </div>
                          )}

                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate">
                              {store.name}
                            </h3>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                {store.code}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.color}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                            store.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {store.is_active ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </div>

                      {/* Store Meta Details */}
                      <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                        {store.address && (
                          <p className="truncate text-[11px] text-slate-500">
                            📍 {store.address}
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-[11px] text-slate-500">
                            📞 {store.phone}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>
                            Tiền tệ: <strong className="text-slate-700">{store.currency_code} ({store.currency_symbol})</strong>
                          </span>
                          <span className="flex items-center gap-1 font-semibold text-blue-700">
                            <Users className="w-3 h-3" /> {store.member_count || 0} nhân sự
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>
                            🌐 Múi giờ: <strong className="text-slate-600 font-mono">{store.timezone || 'Asia/Ho_Chi_Minh'}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(store)}
                          title="Chỉnh sửa thông tin cửa hàng"
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenMemberModal(store)}
                          title="Quản lý nhân sự & phân quyền"
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-xl transition active:scale-95"
                        >
                          <Users className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStoreStatus(store)}
                          title={store.is_active ? 'Tạm dừng cửa hàng' : 'Kích hoạt cửa hàng'}
                          className={`p-1.5 rounded-xl transition active:scale-95 ${
                            store.is_active
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Switch store button */}
                      {isCurrent ? (
                        <span className="text-[11px] font-black text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-xl border border-emerald-300">
                          Đang chọn
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSwitchToStore(store)}
                          className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-900 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition active:scale-95 cursor-pointer shadow-xs"
                        >
                          <span>Chuyển đến</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Store Form Modal (Create / Edit) */}
        <StoreFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSuccess={() => {
            loadData();
            refreshStores();
          }}
          storeToEdit={storeToEdit}
          existingStores={stores}
        />

        {/* Member Manager Modal */}
        <MemberManagerModal
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          store={storeForMembers}
          onUpdated={() => {
            loadData();
          }}
        />
      </div>
    </AppShell>
  );
}
