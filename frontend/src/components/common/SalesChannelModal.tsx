'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Check,
  Truck,
  Building,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  SalesChannel,
  CHANNEL_COLORS,
  DEFAULT_SALES_CHANNELS,
} from '@/types/sales_channel';
import { fetchApi } from '@/lib/api';
import { useConfirm } from '@/context/ConfirmContext';

interface SalesChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: SalesChannel[];
  onChannelsUpdated: (updated: SalesChannel[]) => void;
}

const PRESET_ICONS = ['🏠', '🛍️', '🧡', '💚', '💛', '🖤', '🛵', '🎵', '📦', '🌐', '📞', '🍽️', '☕', '🍰'];

export default function SalesChannelModal({
  isOpen,
  onClose,
  channels,
  onChannelsUpdated,
}: SalesChannelModalProps) {
  const { confirm, showAlert } = useConfirm();

  const [localChannels, setLocalChannels] = useState<SalesChannel[]>(() => {
    return channels && channels.length > 0 ? channels : DEFAULT_SALES_CHANNELS;
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formIcon, setFormIcon] = useState('🛵');
  const [formColor, setFormColor] = useState('indigo');
  const [formIsDelivery, setFormIsDelivery] = useState(false);
  const [formCommissionPct, setFormCommissionPct] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormCode('');
    setFormIcon('🛵');
    setFormColor('indigo');
    setFormIsDelivery(false);
    setFormCommissionPct('0');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (ch: SalesChannel) => {
    setEditingId(ch.id);
    setFormName(ch.name);
    setFormCode(ch.id);
    setFormIcon(ch.icon || '🛵');
    setFormColor(ch.color || 'indigo');
    setFormIsDelivery(ch.is_delivery_app);
    setFormCommissionPct(String(ch.default_commission_pct || 0));
    setIsFormOpen(true);
  };

  const generateCodeFromName = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 25);
  };

  const handleNameChange = (val: string) => {
    setFormName(val);
    if (!editingId) {
      setFormCode(generateCodeFromName(val));
    }
  };

  const saveToBackend = async (nextList: SalesChannel[]) => {
    setIsSaving(true);
    try {
      const res = await fetchApi('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          sales_channels_config: JSON.stringify(nextList),
        }),
      });
      if (res.status === 'success') {
        setLocalChannels(nextList);
        onChannelsUpdated(nextList);
      } else {
        showAlert('Lỗi', res.message || 'Không thể lưu kênh bán hàng', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err?.message || 'Lỗi kết nối máy chủ', 'danger');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    const trimmedCode = (formCode.trim() || generateCodeFromName(trimmedName)).toLowerCase().slice(0, 30);

    if (!trimmedName) {
      showAlert('Cảnh báo', 'Vui lòng nhập tên kênh bán hàng', 'warning');
      return;
    }
    if (!trimmedCode) {
      showAlert('Cảnh báo', 'Mã kênh bán hàng không được để trống', 'warning');
      return;
    }

    const pct = parseFloat(formCommissionPct);
    const validPct = isNaN(pct) || pct < 0 ? 0 : pct > 100 ? 100 : pct;

    if (editingId) {
      // Editing existing
      const nextList = localChannels.map((ch) =>
        ch.id === editingId
          ? {
              ...ch,
              name: trimmedName,
              icon: formIcon,
              color: formColor,
              is_delivery_app: formIsDelivery,
              default_commission_pct: validPct,
            }
          : ch
      );
      await saveToBackend(nextList);
      setIsFormOpen(false);
    } else {
      // Creating new
      if (localChannels.some((ch) => ch.id === trimmedCode)) {
        showAlert('Cảnh báo', `Mã kênh "${trimmedCode}" đã tồn tại. Vui lòng chọn mã khác.`, 'warning');
        return;
      }

      const newChannel: SalesChannel = {
        id: trimmedCode,
        name: trimmedName,
        icon: formIcon,
        color: formColor,
        is_delivery_app: formIsDelivery,
        default_commission_pct: validPct,
        is_system: false,
        is_active: true,
      };

      const nextList = [...localChannels, newChannel];
      await saveToBackend(nextList);
      setIsFormOpen(false);
    }
  };

  const handleToggleActive = async (ch: SalesChannel) => {
    const nextList = localChannels.map((item) =>
      item.id === ch.id ? { ...item, is_active: item.is_active === false ? true : false } : item
    );
    await saveToBackend(nextList);
  };

  const handleDelete = async (ch: SalesChannel) => {
    const ok = await confirm({
      title: 'Xóa kênh bán hàng',
      message: `Bạn có chắc chắn muốn xóa kênh "${ch.name}"? Các đơn hàng cũ đã tạo vẫn sẽ giữ nguyên dữ liệu lịch sử.`,
      type: 'danger',
      confirmText: 'Xóa kênh',
      cancelText: 'Hủy',
    });
    if (!ok) return;

    const nextList = localChannels.filter((item) => item.id !== ch.id);
    await saveToBackend(nextList);
  };

  const handleResetDefaults = async () => {
    const ok = await confirm({
      title: 'Khôi phục mặc định',
      message: 'Khôi phục danh sách kênh bán hàng về cấu hình mặc định ban đầu (Tại quán, Mang về, ShopeeFood, GrabFood, BeFood)?',
      type: 'warning',
      confirmText: 'Khôi phục',
      cancelText: 'Hủy',
    });
    if (!ok) return;

    await saveToBackend(DEFAULT_SALES_CHANNELS);
  };

  return (
    <div className="fixed inset-0 z-[95] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scaleIn">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Quản Lý Kênh Bán Hàng</h3>
              <p className="text-xs text-slate-500">Cấu hình kênh bán hàng, chiết khấu app và phân loại doanh thu</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* Action bar: Add channel & Reset */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm kênh bán hàng</span>
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-purple-700 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Khôi phục kênh mặc định"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Khôi phục mặc định</span>
            </button>
          </div>

          {/* Form Create/Edit Panel (Collapsible) */}
          {isFormOpen && (
            <form onSubmit={handleSaveForm} className="p-4 bg-purple-50/50 border border-purple-200/80 rounded-2xl space-y-3.5 animate-slideUp">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>{editingId ? 'Chỉnh sửa Kênh Bán Hàng' : 'Thêm Kênh Bán Hàng Mới'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Channel Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên kênh <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="VD: TikTok Shop, Hotline, Tại quán..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold"
                  />
                </div>

                {/* Channel Code/ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mã code (duy nhất) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingId}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="VD: tiktok, hotline, dine_in..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Biểu tượng (Icon / Emoji)
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={`w-8 h-8 rounded-xl text-base flex items-center justify-center border transition active:scale-95 cursor-pointer ${
                        formIcon === emoji
                          ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="relative inline-block">
                    <input
                      type="text"
                      maxLength={4}
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value)}
                      placeholder="Icon"
                      className="w-16 h-8 text-center text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Badge Color Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Màu sắc huy hiệu
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {CHANNEL_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setFormColor(c.id)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                        formColor === c.id
                          ? `ring-2 ring-purple-600 ${c.bg} ${c.text} ${c.border}`
                          : `bg-white text-slate-600 border-slate-200 hover:bg-slate-50`
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${c.active.split(' ')[0]}`} />
                      <span>{c.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel Type & Default Commission % */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phân loại kênh
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormIsDelivery(false)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        !formIsDelivery
                          ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Building className="w-3.5 h-3.5" />
                      <span>Trực tiếp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormIsDelivery(true)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer ${
                        formIsDelivery
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>App giao hàng</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    % Chiết khấu hoa hồng mặc định
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formCommissionPct}
                      onChange={(e) => setFormCommissionPct(e.target.value)}
                      placeholder="VD: 20"
                      className="w-full pl-3 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 pointer-events-none">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Tự động tính chiết khấu khi tạo đơn qua kênh này
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition active:scale-95 shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm kênh'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Channels List */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Danh sách kênh ({localChannels.length})
            </label>

            {localChannels.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Chưa có kênh bán hàng nào. Bấm &quot;Thêm kênh bán hàng&quot; hoặc &quot;Khôi phục mặc định&quot;.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {localChannels.map((ch) => {
                  const colorDef = CHANNEL_COLORS.find((c) => c.id === ch.color) || CHANNEL_COLORS[0];
                  const isActive = ch.is_active !== false;

                  return (
                    <div
                      key={ch.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      {/* Left: Icon, Name & Code */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border shrink-0 ${colorDef.bg} ${colorDef.border}`}>
                          {ch.icon || '🛵'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {ch.name}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${colorDef.bg} ${colorDef.text} ${colorDef.border}`}>
                              {ch.is_delivery_app ? 'App giao đồ' : 'Bán trực tiếp'}
                            </span>
                            {ch.is_delivery_app && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {ch.default_commission_pct || 0}% CK
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="font-mono text-slate-500 font-semibold">{ch.id}</span>
                            <span>•</span>
                            <span>{isActive ? 'Đang hoạt động' : 'Tạm tắt'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Toggle, Edit, Delete Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* 1-Click Toggle Active Status */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ch)}
                          className={`px-2 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer active:scale-95 ${
                            isActive
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                          title={isActive ? 'Bấm để tắt kênh này' : 'Bấm để kích hoạt kênh'}
                        >
                          {isActive ? 'Bật' : 'Tắt'}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(ch)}
                          className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition cursor-pointer"
                          title="Sửa kênh"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDelete(ch)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Xóa kênh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

