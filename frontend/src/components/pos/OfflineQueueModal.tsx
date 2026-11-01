'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  WifiOff,
  AlertCircle,
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
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { Badge, Button, ModalShell, SegmentedControl } from '@/components/ui';
import { cn } from '@/lib/cn';

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
  const { t } = useTranslation();
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
      toast.warning(t('pos.queue_offline_sync_warn'));
      return;
    }

    setIsSyncing(true);
    try {
      await syncOfflineOrders({
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
      toast.error(t('pos.queue_sync_error', { message: e.message || 'Unknown' }));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryOrder = async (order: OfflineOrder) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.warning(t('pos.queue_offline_short_warn'));
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
      title: t('pos.queue_cancel_confirm_title'),
      message: t('pos.queue_cancel_confirm_msg', {
        code: order.display_snapshot.order_code,
        amount: formatCurrency(order.display_snapshot.final_total, settings),
      }),
      type: 'danger',
      confirmText: t('pos.cancel_order_btn'),
      cancelText: t('pos.queue_keep_btn'),
    });

    if (ok) {
      try {
        await deleteOfflineOrder(order.offline_order_id);
        toast.info(t('pos.queue_cancelled_toast', { code: order.display_snapshot.order_code }));
        await loadQueueData();
      } catch {
        toast.error(t('pos.queue_delete_error'));
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
          <Badge variant="brand" size="sm" className="gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {t('pos.queue_status_synced')} {serverCode ? `(#${serverCode})` : ''}
            </span>
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="info" size="sm" className="gap-1 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>{t('pos.queue_status_syncing')}</span>
          </Badge>
        );
      case 'requires_review':
        return (
          <Badge variant="danger" size="sm" className="gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('pos.queue_status_review')}</span>
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="warning" size="sm" className="gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('pos.queue_status_failed')}</span>
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="neutral" size="sm" className="gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{t('pos.queue_status_pending')}</span>
          </Badge>
        );
    }
  };

  const pendingTotal = stats.pending + stats.syncing + stats.failed;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      icon={<WifiOff className="w-5 h-5 text-amber-700" />}
      title={t('pos.queue_modal_title')}
      description={t('pos.queue_modal_desc')}
      headerActions={
        <Button
          variant="primary"
          size="sm"
          onClick={handleSyncAll}
          isLoading={isSyncing}
          disabled={isSyncing || orders.length === 0}
          leftIcon={<RotateCw className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />}
        >
          {isSyncing ? t('pos.syncing') : t('pos.sync_now')}
        </Button>
      }
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-footnote text-slate-600 font-medium font-num">
            {t('pos.queue_pending_footer', { count: stats.pending + stats.requiresReview })}
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Segmented Control Tab Filters (0px blur, capsule geometry) */}
        <div className="overflow-x-auto no-scrollbar">
          <SegmentedControl
            fullWidth
            size="sm"
            aria-label={t('pos.queue_modal_title')}
            value={activeTab}
            onChange={(val) => setActiveTab(val as typeof activeTab)}
            options={[
              {
                value: 'all',
                label: t('pos.queue_tab_all'),
                badge: <span className="font-num text-caption opacity-80">({stats.total})</span>,
              },
              {
                value: 'pending',
                label: t('pos.queue_tab_pending'),
                badge: <span className="font-num text-caption opacity-80">({pendingTotal})</span>,
              },
              {
                value: 'review',
                label: t('pos.queue_tab_review'),
                badge: <span className="font-num text-caption opacity-80">({stats.requiresReview})</span>,
              },
              {
                value: 'synced',
                label: t('pos.queue_tab_synced'),
                badge: <span className="font-num text-caption opacity-80">({stats.synced})</span>,
              },
            ]}
          />
        </div>

        {/* Orders List Container */}
        <div className="space-y-3 min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-10 text-slate-500 text-footnote">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-600 mb-2" />
              <span>{t('pos.queue_loading')}</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-surface-card rounded-card border border-card shadow-card my-2">
              <CheckCircle2 className="w-9 h-9 text-brand-500 mb-2" />
              <p className="text-subhead font-semibold text-slate-800">{t('pos.queue_empty_title')}</p>
              <p className="text-footnote text-slate-500 mt-0.5">{t('pos.queue_empty_desc')}</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.offline_order_id}
                className="bg-surface-card p-3.5 sm:p-4 rounded-card border border-card shadow-card space-y-2.5"
              >
                {/* Order Row Top */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-num font-bold text-subhead text-slate-900">
                        #{order.display_snapshot.order_code}
                      </span>
                      {getStatusBadge(order.status, order.server_order_code)}
                    </div>
                    <p className="text-caption text-slate-500 mt-1">
                      {t('pos.queue_created_meta', {
                        time: new Date(order.queued_at).toLocaleTimeString('vi-VN'),
                        cashier: order.display_snapshot.cashier_name,
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-headline font-bold text-brand-700 font-num block">
                      {formatCurrency(order.display_snapshot.final_total, settings)}
                    </span>
                    <p className="text-caption text-slate-500 capitalize">
                      {order.display_snapshot.payment_method}
                    </p>
                  </div>
                </div>

                {/* Conflict / Error Message Alert */}
                {order.last_error && (
                  <div className="bg-rose-50 border border-rose-200/80 rounded-field p-2.5 text-caption text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">
                        {t('pos.queue_error_prefix', { code: order.error_code || 'ERROR' })}
                      </span>
                      <span>{order.last_error}</span>
                    </div>
                  </div>
                )}

                {/* Items preview */}
                <div className="bg-surface-grouped rounded-field p-2.5 text-footnote text-slate-700 space-y-1 border border-hairline">
                  {(order.display_snapshot.items || []).map((itm: any, idx: number) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="font-num font-medium">{itm.quantity}x</span>{' '}
                        {itm.product?.name || t('pos.item')} (
                        {itm.selectedVariant?.variant_name || t('pos.default_variant')})
                      </span>
                      <span className="font-semibold font-num shrink-0">
                        {formatCurrency(itm.lineTotal, settings)}
                      </span>
                    </div>
                  ))}
                  {order.display_snapshot.note && (
                    <div className="text-caption text-slate-500 italic pt-1 border-t border-hairline">
                      {t('pos.note', { note: order.display_snapshot.note })}
                    </div>
                  )}
                </div>

                {/* Actions per card */}
                <div className="flex items-center justify-end gap-2 pt-0.5">
                  {order.status !== 'synced' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRetryOrder(order)}
                      leftIcon={<RotateCw className="w-3.5 h-3.5" />}
                    >
                      {t('pos.retry_btn')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOrder(order)}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-rose-700 hover:bg-rose-50 border-rose-200/70"
                  >
                    {order.status === 'synced'
                      ? t('pos.remove_from_list')
                      : t('pos.cancel_order_btn')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ModalShell>
  );
}
