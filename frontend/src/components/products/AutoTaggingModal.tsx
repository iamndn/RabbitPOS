'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Flame,
  Star,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  RefreshCw,
  Sliders,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useConfirm } from '@/context/ConfirmContext';
import { CustomTag, getTagBadgeStyle } from './TagManagerModal';

interface AutoTaggingConfig {
  enabled: boolean;
  time_window_days: number;
  best_seller_top_n: number;
  best_seller_min_qty: number;
  new_product_days: number;
  high_profit_margin_min: number;
  high_profit_min_qty: number;
  prioritize_best_seller_over_new: boolean;
}

interface ProductEvaluation {
  product_id: number;
  product_name: string;
  category_name: string;
  image_url: string;
  total_qty: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_percent: number;
  sales_rank: number;
  days_since_created: number;
  is_active: boolean;
  current_tag: string;
  suggested_tag: string;
  tag_locked: boolean;
  will_change: boolean;
  reason: string;
}

interface AutoTaggingResult {
  config: AutoTaggingConfig;
  evaluated_at: string;
  time_window_start: string;
  time_window_end: string;
  total_products: number;
  changed_products_count: number;
  evaluations: ProductEvaluation[];
}

interface AutoTaggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  customTags?: CustomTag[];
  onTagsUpdated?: () => void;
}

export default function AutoTaggingModal({
  isOpen,
  onClose,
  customTags = [],
  onTagsUpdated,
}: AutoTaggingModalProps) {
  const { confirm, showAlert } = useConfirm();

  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(true);

  // Filter & Search state in preview table
  const [filterChangedOnly, setFilterChangedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Config State
  const [config, setConfig] = useState<AutoTaggingConfig>({
    enabled: false,
    time_window_days: 14,
    best_seller_top_n: 5,
    best_seller_min_qty: 10,
    new_product_days: 14,
    high_profit_margin_min: 60.0,
    high_profit_min_qty: 5,
    prioritize_best_seller_over_new: true,
  });

  // Preview Result
  const [previewResult, setPreviewResult] = useState<AutoTaggingResult | null>(null);

  // Load config and initial preview on open
  useEffect(() => {
    if (isOpen) {
      loadConfigAndPreview();
    }
  }, [isOpen]);

  const loadConfigAndPreview = async () => {
    setLoading(true);
    try {
      // 1. Fetch Config
      const configRes = await fetchApi<AutoTaggingConfig>('/products/auto-tag/config');
      if (configRes.status === 'success' && configRes.data) {
        setConfig(configRes.data);
      }

      // 2. Fetch Preview
      const previewRes = await fetchApi<AutoTaggingResult>('/products/auto-tag/preview', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (previewRes.status === 'success' && previewRes.data) {
        setPreviewResult(previewRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load auto-tagging data:', err);
      showAlert('Lỗi', 'Không thể tải cấu hình tự động gán nhãn', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await fetchApi<AutoTaggingResult>('/products/auto-tag/preview', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (res.status === 'success' && res.data) {
        setPreviewResult(res.data);
        showAlert('Thành công', 'Đã tính toán xong mô phỏng gán nhãn mới!', 'success');
      }
    } catch (err: any) {
      console.error('Evaluation failed:', err);
      showAlert('Lỗi', 'Không thể mô phỏng đánh giá nhãn', 'danger');
    } finally {
      setEvaluating(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetchApi('/products/auto-tag/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      if (res.status === 'success') {
        showAlert('Thành công', 'Đã lưu cấu hình quy tắc tự động gán nhãn!', 'success');
        handleRunEvaluation();
      } else {
        showAlert('Lỗi', res.message || 'Không thể lưu cấu hình', 'danger');
      }
    } catch (err: any) {
      console.error('Failed to save config:', err);
      showAlert('Lỗi', 'Không thể lưu cấu hình', 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleLock = async (productID: number, currentLocked: boolean) => {
    try {
      const nextLocked = !currentLocked;
      await fetchApi('/products/auto-tag/toggle-lock', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productID,
          locked: nextLocked,
        }),
      });

      // Update local preview state
      if (previewResult) {
        const updatedEvaluations = previewResult.evaluations.map((ev) => {
          if (ev.product_id === productID) {
            return {
              ...ev,
              tag_locked: nextLocked,
              will_change: nextLocked ? false : ev.current_tag !== ev.suggested_tag,
              reason: nextLocked
                ? `[ĐÃ KHÓA THỦ CÔNG] Giữ nguyên nhãn '${ev.current_tag}'`
                : ev.reason.replace('[ĐÃ KHÓA THỦ CÔNG] ', ''),
            };
          }
          return ev;
        });

        const newChangedCount = updatedEvaluations.filter((e) => e.will_change).length;
        setPreviewResult({
          ...previewResult,
          changed_products_count: newChangedCount,
          evaluations: updatedEvaluations,
        });
      }

      if (onTagsUpdated) onTagsUpdated();
    } catch (err: any) {
      console.error('Failed to toggle lock:', err);
      showAlert('Lỗi', 'Lỗi khi khóa/mở khóa nhãn', 'danger');
    }
  };

  const handleApplyChanges = async () => {
    if (!previewResult || previewResult.changed_products_count === 0) {
      showAlert('Thông báo', 'Không có món nào cần thay đổi nhãn', 'info');
      return;
    }

    const ok = await confirm({
      title: 'Xác nhận áp dụng nhãn tự động',
      message: `Hệ thống sẽ cập nhật nhãn cho ${previewResult.changed_products_count} sản phẩm theo quy tắc hiện tại. Bạn có chắc chắn muốn thực hiện?`,
      type: 'warning',
      confirmText: '⚡ Áp dụng ngay',
      cancelText: 'Hủy bỏ',
    });

    if (!ok) return;

    setApplying(true);
    try {
      const res = await fetchApi<AutoTaggingResult>('/products/auto-tag/apply', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.status === 'success' && res.data) {
        showAlert(
          'Thành công',
          `Đã cập nhật nhãn thành công cho ${res.data.changed_products_count} sản phẩm!`,
          'success'
        );
        if (onTagsUpdated) onTagsUpdated();
        loadConfigAndPreview();
      } else {
        showAlert('Lỗi', res.message || 'Lỗi khi áp dụng nhãn tự động', 'danger');
      }
    } catch (err: any) {
      console.error('Failed to apply tags:', err);
      showAlert('Lỗi', 'Lỗi khi áp dụng nhãn tự động', 'danger');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  // Filter preview items
  const evaluations = previewResult?.evaluations || [];
  const filteredEvaluations = evaluations.filter((ev) => {
    if (filterChangedOnly && !ev.will_change) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        ev.product_name.toLowerCase().includes(q) ||
        ev.category_name.toLowerCase().includes(q) ||
        ev.reason.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Tự Động Gán Nhãn Sản Phẩm
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
                  Auto-Tagging Engine
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động phân hạng &amp; gắn nhãn Best Seller, Món mới, Lợi nhuận cao dựa trên dữ liệu kinh doanh thực tế
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Config Panel Accordion */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition"
              >
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span>Quy Tắc &amp; Ngưỡng Đánh Giá Tự Động</span>
                {showConfigPanel ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="ml-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {config.enabled ? '🟢 Tự động chạy 22:30' : '⚪ Tắt chạy tự động'}
                  </span>
                </label>
              </div>
            </div>

            {showConfigPanel && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Time Window */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Cửa sổ phân tích
                    </label>
                    <div className="flex items-center gap-1">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setConfig({ ...config, time_window_days: days })}
                          className={`flex-1 py-1 text-xs font-bold rounded ${
                            config.time_window_days === days
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >
                          {days} ngày
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Best Seller Rule */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      Top Bán Chạy (Best Seller)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] text-slate-400">Top số lượng:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={config.best_seller_top_n}
                          onChange={(e) =>
                            setConfig({ ...config, best_seller_top_n: Number(e.target.value) || 5 })
                          }
                          className="w-full text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Tối thiểu (ly):</span>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={config.best_seller_min_qty}
                          onChange={(e) =>
                            setConfig({ ...config, best_seller_min_qty: Number(e.target.value) || 10 })
                          }
                          className="w-full text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* New Product Rule */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Món Mới Ra Mắt (New)
                    </label>
                    <div>
                      <span className="text-[10px] text-slate-400">Tạo trong vòng:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={config.new_product_days}
                          onChange={(e) =>
                            setConfig({ ...config, new_product_days: Number(e.target.value) || 14 })
                          }
                          className="w-full text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                        />
                        <span className="text-xs text-slate-500">ngày</span>
                      </div>
                    </div>
                  </div>

                  {/* High Profit Rule */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" />
                      Lợi Nhuận Cao (Featured)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <span className="text-[10px] text-slate-400">Biên LN tối thiểu:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="10"
                            max="90"
                            value={config.high_profit_margin_min}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                high_profit_margin_min: Number(e.target.value) || 60,
                              })
                            }
                            className="w-full text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Tối thiểu (ly):</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={config.high_profit_min_qty}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              high_profit_min_qty: Number(e.target.value) || 5,
                            })
                          }
                          className="w-full text-xs font-bold px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority & Action Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.prioritize_best_seller_over_new}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioritize_best_seller_over_new: e.target.checked,
                        })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      Ưu tiên nhãn <strong>🔥 Bán chạy</strong> hơn <strong>✨ Món mới</strong> khi thỏa mãn cả 2 tiêu chí
                    </span>
                  </label>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleRunEvaluation}
                      disabled={evaluating}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
                      <span>{evaluating ? 'Đang tính...' : 'Tính thử lại'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingConfig ? 'Đang lưu...' : 'Lưu quy tắc'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 font-medium">Tổng số món</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {previewResult?.total_products || 0} món
              </p>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Sẽ đổi nhãn</span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {previewResult?.changed_products_count || 0} món
              </p>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">Đã khóa thủ công</span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {evaluations.filter((e) => e.tag_locked).length} món
              </p>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">Khung thời gian</span>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 truncate">
                {config.time_window_days} ngày qua
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Tìm món, danh mục, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => setFilterChangedOnly(!filterChangedOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                  filterChangedOnly
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {filterChangedOnly ? '⚡ Chỉ hiện món sẽ đổi nhãn' : 'Tất cả món'}
              </button>
              <span className="text-xs text-slate-400 font-medium">
                {filteredEvaluations.length} kết quả
              </span>
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-3.5 py-2.5">Sản Phẩm</th>
                    <th className="px-3 py-2.5 text-center">Doanh Số ({config.time_window_days}N)</th>
                    <th className="px-3 py-2.5 text-right">Lợi Nhuận &amp; % Biên</th>
                    <th className="px-3 py-2.5 text-center">Nhãn Hiện Tại</th>
                    <th className="px-3 py-2.5 text-center">Nhãn Đề Xuất</th>
                    <th className="px-3.5 py-2.5">Lý Do Đánh Giá</th>
                    <th className="px-3 py-2.5 text-center">Khóa Nhãn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                        Đang phân tích dữ liệu bán hàng...
                      </td>
                    </tr>
                  ) : filteredEvaluations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Không tìm thấy sản phẩm phù hợp bộ lọc
                      </td>
                    </tr>
                  ) : (
                    filteredEvaluations.map((ev) => {
                      const currentBadge = getTagBadgeStyle(ev.current_tag, customTags);
                      const suggestedBadge = getTagBadgeStyle(ev.suggested_tag, customTags);

                      return (
                        <tr
                          key={ev.product_id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${
                            ev.will_change
                              ? 'bg-amber-500/5 dark:bg-amber-500/10'
                              : ''
                          }`}
                        >
                          {/* Product Info */}
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              {ev.image_url ? (
                                <img
                                  src={ev.image_url}
                                  alt={ev.product_name}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                                  {ev.product_name.charAt(0)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate">
                                  {ev.product_name}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {ev.category_name} • Mới {ev.days_since_created} ngày
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Sales Volume */}
                          <td className="px-3 py-2.5 text-center font-bold">
                            <div className="text-slate-900 dark:text-white">
                              {ev.total_qty} ly
                            </div>
                            {ev.total_qty > 0 && (
                              <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                                Hạng #{ev.sales_rank}
                              </span>
                            )}
                          </td>

                          {/* Profit & Margin */}
                          <td className="px-3 py-2.5 text-right font-medium">
                            <div className="text-slate-900 dark:text-white font-bold">
                              {ev.total_profit.toLocaleString()}đ
                            </div>
                            <div
                              className={`text-[10px] font-bold ${
                                ev.margin_percent >= 60
                                  ? 'text-emerald-500'
                                  : ev.margin_percent >= 40
                                  ? 'text-amber-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              Biên LN: {ev.margin_percent}%
                            </div>
                          </td>

                          {/* Current Tag */}
                          <td className="px-3 py-2.5 text-center">
                            {ev.current_tag !== 'none' ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${currentBadge.badgeClasses}`}
                              >
                                <span>{currentBadge.icon}</span>
                                <span>{currentBadge.name}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Không</span>
                            )}
                          </td>

                          {/* Suggested Tag */}
                          <td className="px-3 py-2.5 text-center">
                            {ev.suggested_tag !== 'none' ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${suggestedBadge.badgeClasses}`}
                              >
                                <span>{suggestedBadge.icon}</span>
                                <span>{suggestedBadge.name}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Không</span>
                            )}
                          </td>

                          {/* Reason */}
                          <td className="px-3.5 py-2.5">
                            <div
                              className={`text-[11px] font-medium leading-snug ${
                                ev.will_change
                                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {ev.reason}
                            </div>
                          </td>

                          {/* Lock Button */}
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleLock(ev.product_id, ev.tag_locked)}
                              title={
                                ev.tag_locked
                                  ? 'Đang khóa nhãn thủ công (bấm để mở khóa)'
                                  : 'Bấm để khóa cố định nhãn này'
                              }
                              className={`p-1.5 rounded-lg border transition ${
                                ev.tag_locked
                                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600 dark:hover:text-slate-200'
                              }`}
                            >
                              {ev.tag_locked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
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

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Món có biểu tượng 🔒 Khóa sẽ không bao giờ bị ghi đè tự động.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={applying || (previewResult?.changed_products_count || 0) === 0}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-gradient-to-r from-amber-500 to-indigo-600 text-white hover:from-amber-600 hover:to-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
              <span>
                {applying
                  ? 'Đang áp dụng...'
                  : `⚡ Áp Dụng Thay Đổi (${previewResult?.changed_products_count || 0} món)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
