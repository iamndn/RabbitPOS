'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Percent,
  Receipt,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Tag,
  ArrowDownLeft,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { formatCurrency, formatDateTime, SettingsMap } from '@/lib/utils';
import ModernSelect from '@/components/common/ModernSelect';
import { FilterBar, Chip } from '@/components/ui';
import { ModalShell } from '@/components/ui/ModalShell';

export interface DiscountedOrderItem {
  id: number;
  product_variant_id: number;
  quantity: number;
  unit_price: number;
  line_total: number;
  selected_toppings?: string;
  variant?: {
    id: number;
    variant_name: string;
    product?: {
      id: number;
      name: string;
    };
  };
}

export interface DiscountedOrder {
  id: number;
  order_code: string;
  status: string;
  subtotal: number;
  discount_amount: number;
  promotion_id?: number | null;
  promotion_discount: number;
  shipping_fee: number;
  platform_fee_discount: number;
  surcharge: number;
  total_amount: number;
  fund_id: number;
  fund?: {
    id: number;
    name: string;
  };
  created_by?: string;
  cashier_name?: string;
  note?: string | null;
  created_at: string;
  items?: DiscountedOrderItem[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  from?: string;
  to?: string;
  periodName?: string;
  settings?: SettingsMap | null;
  totalGrossSales?: number;
  totalCompletedOrders?: number;
}

export default function DiscountedOrdersModal({
  isOpen,
  onClose,
  from,
  to,
  periodName,
  settings,
  totalGrossSales = 0,
  totalCompletedOrders = 0,
}: Props) {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<DiscountedOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  const [selectedDiscountRange, setSelectedDiscountRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'discount_desc' | 'time_desc' | 'subtotal_desc'>('discount_desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Fetch discounted orders when modal is opened or date range changes
  useEffect(() => {
    if (!isOpen) return;

    const fetchDiscountedOrders = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let url = `/orders?has_discount=true&status=completed`;
        if (from) url += `&from=${encodeURIComponent(from)}`;
        if (to) url += `&to=${encodeURIComponent(to)}`;

        const res = await fetchApi<DiscountedOrder[] | { items: DiscountedOrder[] }>(url);
        if (res.status === 'error') {
          setError(res.message || 'Lỗi khi tải danh sách');
        } else if (res.data) {
          if (Array.isArray(res.data)) {
            setOrders(res.data);
          } else if (res.data.items && Array.isArray(res.data.items)) {
            setOrders(res.data.items);
          }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không thể tải danh sách đơn giảm giá');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDiscountedOrders();
    setCurrentPage(1);
    setSearchQuery('');
    setSelectedCashier('all');
    setSelectedDiscountRange('all');
  }, [isOpen, from, to]);

  // Unique cashiers for filter dropdown
  const cashierOptions = useMemo(() => {
    const cashiers = new Set<string>();
    orders.forEach((o) => {
      const name = o.cashier_name || o.created_by;
      if (name) cashiers.add(name);
    });
    return [
      { value: 'all', label: 'Tất cả thu ngân' },
      ...Array.from(cashiers).map((c) => ({ value: c, label: `Thu ngân: ${c}` })),
    ];
  }, [orders]);

  // Total summary of all loaded discounted orders
  const totalSummary = useMemo(() => {
    const totalDiscountAmount = orders.reduce(
      (sum, o) => sum + (o.discount_amount || 0) + (o.promotion_discount || 0) + (o.platform_fee_discount || 0),
      0
    );
    const totalOrdersCount = orders.length;
    const avgDiscount = totalOrdersCount > 0 ? totalDiscountAmount / totalOrdersCount : 0;
    const discountRate = totalGrossSales > 0 ? (totalDiscountAmount / totalGrossSales) * 100 : 0;

    return {
      totalDiscountAmount,
      totalOrdersCount,
      avgDiscount,
      discountRate,
    };
  }, [orders, totalGrossSales]);

  // Filtered & Sorted orders
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const totalDiscount = (o.discount_amount || 0) + (o.promotion_discount || 0) + (o.platform_fee_discount || 0);

        // Filter by discount value range
        if (selectedDiscountRange === 'under_30k' && totalDiscount >= 30000) return false;
        if (selectedDiscountRange === '30k_50k' && (totalDiscount < 30000 || totalDiscount > 50000)) return false;
        if (selectedDiscountRange === '50k_100k' && (totalDiscount <= 50000 || totalDiscount > 100000)) return false;
        if (selectedDiscountRange === 'over_100k' && totalDiscount <= 100000) return false;

        // Filter by Cashier
        if (selectedCashier !== 'all') {
          const name = o.cashier_name || o.created_by;
          if (name !== selectedCashier) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchCode = o.order_code?.toLowerCase().includes(q);
          const matchCashier = (o.cashier_name || o.created_by)?.toLowerCase().includes(q);
          const matchNote = o.note?.toLowerCase().includes(q);
          const matchItems = o.items?.some((it) => {
            const pName = it.variant?.product?.name || '';
            const vName = it.variant?.variant_name || '';
            return pName.toLowerCase().includes(q) || vName.toLowerCase().includes(q);
          });

          if (!matchCode && !matchCashier && !matchNote && !matchItems) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const discA = (a.discount_amount || 0) + (a.promotion_discount || 0) + (a.platform_fee_discount || 0);
        const discB = (b.discount_amount || 0) + (b.promotion_discount || 0) + (b.platform_fee_discount || 0);

        if (sortBy === 'discount_desc') {
          return discB - discA;
        }
        if (sortBy === 'subtotal_desc') {
          return (b.subtotal || 0) - (a.subtotal || 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [orders, selectedDiscountRange, selectedCashier, searchQuery, sortBy]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Helper to format item list summary
  const getItemsSummary = (items?: DiscountedOrderItem[]) => {
    if (!items || items.length === 0) return '—';
    return items
      .map((it) => {
        const pName = it.variant?.product?.name || 'Món';
        const vName = it.variant?.variant_name && it.variant.variant_name !== 'Default' ? ` (${it.variant.variant_name})` : '';
        return `${pName}${vName} x${it.quantity}`;
      })
      .join(', ');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'Mã đơn hàng',
      'Thời gian',
      'Thu ngân',
      'Chi tiết món',
      'Tổng niêm yết (VNĐ)',
      'Giảm giá trực tiếp (VNĐ)',
      'Khuyến mãi (VNĐ)',
      'Tổng giảm (VNĐ)',
      'Khách thực trả (VNĐ)',
      'Quỹ nhận',
      'Ghi chú',
    ];

    const rows = filteredOrders.map((o) => {
      const totalDisc = (o.discount_amount || 0) + (o.promotion_discount || 0) + (o.platform_fee_discount || 0);
      return [
        `"${o.order_code}"`,
        `"${formatDateTime(o.created_at)}"`,
        `"${o.cashier_name || o.created_by || ''}"`,
        `"${getItemsSummary(o.items).replace(/"/g, '""')}"`,
        o.subtotal || 0,
        o.discount_amount || 0,
        o.promotion_discount || 0,
        totalDisc,
        o.total_amount || 0,
        `"${o.fund?.name || ''}"`,
        `"${(o.note || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_don_giam_gia_${from || 'ky'}_${to || ''}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                Chi Tiết Đơn Hàng Giảm Giá & Khuyến Mãi
              </h3>
              <span className="px-2 py-0.5 rounded-full text-caption font-extrabold bg-rose-50 text-rose-700 border border-rose-200 font-num">
                {totalSummary.totalOrdersCount} đơn
              </span>
            </div>
            <p className="text-caption text-slate-400">
              Kỳ phân tích: <span className="font-semibold text-slate-600 font-num">{from}</span> đến{' '}
              <span className="font-semibold text-slate-600 font-num">{to}</span>
              {periodName && ` (${periodName})`}
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 3 Metric Cards on Top */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="surface-card border-card rounded-2xl p-3.5 flex items-center gap-3 shadow-card">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-caption font-bold text-rose-800">Tổng Tiền Đã Giảm</span>
              <div className="text-lg font-black text-rose-600 font-num">
                -{formatCurrency(totalSummary.totalDiscountAmount, settings)}
              </div>
              <span className="text-caption text-rose-500 font-medium font-num">
                Chiếm {totalSummary.discountRate.toFixed(1)}% doanh số gộp
              </span>
            </div>
          </div>

          <div className="surface-card border-card rounded-2xl p-3.5 flex items-center gap-3 shadow-card">
            <div className="p-2.5 bg-purple-50 text-brand-purple rounded-xl border border-purple-200 shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-caption font-bold text-brand-purple">Số Lượng Đơn Được Giảm</span>
              <div className="text-lg font-black text-brand-purple font-num">
                {totalSummary.totalOrdersCount}{' '}
                <span className="text-xs font-semibold text-purple-500 font-num">
                  / {totalCompletedOrders || totalSummary.totalOrdersCount} đơn
                </span>
              </div>
              <span className="text-caption text-slate-500 font-medium font-num">
                Tỷ lệ đơn áp dụng:{' '}
                {totalCompletedOrders > 0
                  ? ((totalSummary.totalOrdersCount / totalCompletedOrders) * 100).toFixed(1)
                  : '100'}
                %
              </span>
            </div>
          </div>

          <div className="surface-card border-card rounded-2xl p-3.5 flex items-center gap-3 shadow-card">
            <div className="p-2.5 bg-purple-50 text-brand-purple rounded-xl border border-purple-200 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-caption font-bold text-brand-purple">Mức Giảm Trung Bình</span>
              <div className="text-lg font-black text-brand-purple font-num">
                {formatCurrency(totalSummary.avgDiscount, settings)}{' '}
                <span className="text-xs font-semibold text-purple-500">/ đơn</span>
              </div>
              <span className="text-caption text-purple-700 font-medium">
                Tương đương ~1 ly nước ưu đãi
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <FilterBar
          searchValue={searchQuery}
          onSearchChange={(val) => {
            setSearchQuery(val);
            setCurrentPage(1);
          }}
          searchPlaceholder="Tìm mã đơn, thu ngân, tên món, ghi chú..."
          activeFiltersCount={(selectedCashier !== 'all' ? 1 : 0) + (selectedDiscountRange !== 'all' ? 1 : 0) + (sortBy !== 'discount_desc' ? 1 : 0)}
          sheetTitle="Bộ Lọc Đơn Giảm Giá"
          onReset={() => {
            setSelectedCashier('all');
            setSelectedDiscountRange('all');
            setSortBy('discount_desc');
            setCurrentPage(1);
          }}
          filters={
            <div className="flex flex-col md:flex-row md:items-center gap-2.5 w-full md:w-auto">
              <div className="w-full md:w-40">
                <label className="text-caption font-bold text-slate-500 uppercase block mb-1 md:hidden">
                  Thu ngân
                </label>
                <ModernSelect
                  value={selectedCashier}
                  onChange={(val) => {
                    setSelectedCashier(val);
                    setCurrentPage(1);
                  }}
                  options={cashierOptions}
                  size="sm"
                />
              </div>

              <div className="w-full md:w-36">
                <label className="text-caption font-bold text-slate-500 uppercase block mb-1 md:hidden">
                  Mức giảm
                </label>
                <ModernSelect
                  value={selectedDiscountRange}
                  onChange={(val) => {
                    setSelectedDiscountRange(val);
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'Tất cả mức giảm' },
                    { value: 'under_30k', label: '< 30.000 đ' },
                    { value: '30k_50k', label: '30k - 50k' },
                    { value: '50k_100k', label: '50k - 100k' },
                    { value: 'over_100k', label: '> 100.000 đ' },
                  ]}
                  size="sm"
                />
              </div>

              <div className="w-full md:w-36">
                <label className="text-caption font-bold text-slate-500 uppercase block mb-1 md:hidden">
                  Sắp xếp
                </label>
                <ModernSelect
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  options={[
                    { value: 'discount_desc', label: 'Giảm nhiều nhất' },
                    { value: 'time_desc', label: 'Mới nhất' },
                    { value: 'subtotal_desc', label: 'Đơn lớn nhất' },
                  ]}
                  size="sm"
                />
              </div>
            </div>
          }
          actionsSlot={
            <button
              onClick={handleExportCSV}
              disabled={filteredOrders.length === 0}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full border border-border-hairline transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Xuất file CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Xuất CSV</span>
            </button>
          }
          chipsSlot={
            (selectedCashier !== 'all' || selectedDiscountRange !== 'all' || sortBy !== 'discount_desc') ? (
              <>
                {selectedCashier !== 'all' && (
                  <Chip
                    variant="brand"
                    onRemove={() => { setSelectedCashier('all'); setCurrentPage(1); }}
                  >
                    Thu ngân: {cashierOptions.find((c) => c.value === selectedCashier)?.label || selectedCashier}
                  </Chip>
                )}
                {selectedDiscountRange !== 'all' && (
                  <Chip
                    variant="brand"
                    onRemove={() => { setSelectedDiscountRange('all'); setCurrentPage(1); }}
                  >
                    Mức giảm: {selectedDiscountRange}
                  </Chip>
                )}
                {sortBy !== 'discount_desc' && (
                  <Chip
                    variant="default"
                    onRemove={() => setSortBy('discount_desc')}
                  >
                    Sắp xếp: {sortBy === 'time_desc' ? 'Mới nhất' : 'Đơn lớn nhất'}
                  </Chip>
                )}
              </>
            ) : undefined
          }
        />

        {/* Content Table / Cards */}
        <div className="flex-1 overflow-y-auto min-h-[300px] border border-card rounded-2xl surface-card shadow-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <p className="text-xs">Đang tải danh sách đơn hàng giảm giá...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-rose-500 space-y-2">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
              <Percent className="w-8 h-8 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold">Không tìm thấy đơn hàng giảm giá nào phù hợp</p>
              <p className="text-xs text-slate-400">Thử thay đổi từ khóa hoặc xóa bớt bộ lọc</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 font-bold border-b border-card sticky top-0 z-10">
                    <th className="py-3 px-3.5">Mã đơn & Thời gian</th>
                    <th className="py-3 px-3.5">Thu ngân</th>
                    <th className="py-3 px-3.5">Chi tiết món</th>
                    <th className="py-3 px-3.5 text-right">Tổng niêm yết</th>
                    <th className="py-3 px-3.5 text-right text-rose-600">Số tiền giảm</th>
                    <th className="py-3 px-3.5 text-right font-extrabold text-slate-900">Thực thu</th>
                    <th className="py-3 px-3.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((o) => {
                    const totalDisc =
                      (o.discount_amount || 0) + (o.promotion_discount || 0) + (o.platform_fee_discount || 0);
                    const cashier = o.cashier_name || o.created_by || '—';

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition">
                        {/* Order Code & Time */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-brand-purple font-num">{o.order_code}</div>
                          <div className="text-caption text-slate-400 mt-0.5 font-num">
                            {formatDateTime(o.created_at)}
                          </div>
                        </td>

                        {/* Cashier */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-border-hairline text-caption">
                            {cashier}
                          </span>
                        </td>

                        {/* Items */}
                        <td className="py-3 px-3.5 max-w-xs">
                          <div className="text-slate-800 font-medium line-clamp-2" title={getItemsSummary(o.items)}>
                            {getItemsSummary(o.items)}
                          </div>
                        </td>

                        {/* Subtotal (Gross) */}
                        <td className="py-3 px-3.5 text-right font-medium text-slate-600 whitespace-nowrap font-num">
                          {formatCurrency(o.subtotal, settings)}
                        </td>

                        {/* Discount */}
                        <td className="py-3 px-3.5 text-right font-bold text-rose-600 whitespace-nowrap font-num">
                          <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                            <span>-{formatCurrency(totalDisc, settings)}</span>
                          </div>
                          {o.promotion_discount > 0 && (
                            <div className="text-caption text-brand-purple font-medium mt-0.5 font-num">
                              🎁 KM: -{formatCurrency(o.promotion_discount, settings)}
                            </div>
                          )}
                        </td>

                        {/* Net Paid */}
                        <td className="py-3 px-3.5 text-right font-black text-slate-900 whitespace-nowrap font-num">
                          <div className="text-brand-purple font-extrabold">
                            +{formatCurrency(o.total_amount, settings)}
                          </div>
                          <div className="text-caption text-slate-400 font-normal">
                            {o.fund?.name ? `(${o.fund.name})` : ''}
                          </div>
                        </td>

                        {/* Note */}
                        <td className="py-3 px-3.5 max-w-[160px]">
                          {o.note ? (
                            <span className="text-caption text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full italic block truncate" title={o.note}>
                              {o.note}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-card pt-2 text-xs text-slate-500">
          <div>
            Hiển thị <span className="font-bold text-slate-800 font-num">{filteredOrders.length}</span> đơn hàng có chiết khấu
          </div>
          {totalPages > 1 && (
            <div className="flex items-center space-x-1.5 font-num">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-full border border-border-hairline text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-semibold text-slate-700">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-full border border-border-hairline text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
