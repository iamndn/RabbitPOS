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
  Search,
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

  // String buffers for inputs to allow smooth editing and typing without jumping
  const [inputBuffers, setInputBuffers] = useState({
    best_seller_top_n: '5',
    best_seller_min_qty: '10',
    new_product_days: '14',
    high_profit_margin_min: '60',
    high_profit_min_qty: '5',
  });

  // Preview Result
  const [previewResult, setPreviewResult] = useState<AutoTaggingResult | null>(null);

  // Sync buffers whenever config loads
  const syncBuffersFromConfig = (cfg: AutoTaggingConfig) => {
    setInputBuffers({
      best_seller_top_n: String(cfg.best_seller_top_n ?? 5),
      best_seller_min_qty: String(cfg.best_seller_min_qty ?? 10),
      new_product_days: String(cfg.new_product_days ?? 14),
      high_profit_margin_min: String(cfg.high_profit_margin_min ?? 60),
      high_profit_min_qty: String(cfg.high_profit_min_qty ?? 5),
    });
  };

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
        syncBuffersFromConfig(configRes.data);
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

  const handleBufferChange = (field: keyof typeof inputBuffers, rawVal: string) => {
    setInputBuffers((prev) => ({ ...prev, [field]: rawVal }));
    const num = Number(rawVal);
    if (!isNaN(num) && rawVal.trim() !== '') {
      setConfig((prev) => ({ ...prev, [field]: num }));
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-5xl 2xl:max-w-6xl 3xl:max-w-7xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[92vh] pb-safe">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-transparent shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Tự Động Gán Nhãn Sản Phẩm
                </h2>
                <span className="text-[10px] sm:text-xs px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-700 font-bold border border-indigo-200">
                  Auto-Tag
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Tự động phân hạng Best Seller, Món mới, Lợi nhuận cao từ dữ liệu thực tế
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Config Panel Accordion */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <button
                type="button"
                onClick={() => setShowConfigPanel(!showConfigPanel)}
                className="flex items-center gap-2 text-sm font-bold text-slate-800 hover:text-indigo-600 transition cursor-pointer"
              >
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span>Quy Tắc &amp; Ngưỡng Đánh Giá Tự Động</span>
                {showConfigPanel ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Perfectly Aligned Modern Toggle Switch */}
              <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.enabled}
                  onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    config.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      config.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-bold text-slate-700 select-none">
                  {config.enabled ? '🟢 Tự động chạy 22:30' : '⚪ Tắt chạy tự động'}
                </span>
              </div>
            </div>

            {showConfigPanel && (
              <div className="pt-4 border-t border-slate-200 space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Time Window */}
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Cửa sổ phân tích
                    </label>
                    <div className="flex items-center gap-1 pt-1">
                      {[7, 14, 30].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setConfig({ ...config, time_window_days: days })}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                            config.time_window_days === days
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                          }`}
                        >
                          {days} ngày
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Best Seller Rule */}
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" />
                      Top Bán Chạy (Best Seller)
                    </label>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block mb-1">Top số lượng:</span>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={inputBuffers.best_seller_top_n}
                          onChange={(e) => handleBufferChange('best_seller_top_n', e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block mb-1">Tối thiểu (ly):</span>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={inputBuffers.best_seller_min_qty}
                          onChange={(e) => handleBufferChange('best_seller_min_qty', e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* New Product Rule */}
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Món Mới Ra Mắt (New)
                    </label>
                    <div className="pt-0.5">
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">Tạo trong vòng:</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          max="90"
                          value={inputBuffers.new_product_days}
                          onChange={(e) => handleBufferChange('new_product_days', e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                        <span className="text-xs font-semibold text-slate-600 shrink-0">ngày</span>
                      </div>
                    </div>
                  </div>

                  {/* High Profit Rule */}
                  <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <label className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" />
                      Lợi Nhuận Cao (Featured)
                    </label>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block mb-1">Biên LN tối thiểu:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="10"
                            max="95"
                            value={inputBuffers.high_profit_margin_min}
                            onChange={(e) => handleBufferChange('high_profit_margin_min', e.target.value)}
                            className="w-full text-xs font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                          <span className="text-xs font-bold text-slate-500">%</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-slate-500 block mb-1">Tối thiểu (ly):</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={inputBuffers.high_profit_min_qty}
                          onChange={(e) => handleBufferChange('high_profit_min_qty', e.target.value)}
                          className="w-full text-xs font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority & Action Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.prioritize_best_seller_over_new}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          prioritize_best_seller_over_new: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
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
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${evaluating ? 'animate-spin' : ''}`} />
                      <span>{evaluating ? 'Đang tính...' : 'Tính thử lại'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm cursor-pointer"
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
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] text-slate-500 font-semibold block">Tổng số món</span>
              <p className="text-xl font-black text-slate-900 mt-0.5">
                {previewResult?.total_products || 0} món
              </p>
            </div>
            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs">
              <span className="text-[11px] text-amber-800 font-semibold block">Sẽ đổi nhãn</span>
              <p className="text-xl font-black text-amber-600 mt-0.5">
                {previewResult?.changed_products_count || 0} món
              </p>
            </div>
            <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-200/80 shadow-2xs">
              <span className="text-[11px] text-indigo-800 font-semibold block">Đã khóa thủ công</span>
              <p className="text-xl font-black text-indigo-600 mt-0.5">
                {evaluations.filter((e) => e.tag_locked).length} món
              </p>
            </div>
            <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
              <span className="text-[11px] text-emerald-800 font-semibold block">Khung thời gian</span>
              <p className="text-base font-black text-emerald-700 mt-1 truncate">
                {config.time_window_days} ngày qua
              </p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm tên món, danh mục, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => setFilterChangedOnly(!filterChangedOnly)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  filterChangedOnly
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {filterChangedOnly ? '⚡ Chỉ hiện món sẽ đổi nhãn' : 'Tất cả món'}
              </button>
              <span className="text-xs text-slate-500 font-bold">
                {filteredEvaluations.length} kết quả
              </span>
            </div>
          </div>

          {/* Preview Container: Mobile Cards & Desktop Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
              Kết quả mô phỏng đánh giá ({filteredEvaluations.length} món)
            </h4>

            {loading ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                <p className="text-xs font-semibold">Đang phân tích dữ liệu bán hàng...</p>
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                <p className="text-xs font-semibold">Không tìm thấy sản phẩm phù hợp bộ lọc</p>
              </div>
            ) : (
              <>
                {/* 1. Mobile Card List (sm:hidden) */}
                <div className="block sm:hidden space-y-2.5">
                  {filteredEvaluations.map((ev) => {
                    const currentBadge = getTagBadgeStyle(ev.current_tag, customTags);
                    const suggestedBadge = getTagBadgeStyle(ev.suggested_tag, customTags);

                    return (
                      <div
                        key={ev.product_id}
                        className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                          ev.will_change
                            ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        {/* Top Product Row + Lock Button */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ev.image_url ? (
                              <img
                                src={ev.image_url}
                                alt={ev.product_name}
                                className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black shrink-0 border border-slate-200">
                                {ev.product_name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate">
                                {ev.product_name}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {ev.category_name} • Mới {ev.days_since_created}N
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleLock(ev.product_id, ev.tag_locked)}
                            title={ev.tag_locked ? 'Đang khóa nhãn' : 'Bấm để khóa'}
                            className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                              ev.tag_locked
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                            }`}
                          >
                            {ev.tag_locked ? (
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Tag Comparison Row */}
                        <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200/80 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-slate-400 font-semibold">Hiện tại:</span>
                            {ev.current_tag !== 'none' ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border truncate ${currentBadge.badgeClasses}`}
                              >
                                <span>{currentBadge.icon}</span>
                                <span className="truncate">{currentBadge.name}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Không có</span>
                            )}
                          </div>

                          <span className="text-slate-300 font-bold shrink-0">➔</span>

                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-indigo-500 font-semibold">Đề xuất:</span>
                            {ev.suggested_tag !== 'none' ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border shadow-2xs truncate ${suggestedBadge.badgeClasses}`}
                              >
                                <span>{suggestedBadge.icon}</span>
                                <span className="truncate">{suggestedBadge.name}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Gỡ nhãn</span>
                            )}
                          </div>
                        </div>

                        {/* Metrics: Sales & Margin */}
                        <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                          <div>
                            Doanh số: <strong className="text-slate-900">{ev.total_qty} ly</strong>
                            {ev.sales_rank > 0 && (
                              <span className="text-indigo-600 font-bold ml-1">#{ev.sales_rank}</span>
                            )}
                          </div>
                          <div>
                            Biên LN: <strong className={ev.margin_percent >= 60 ? 'text-emerald-600' : 'text-slate-900'}>{ev.margin_percent}%</strong>
                          </div>
                        </div>

                        {/* Reason Note */}
                        <div
                          className={`text-[11px] px-2.5 py-1.5 rounded-xl ${
                            ev.will_change
                              ? 'bg-amber-100/70 text-amber-900 font-semibold'
                              : ev.tag_locked
                              ? 'bg-indigo-50 text-indigo-800'
                              : 'bg-slate-50 text-slate-500'
                          }`}
                        >
                          {ev.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Desktop Table (hidden sm:block) */}
                <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-100 text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="px-3.5 py-3">Sản Phẩm</th>
                          <th className="px-3 py-3 text-center">Doanh Số ({config.time_window_days}N)</th>
                          <th className="px-3 py-3 text-right">Lợi Nhuận &amp; % Biên</th>
                          <th className="px-3 py-3 text-center">Nhãn Hiện Tại</th>
                          <th className="px-3 py-3 text-center">Nhãn Đề Xuất</th>
                          <th className="px-3.5 py-3">Lý Do Đánh Giá</th>
                          <th className="px-3 py-3 text-center">Khóa Nhãn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredEvaluations.map((ev) => {
                          const currentBadge = getTagBadgeStyle(ev.current_tag, customTags);
                          const suggestedBadge = getTagBadgeStyle(ev.suggested_tag, customTags);

                          return (
                            <tr
                              key={ev.product_id}
                              className={`hover:bg-slate-50 transition ${
                                ev.will_change ? 'bg-amber-50/60' : ''
                              }`}
                            >
                              {/* Product Info */}
                              <td className="px-3.5 py-3">
                                <div className="flex items-center gap-2.5">
                                  {ev.image_url ? (
                                    <img
                                      src={ev.image_url}
                                      alt={ev.product_name}
                                      className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-black shrink-0 border border-slate-200">
                                      {ev.product_name.charAt(0)}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 truncate">
                                      {ev.product_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {ev.category_name} • Mới {ev.days_since_created} ngày
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Sales Volume & Rank */}
                              <td className="px-3 py-3 text-center">
                                <div className="font-black text-slate-900 text-xs">
                                  {ev.total_qty} ly
                                </div>
                                {ev.total_qty > 0 ? (
                                  <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded-full inline-block mt-0.5 border border-indigo-200/60">
                                    Hạng #{ev.sales_rank}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-400">Chưa bán</div>
                                )}
                              </td>

                              {/* Profit & Margin */}
                              <td className="px-3 py-3 text-right">
                                <div className="font-black text-slate-900 text-xs">
                                  {new Intl.NumberFormat('vi-VN', {
                                    style: 'currency',
                                    currency: 'VND',
                                  }).format(ev.total_profit)}
                                </div>
                                <div
                                  className={`text-[10px] font-bold mt-0.5 ${
                                    ev.margin_percent >= 60
                                      ? 'text-emerald-600'
                                      : ev.margin_percent >= 40
                                      ? 'text-amber-600'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  Biên LN: {ev.margin_percent}%
                                </div>
                              </td>

                              {/* Current Tag */}
                              <td className="px-3 py-3 text-center">
                                {ev.current_tag !== 'none' ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${currentBadge.badgeClasses}`}
                                  >
                                    <span>{currentBadge.icon}</span>
                                    <span>{currentBadge.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Không</span>
                                )}
                              </td>

                              {/* Suggested Tag */}
                              <td className="px-3 py-3 text-center">
                                {ev.suggested_tag !== 'none' ? (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs ${suggestedBadge.badgeClasses}`}
                                  >
                                    <span>{suggestedBadge.icon}</span>
                                    <span>{suggestedBadge.name}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Không</span>
                                )}
                              </td>

                              {/* Reason */}
                              <td className="px-3.5 py-3">
                                <div
                                  className={`text-[11px] font-medium leading-snug ${
                                    ev.will_change
                                      ? 'text-amber-800 font-bold'
                                      : ev.tag_locked
                                      ? 'text-indigo-700 font-semibold'
                                      : 'text-slate-600'
                                  }`}
                                >
                                  {ev.reason}
                                </div>
                              </td>

                              {/* Lock Button */}
                              <td className="px-3 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleLock(ev.product_id, ev.tag_locked)}
                                  title={
                                    ev.tag_locked
                                      ? 'Đang khóa nhãn thủ công (bấm để mở khóa)'
                                      : 'Bấm để khóa cố định nhãn này'
                                  }
                                  className={`p-1.5 rounded-xl border transition cursor-pointer ${
                                    ev.tag_locked
                                      ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-2xs'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {ev.tag_locked ? (
                                    <Lock className="w-4 h-4 text-amber-600" />
                                  ) : (
                                    <Unlock className="w-4 h-4" />
                                  )}
                                </button>
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
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:px-5 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-1.5 text-center sm:text-left">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Món có biểu tượng 🔒 Khóa sẽ không bị ghi đè tự động.</span>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200 text-center justify-center flex items-center"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={applying || (previewResult?.changed_products_count || 0) === 0}
              className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 text-xs font-bold bg-gradient-to-r from-amber-500 to-indigo-600 text-white hover:from-amber-600 hover:to-indigo-700 rounded-xl shadow-md shadow-indigo-500/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
            >
              <Sparkles className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
              <span className="truncate">
                {applying
                  ? 'Đang áp dụng...'
                  : `Áp Dụng (${previewResult?.changed_products_count || 0})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
