'use client';

import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Check, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';

export interface CustomTag {
  id: string;
  name: string;
  color: string; // 'rose' | 'amber' | 'emerald' | 'indigo' | 'purple' | 'sky' | 'teal' | 'orange' | 'slate'
  icon: string;
  is_system?: boolean;
}

export const DEFAULT_SYSTEM_TAGS: CustomTag[] = [
  { id: 'best_seller', name: 'Bán chạy', color: 'rose', icon: '🔥', is_system: true },
  { id: 'featured', name: 'Nổi bật', color: 'amber', icon: '⭐', is_system: true },
  { id: 'new', name: 'Món mới', color: 'emerald', icon: '✨', is_system: true },
  { id: 'signature', name: 'Signature quán', color: 'indigo', icon: '👑', is_system: true },
  { id: 'coming_soon', name: 'Sắp ra mắt', color: 'sky', icon: '⏳', is_system: true },
  { id: 'suspended', name: 'Tạm ngưng', color: 'slate', icon: '⛔', is_system: true },
];

export const TAG_COLORS: { id: string; name: string; bg: string; text: string; border: string; preview: string }[] = [
  { id: 'rose', name: 'Đỏ Hồng (Rose)', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', preview: 'bg-rose-500' },
  { id: 'amber', name: 'Vàng Cam (Amber)', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', preview: 'bg-amber-500' },
  { id: 'emerald', name: 'Xanh Lá (Emerald)', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', preview: 'bg-emerald-500' },
  { id: 'indigo', name: 'Xanh Chàm (Indigo)', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', preview: 'bg-indigo-500' },
  { id: 'purple', name: 'Tím (Purple)', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', preview: 'bg-purple-500' },
  { id: 'sky', name: 'Xanh Trời (Sky)', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', preview: 'bg-sky-500' },
  { id: 'teal', name: 'Xanh Mòng Két (Teal)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', preview: 'bg-teal-500' },
  { id: 'orange', name: 'Cam Đậm (Orange)', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', preview: 'bg-orange-500' },
  { id: 'slate', name: 'Xám Ghi (Slate)', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', preview: 'bg-slate-500' },
];

export const TAG_ICONS = ['🏷️', '🔥', '⭐', '✨', '👑', '🍹', '☕', '🥤', '🌿', '🍨', '🍰', '🍕', '🎯', '⚡', '💎', '🏆', '❤️', '👍'];

export function getTagBadgeStyle(tagId: string, customTags: CustomTag[] = []) {
  const allTags = [...DEFAULT_SYSTEM_TAGS, ...customTags];
  const found = allTags.find((t) => t.id === tagId);
  const colorId = found ? found.color : 'emerald';
  const colorDef = TAG_COLORS.find((c) => c.id === colorId) || TAG_COLORS[0];
  return {
    label: found ? `${found.icon} ${found.name}` : tagId.replace('_', ' '),
    icon: found?.icon || '🏷️',
    name: found?.name || tagId,
    colorDef,
    badgeClasses: `${colorDef.bg} ${colorDef.text} ${colorDef.border}`,
  };
}

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customTags: CustomTag[];
  onSaveTags: (tags: CustomTag[]) => Promise<void>;
  productCountsByTag?: Record<string, number>;
  onOpenAutoTagging?: () => void;
}

export default function TagManagerModal({
  isOpen,
  onClose,
  customTags,
  onSaveTags,
  productCountsByTag = {},
  onOpenAutoTagging,
}: TagManagerModalProps) {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();

  const [tags, setTags] = useState<CustomTag[]>(customTags);
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [tagName, setTagName] = useState<string>('');
  const [tagId, setTagId] = useState<string>('');
  const [tagColor, setTagColor] = useState<string>('emerald');
  const [tagIcon, setTagIcon] = useState<string>('🏷️');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    setTags(customTags);
  }, [customTags]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingTag(null);
    setTagName('');
    setTagId('');
    setTagColor('emerald');
    setTagIcon('🏷️');
    setErrorMsg('');
  };

  const handleStartEdit = (tag: CustomTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagId(tag.id);
    setTagColor(tag.color);
    setTagIcon(tag.icon);
    setErrorMsg('');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) {
      setErrorMsg('Vui lòng nhập tên nhãn');
      return;
    }

    const generatedId =
      editingTag?.id ||
      tagId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') ||
      'tag_' + Date.now();

    // Check duplicate code
    const isDuplicate = tags.some((t) => t.id === generatedId && t.id !== editingTag?.id);
    const isSystemDuplicate = DEFAULT_SYSTEM_TAGS.some((t) => t.id === generatedId && t.id !== editingTag?.id);
    if (isDuplicate || isSystemDuplicate) {
      setErrorMsg('Mã nhãn đã tồn tại, vui lòng chọn mã khác');
      return;
    }

    let updatedList: CustomTag[];
    if (editingTag) {
      updatedList = tags.map((t) =>
        t.id === editingTag.id
          ? { ...t, name: tagName.trim(), color: tagColor, icon: tagIcon }
          : t
      );
    } else {
      updatedList = [
        ...tags,
        {
          id: generatedId,
          name: tagName.trim(),
          color: tagColor,
          icon: tagIcon,
          is_system: false,
        },
      ];
    }

    setSaving(true);
    try {
      await onSaveTags(updatedList);
      setTags(updatedList);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu danh sách nhãn');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async (tagToDelete: CustomTag) => {
    const isConfirmed = await confirm({
      title: 'Xác nhận xóa nhãn',
      message: `Bạn có chắc chắn muốn xóa nhãn "${tagToDelete.icon} ${tagToDelete.name}"? Nhãn này sẽ được gỡ khỏi các món liên quan.`,
      type: 'danger',
      confirmText: 'Xóa nhãn',
      cancelText: 'Hủy',
    });
    if (!isConfirmed) return;

    const updatedList = tags.filter((t) => t.id !== tagToDelete.id);
    setSaving(true);
    try {
      await onSaveTags(updatedList);
      setTags(updatedList);
      if (editingTag?.id === tagToDelete.id) {
        resetForm();
      }
    } catch (err: any) {
      showAlert('Lỗi', 'Không thể xóa nhãn: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">Quản Lý Nhãn Sản Phẩm (Tags)</h3>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-black">
                  {DEFAULT_SYSTEM_TAGS.length + tags.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tạo và tùy biến các huy hiệu gắn lên món ăn (Bán chạy, Món mới, Signature, Khuyến mãi...)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAutoTagging && (
              <button
                type="button"
                onClick={onOpenAutoTagging}
                className="bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-amber-500/15 hover:from-amber-500/25 hover:to-indigo-500/25 text-indigo-950 text-xs font-black px-3.5 py-2 rounded-xl border border-indigo-200/90 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Tự động phân hạng & gán nhãn Best Seller, Món mới, Lợi nhuận cao"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">⚡ Tự Động Gán Nhãn</span>
                <span className="sm:hidden">⚡ Auto-Tag</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Auto-tagging Quick Feature Banner */}
          {onOpenAutoTagging && (
            <div className="bg-gradient-to-r from-amber-50 via-indigo-50/60 to-purple-50 p-3.5 rounded-2xl border border-indigo-100 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-xs">
                  ⚡
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    Bộ Động Cơ Tự Động Gán Nhãn (Auto-Tagging Engine)
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Tự động tính Best Seller, Món mới, Biên lợi nhuận cao từ doanh số thực tế
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenAutoTagging}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
              >
                Cấu hình &amp; Chạy
              </button>
            </div>
          )}

          {/* Tag Editor Form */}
          <form onSubmit={handleSaveForm} className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                {editingTag ? `Sửa nhãn: ${editingTag.name}` : 'Thêm nhãn sản phẩm mới'}
              </h4>
              {editingTag && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên nhãn hiển thị <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Vd: Signature quán, Món chay, Hot..."
                  value={tagName}
                  onChange={(e) => {
                    setTagName(e.target.value);
                    if (!editingTag) {
                      setTagId(
                        e.target.value
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9]/g, '_')
                      );
                    }
                  }}
                  className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Mã nhãn (Slug)</label>
                <input
                  type="text"
                  placeholder="vd: mon_dac_biet, best_seller..."
                  value={tagId}
                  disabled={!!editingTag}
                  onChange={(e) => setTagId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 font-mono"
                />
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Chọn Biểu tượng (Icon)</label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200">
                {TAG_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setTagIcon(ic)}
                    className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                      tagIcon === ic ? 'bg-indigo-600 text-white shadow-sm scale-110' : 'hover:bg-slate-100'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette Picker */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Chọn Màu sắc Badge</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {TAG_COLORS.map((col) => {
                  const isSelected = tagColor === col.id;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setTagColor(col.id)}
                      className={`p-2 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? `${col.bg} ${col.text} ${col.border} ring-2 ring-indigo-500 shadow-xs font-black`
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${col.preview} shrink-0`}></span>
                      <span className="truncate">{col.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Preview */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Xem trước hiển thị:</span>
                <span
                  className={`text-xs uppercase font-extrabold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${
                    TAG_COLORS.find((c) => c.id === tagColor)?.bg
                  } ${TAG_COLORS.find((c) => c.id === tagColor)?.text} ${
                    TAG_COLORS.find((c) => c.id === tagColor)?.border
                  }`}
                >
                  <span>{tagIcon}</span>
                  <span>{tagName.trim() || 'Tên nhãn mẫu'}</span>
                </span>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang lưu...
                  </>
                ) : editingTag ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Lưu cập nhật
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Thêm nhãn này
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Tags List */}
          <div>
            <h4 className="text-xs font-black uppercase text-slate-500 mb-3 flex items-center justify-between">
              <span>Danh sách nhãn đang hoạt động</span>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {DEFAULT_SYSTEM_TAGS.length + tags.length} nhãn
              </span>
            </h4>

            {/* System Default Tags */}
            <div className="mb-4 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Nhãn hệ thống mặc định:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEFAULT_SYSTEM_TAGS.map((st) => {
                  const style = getTagBadgeStyle(st.id);
                  const count = productCountsByTag[st.id] || 0;
                  return (
                    <div
                      key={st.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${style.badgeClasses}`}>
                          {st.icon} {st.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium truncate">({st.id})</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        {count} món
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom User Tags */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Nhãn tự tạo (Tùy chỉnh):
              </span>
              {tags.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
                  Chưa có nhãn tự tạo nào. Sử dụng biểu mẫu phía trên để thêm nhãn mới cho menu của bạn!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tags.map((ct) => {
                    const style = getTagBadgeStyle(ct.id, tags);
                    const count = productCountsByTag[ct.id] || 0;
                    return (
                      <div
                        key={ct.id}
                        className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between group hover:border-indigo-200 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${style.badgeClasses}`}>
                            {ct.icon} {ct.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono font-medium truncate">({ct.id})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                            {count} món
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(ct)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Sửa nhãn"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(ct)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Xóa nhãn"
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
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex justify-end shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
          >
            Đóng trình quản lý
          </button>
        </div>
      </div>
    </div>
  );
}
