'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Wifi,
  WifiOff,
  AlertCircle,
  Play,
  RotateCw,
} from 'lucide-react';
import {
  OfflineOrder,
  OfflineOrderStatus,
  getOfflineOrders,
  updateOfflineOrderStatus,
  deleteOfflineOrder,
  getOfflineQueueStats,
  OfflineQueueStats,
} from '@/lib/offline/orders';
import { syncOfflineOrders } from '@/lib/offline/sync';
import { formatCurrency, SettingsMap } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: SettingsMap | null;
  onSyncCompleted?: () => void;
}

export default function OfflineQueueModal({
  isOpen,
  onClose,
  settings,
  onSyncCompleted,
}: OfflineQueueModalProps) {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [orders, setOrders] = useState<OfflineOrder[]>([]);
  const [stats, setStats] = useState<OfflineQueueStats>({
    total: 0,
    pending: 0,
    syncing: 0,
    requiresReview: 0,
    synced: 0,
    failed: 0,
  });
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'review' | 'synced'>('all');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const loadQueueData = useCallback(async () => {
    try {
      const [allOrders, currentStats] = await Promise.all([
        getOfflineOrders(),
        getOfflineQueueStats(),
      ]);
      setOrders(allOrders);
      setStats(currentStats);
    } catch (e) {
      console.error('Failed to load offline queue data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadQueueData();
    }
  }, [isOpen, loadQueueData]);

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.warning('Thiết bị đang ngoại tuyến. Vui lòng kết nối Internet để đồng bộ.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncOfflineOrders({
        force: true,
        onSuccessToast: (count) => {
          toast.syncSuccess(count);
        },
        onConflictToast: (code, reason) => {
          toast.syncConflict(code, reason);
        },
      });

      await loadQueueData();
      if (onSyncCompleted) {
        onSyncCompleted();
      }
    } catch (e: any) {
      toast.error('Lỗi trong quá trình đồng bộ: ' + (e.message || 'Unknown'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryOrder = async (order: OfflineOrder) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.warning('Thiết bị đang ngoại tuyến.');
      return;
    }

    await updateOfflineOrderStatus(order.offline_order_id, {
      status: 'pending',
      last_error: null,
    });
    handleSyncAll();
  };

  const handleDeleteOrder = async (order: OfflineOrder) => {
    const ok = await confirm({
      title: 'Hủy đơn hàng ngoại tuyến',
      message: `Bạn có chắc chắn muốn hủy đơn hàng ${order.display_snapshot.order_code} (${formatCurrency(order.display_snapshot.final_total, settings)})? Dữ liệu đơn này sẽ bị xóa khỏi bộ nhớ thiết bị.`,
      type: 'danger',
      confirmText: 'Hủy đơn',
      cancelText: 'Giữ lại',
    });

    if (ok) {
      try {
        await deleteOfflineOrder(order.offline_order_id);
        toast.info(`Đã hủy đơn ${order.display_snapshot.order_code}`);
        await loadQueueData();
      } catch (e) {
        toast.error('Không thể xóa đơn hàng');
      }
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'pending') return o.status === 'pending' || o.status === 'syncing' || o.status === 'failed';
    if (activeTab === 'review') return o.status === 'requires_review';
    if (activeTab === 'synced') return o.status === 'synced';
    return true;
  });

  const getStatusBadge = (status: OfflineOrderStatus, serverCode?: string | null) => {
    switch (status) {
      case 'synced':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã đồng bộ {serverCode ? `(#${serverCode})` : ''}
          </span>
        );
      case 'syncing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Đang gửi lên server...
          </span>
        );
      case 'requires_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            Cần xem xét (Xung đột)
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5" />
            Chờ thử lại
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3.5 h-3.5" />
            Chờ đồng bộ
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] flex flex-col hardware-accelerated">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 font-bold">
              ⚡
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">Hàng Đợi Đơn Ngoại Tuyến</h2>
              <p className="text-[11px] text-slate-500">Tự động đồng bộ tuần tự (FIFO) khi có mạng</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing || orders.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tất cả ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'pending' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chờ đồng bộ ({stats.pending + stats.syncing + stats.failed})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'review' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Xung đột ({stats.requiresReview})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('synced')}
            className={`flex-1 py-1.5 rounded-lg transition ${
              activeTab === 'synced' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Đã xong ({stats.synced})
          </button>
        </div>

        {/* Orders List Container */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span>Đang tải danh sách hàng đợi...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 my-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
              <p className="text-xs font-bold text-slate-700">Hàng đợi trống</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Không có đơn hàng nào cần xử lý trong mục này.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.offline_order_id}
                className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition space-y-2.5"
              >
                {/* Order Row Top */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-slate-900">
                        #{order.display_snapshot.order_code}
                      </span>
                      {getStatusBadge(order.status, order.server_order_code)}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Tạo lúc: {new Date(order.queued_at).toLocaleTimeString('vi-VN')} · Thu ngân:{' '}
                      {order.display_snapshot.cashier_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-emerald-700">
                      {formatCurrency(order.display_snapshot.final_total, settings)}
                    </span>
                    <p className="text-[10px] text-slate-400 uppercase">
                      {order.display_snapshot.payment_method}
                    </p>
                  </div>
                </div>

                {/* Conflict / Error Message Alert */}
                {order.last_error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-[11px] text-rose-800 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Lỗi đồng bộ ({order.error_code || 'ERROR'}): </span>
                      <span>{order.last_error}</span>
                    </div>
                  </div>
                )}

                {/* Items preview */}
                <div className="bg-slate-50 rounded-lg p-2 text-[11px] text-slate-600 space-y-1 border border-slate-100">
                  {(order.display_snapshot.items || []).map((itm: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[260px]">
                        {itm.quantity}x {itm.product?.name || 'Món'} (
                        {itm.selectedVariant?.variant_name || 'Size'})
                      </span>
                      <span className="font-semibold">{formatCurrency(itm.lineTotal, settings)}</span>
                    </div>
                  ))}
                  {order.display_snapshot.note && (
                    <div className="text-[10px] text-slate-500 italic pt-0.5 border-t border-slate-200">
                      Ghi chú: {order.display_snapshot.note}
                    </div>
                  )}
                </div>

                {/* Actions per card */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {order.status !== 'synced' && (
                    <button
                      type="button"
                      onClick={() => handleRetryOrder(order)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Thử lại</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteOrder(order)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{order.status === 'synced' ? 'Xóa khỏi danh sách' : 'Hủy đơn'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>{stats.pending + stats.requiresReview} đơn chưa hoàn tất</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
