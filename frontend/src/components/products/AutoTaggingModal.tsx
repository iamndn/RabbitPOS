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
import { ModalShell } from '@/components/ui/ModalShell';

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
    high_profit_margin_min: 60,
    high_profit_min_qty: 5,
    prioritize_best_seller_over_new: true,
  });

  // String buffers for numeric inputs to avoid mobile keyboard wiping out values
  const [inputBuffers, setInputBuffers] = useState({
    best_seller_top_n: '5',
    best_seller_min_qty: '10',
    new_product_days: '14',
    high_profit_margin_min: '60',
    high_profit_min_qty: '5',
  });

  const handleBufferChange = (field: keyof typeof inputBuffers, val: string) => {
    const numericStr = val.replace(/\D/g, '');
    setInputBuffers((prev) => ({ ...prev, [field]: numericStr }));
    const parsed = parseInt(numericStr, 10);
    if (!isNaN(parsed)) {
      setConfig((prev) => ({ ...prev, [field]: parsed }));
    }
  };

  // Preview Result State
  const [previewResult, setPreviewResult] = useState<AutoTaggingResult | null>(null);
  const [evaluations, setEvaluations] = useState<ProductEvaluation[]>([]);

  // Load config & initial evaluation when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfigAndRun();
    }
  }, [isOpen]);

  const loadConfigAndRun = async () => {
    setLoading(true);
    try {
      // 1. Load saved config
      const cfgRes = await fetchApi<AutoTaggingConfig>('/products/auto-tag/config');
      if (cfgRes.status === 'success' && cfgRes.data) {
        setConfig(cfgRes.data);
        setInputBuffers({
          best_seller_top_n: String(cfgRes.data.best_seller_top_n || 5),
          best_seller_min_qty: String(cfgRes.data.best_seller_min_qty || 10),
          new_product_days: String(cfgRes.data.new_product_days || 14),
          high_profit_margin_min: String(cfgRes.data.high_profit_margin_min || 60),
          high_profit_min_qty: String(cfgRes.data.high_profit_min_qty || 5),
        });
      }

      // 2. Run simulation evaluation with active/saved config
      const evalRes = await fetchApi<AutoTaggingResult>('/products/auto-tag/preview', {
        method: 'POST',
        body: JSON.stringify(cfgRes.data || config),
      });

      if (evalRes.status === 'success' && evalRes.data) {
        setPreviewResult(evalRes.data);
        setEvaluations(evalRes.data.evaluations || []);
      }
    } catch (err: any) {
      console.error('Failed to load auto-tagging config/evaluation', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const evalRes = await fetchApi<AutoTaggingResult>('/products/auto-tag/preview', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (evalRes.status === 'success' && evalRes.data) {
        setPreviewResult(evalRes.data);
        setEvaluations(evalRes.data.evaluations || []);
      } else {
        showAlert('Lỗi', evalRes.message || 'Mô phỏng đánh giá thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi kết nối khi đánh giá', 'danger');
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
        showAlert('Thành công', 'Đã lưu cấu hình tự động gán nhãn!', 'info');
      } else {
        showAlert('Lỗi', res.message || 'Không thể lưu cấu hình', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi khi lưu cấu hình', 'danger');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleLock = async (productID: number, currentLocked: boolean) => {
    try {
      const nextLocked = !currentLocked;
      const res = await fetchApi('/products/auto-tag/toggle-lock', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productID,
          locked: nextLocked,
        }),
      });
      if (res.status === 'success') {
        setEvaluations((prev) =>
          prev.map((e) =>
            e.product_id === productID
              ? {
                  ...e,
                  tag_locked: nextLocked,
                  will_change: nextLocked ? false : e.suggested_tag !== e.current_tag,
                  reason: nextLocked ? 'Đã khóa thủ công' : e.reason,
                }
              : e
          )
        );
        if (onTagsUpdated) onTagsUpdated();
      }
    } catch (err: any) {
      console.error('Failed to toggle tag lock', err);
    }
  };

  const handleApplyChanges = async () => {
    const willChangeCount = previewResult?.changed_products_count || 0;
    if (willChangeCount === 0) {
      showAlert('Thông báo', 'Không có sản phẩm nào cần đổi nhãn theo quy tắc hiện tại.', 'info');
      return;
    }

    const isConfirmed = await confirm({
      title: 'Xác nhận áp dụng nhãn tự động',
      message: `Hệ thống sẽ cập nhật nhãn cho ${willChangeCount} sản phẩm theo đề xuất. Các sản phẩm đã được khóa nhãn (🔒) sẽ được giữ nguyên. Bạn có muốn tiếp tục?`,
      type: 'warning',
      confirmText: 'Áp dụng ngay',
      cancelText: 'Hủy',
    });
    if (!isConfirmed) return;

    setApplying(true);
    try {
      const res = await fetchApi<AutoTaggingResult>('/products/auto-tag/apply', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      if (res.status === 'success') {
        showAlert('Thành công', `Đã cập nhật thành công ${res.data?.changed_products_count || 0} sản phẩm!`, 'info');
        if (onTagsUpdated) onTagsUpdated();
        onClose();
      } else {
        showAlert('Lỗi', res.message || 'Không thể áp dụng nhãn', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi khi áp dụng nhãn', 'danger');
    } finally {
      setApplying(false);
    }
  };

  if (!isOpen) return null;

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      preventClose={evaluating || applying || savingConfig}
      icon={<Sparkles className="w-5 h-5 text-amber-500" />}
      title={
        <div className="flex items-center gap-2">
          <span>Tự Động Gán Nhãn Sản Phẩm</span>
          <span className="bg-purple-100 text-purple-700 text-caption px-2 py-0.5 rounded-full font-bold border border-purple-200">
            Auto-Tag
          </span>
        </div>
      }
      description="Tự động phân hạng Best Seller, Món mới, Lợi nhuận cao từ dữ liệu thực tế"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="text-xs text-slate-600 flex items-center gap-1.5 text-center sm:text-left">
            <AlertCircle className="w-4 h-4 text-brand-purple shrink-0" />
            <span>Món có biểu tượng 🔒 Khóa sẽ không bị ghi đè tự động.</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-full transition cursor-pointer border border-slate-200 text-center justify-center flex items-center"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleApplyChanges}
              disabled={applying || (previewResult?.changed_products_count || 0) === 0}
              className="flex items-center justify-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-brand-purple hover:bg-purple-700 active:scale-95 text-white rounded-full shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center"
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
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Config Panel Accordion */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <button
              type="button"
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className="flex items-center gap-2 text-sm font-bold text-slate-800 hover:text-purple-700 transition cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-brand-purple" />
              <span>Quy Tắc &amp; Ngưỡng Đánh Giá Tự Động</span>
              {showConfigPanel ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Modern Toggle Switch */}
            <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm self-start sm:self-auto">
              <button
                type="button"
                role="switch"
                aria-checked={config.enabled}
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  config.enabled ? 'bg-brand-purple' : 'bg-slate-300'
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
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {/* Time Window */}
                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-brand-purple" />
                    Cửa sổ phân tích
                  </label>
                  <div className="flex items-center gap-1 pt-1">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setConfig({ ...config, time_window_days: days })}
                        className={`flex-1 py-1.5 text-xs font-num font-bold rounded-lg transition cursor-pointer ${
                          config.time_window_days === days
                            ? 'bg-brand-purple text-white shadow-sm'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {days} ngày
                      </button>
                    ))}
                  </div>
                </div>

                {/* Best Seller Rule */}
                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    Top Bán Chạy (Best Seller)
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <span className="text-caption font-medium text-slate-500 block mb-1">Top số lượng:</span>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={inputBuffers.best_seller_top_n}
                        onChange={(e) => handleBufferChange('best_seller_top_n', e.target.value)}
                        className="w-full text-xs font-num font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                      />
                    </div>
                    <div>
                      <span className="text-caption font-medium text-slate-500 block mb-1">Tối thiểu (ly):</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={inputBuffers.best_seller_min_qty}
                        onChange={(e) => handleBufferChange('best_seller_min_qty', e.target.value)}
                        className="w-full text-xs font-num font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* New Product Rule */}
                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-amber-600 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Món Mới Ra Mắt (New)
                  </label>
                  <div className="pt-0.5">
                    <span className="text-caption font-medium text-slate-500 block mb-1">Tạo trong vòng:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={inputBuffers.new_product_days}
                        onChange={(e) => handleBufferChange('new_product_days', e.target.value)}
                        className="w-full text-xs font-num font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                      />
                      <span className="text-xs font-semibold text-slate-600 shrink-0">ngày</span>
                    </div>
                  </div>
                </div>

                {/* High Profit Rule */}
                <div className="space-y-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-purple-600 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" />
                    Lợi Nhuận Cao (Featured)
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div>
                      <span className="text-caption font-medium text-slate-500 block mb-1">Biên LN tối thiểu:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="10"
                          max="95"
                          value={inputBuffers.high_profit_margin_min}
                          onChange={(e) => handleBufferChange('high_profit_margin_min', e.target.value)}
                          className="w-full text-xs font-num font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
                        />
                        <span className="text-xs font-bold text-slate-500">%</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-caption font-medium text-slate-500 block mb-1">Tối thiểu (ly):</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={inputBuffers.high_profit_min_qty}
                        onChange={(e) => handleBufferChange('high_profit_min_qty', e.target.value)}
                        className="w-full text-xs font-num font-bold px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
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
                    className="w-4 h-4 rounded border-slate-300 text-brand-purple focus:ring-purple-500 cursor-pointer"
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
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition shadow-sm cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-brand-purple ${evaluating ? 'animate-spin' : ''}`} />
                    <span>{evaluating ? 'Đang tính...' : 'Tính thử lại'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-brand-purple text-white hover:bg-purple-700 transition shadow-sm cursor-pointer"
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
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-caption text-slate-500 font-semibold block">Tổng số món</span>
            <p className="text-xl font-num font-black text-slate-900 mt-0.5">
              {previewResult?.total_products || 0} món
            </p>
          </div>
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200/80 shadow-sm">
            <span className="text-caption text-amber-800 font-semibold block">Sẽ đổi nhãn</span>
            <p className="text-xl font-num font-black text-amber-600 mt-0.5">
              {previewResult?.changed_products_count || 0} món
            </p>
          </div>
          <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200/80 shadow-sm">
            <span className="text-caption text-purple-800 font-semibold block">Đã khóa thủ công</span>
            <p className="text-xl font-num font-black text-purple-600 mt-0.5">
              {evaluations.filter((e) => e.tag_locked).length} món
            </p>
          </div>
          <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-200/80 shadow-sm">
            <span className="text-caption text-purple-800 font-semibold block">Khung thời gian</span>
            <p className="text-base font-num font-black text-purple-700 mt-1 truncate">
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
              className="w-full pl-9 pr-8 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
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
              className={`px-3.5 py-2 rounded-full text-xs font-bold transition border cursor-pointer ${
                filterChangedOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {filterChangedOnly ? '⚡ Chỉ hiện món sẽ đổi nhãn' : 'Tất cả món'}
            </button>
            <span className="text-xs text-slate-500 font-num font-bold">
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
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-purple" />
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
                          : 'bg-white border-slate-200 shadow-sm'
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
                            <div className="text-caption text-slate-500 truncate">
                              {ev.category_name} • Mới <span className="font-num">{ev.days_since_created}</span>N
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleLock(ev.product_id, ev.tag_locked)}
                          title={ev.tag_locked ? 'Đang khóa nhãn' : 'Bấm để khóa'}
                          className={`p-2 rounded-full border transition cursor-pointer shrink-0 ${
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
                          <span className="text-caption text-slate-400 font-semibold">Hiện tại:</span>
                          {ev.current_tag !== 'none' ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-extrabold border truncate ${currentBadge.badgeClasses}`}
                            >
                              <span>{currentBadge.icon}</span>
                              <span className="truncate">{currentBadge.name}</span>
                            </span>
                          ) : (
                            <span className="text-caption text-slate-400 italic">Không có</span>
                          )}
                        </div>

                        <span className="text-slate-300 font-bold shrink-0">➔</span>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-caption text-purple-700 font-semibold">Đề xuất:</span>
                          {ev.suggested_tag !== 'none' ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-extrabold border shadow-sm truncate ${suggestedBadge.badgeClasses}`}
                            >
                              <span>{suggestedBadge.icon}</span>
                              <span className="truncate">{suggestedBadge.name}</span>
                            </span>
                          ) : (
                            <span className="text-caption text-slate-400 italic">Gỡ nhãn</span>
                          )}
                        </div>
                      </div>

                      {/* Metrics: Sales & Margin */}
                      <div className="flex items-center justify-between text-caption text-slate-600 px-1">
                        <div>
                          Doanh số: <strong className="font-num text-slate-900">{ev.total_qty} ly</strong>
                          {ev.sales_rank > 0 && (
                            <span className="text-purple-700 font-num font-bold ml-1">#{ev.sales_rank}</span>
                          )}
                        </div>
                        <div>
                          Biên LN: <strong className={`font-num ${ev.margin_percent >= 60 ? 'text-purple-600' : 'text-slate-900'}`}>{ev.margin_percent}%</strong>
                        </div>
                      </div>

                      {/* Reason Note */}
                      <div
                        className={`text-caption px-2.5 py-1.5 rounded-xl ${
                          ev.will_change
                            ? 'bg-amber-100/70 text-amber-900 font-semibold'
                            : ev.tag_locked
                            ? 'bg-purple-50 text-purple-800'
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
                    <thead className="bg-slate-100 text-caption font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
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
                                  <div className="text-caption text-slate-500 truncate">
                                    {ev.category_name} • Mới <span className="font-num">{ev.days_since_created}</span> ngày
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Sales Volume & Rank */}
                            <td className="px-3 py-3 text-center">
                              <div className="font-black font-num text-slate-900 text-xs">
                                {ev.total_qty} ly
                              </div>
                              {ev.total_qty > 0 ? (
                                <div className="text-caption font-num font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full inline-block mt-0.5 border border-purple-200/60">
                                  Hạng #{ev.sales_rank}
                                </div>
                              ) : (
                                <div className="text-caption text-slate-400">Chưa bán</div>
                              )}
                            </td>

                            {/* Profit & Margin */}
                            <td className="px-3 py-3 text-right">
                              <div className="font-black font-num text-slate-900 text-xs">
                                {new Intl.NumberFormat('vi-VN', {
                                  style: 'currency',
                                  currency: 'VND',
                                }).format(ev.total_profit)}
                              </div>
                              <div
                                className={`text-caption font-num font-bold mt-0.5 ${
                                  ev.margin_percent >= 60
                                    ? 'text-purple-600'
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
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-caption font-extrabold border ${currentBadge.badgeClasses}`}
                                >
                                  <span>{currentBadge.icon}</span>
                                  <span>{currentBadge.name}</span>
                                </span>
                              ) : (
                                <span className="text-caption text-slate-400 italic">Không</span>
                              )}
                            </td>

                            {/* Suggested Tag */}
                            <td className="px-3 py-3 text-center">
                              {ev.suggested_tag !== 'none' ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-caption font-extrabold border shadow-sm ${suggestedBadge.badgeClasses}`}
                                >
                                  <span>{suggestedBadge.icon}</span>
                                  <span>{suggestedBadge.name}</span>
                                </span>
                              ) : (
                                <span className="text-caption text-slate-400 italic">Không</span>
                              )}
                            </td>

                            {/* Reason */}
                            <td className="px-3.5 py-3">
                              <div
                                className={`text-caption font-medium leading-snug ${
                                  ev.will_change
                                    ? 'text-amber-800 font-bold'
                                    : ev.tag_locked
                                    ? 'text-purple-700 font-semibold'
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
                                className={`p-1.5 rounded-full border transition cursor-pointer ${
                                  ev.tag_locked
                                    ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 shadow-sm'
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
    </ModalShell>
  );
}
