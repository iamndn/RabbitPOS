'use client';

import React, { useState } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Check, Sparkles, RefreshCw, AlertCircle, GripVertical } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { ModalShell } from '@/components/ui/ModalShell';

export interface CustomTag {
  id: string;
  name: string;
  color: string; // 'rose' | 'amber' | 'green' | 'indigo' | 'purple' | 'sky' | 'teal' | 'orange' | 'slate'
  icon: string;
  is_system?: boolean;
}

export const DEFAULT_SYSTEM_TAGS: CustomTag[] = [
  { id: 'best_seller', name: 'Bán chạy', color: 'rose', icon: '🔥', is_system: true },
  { id: 'featured', name: 'Nổi bật', color: 'amber', icon: '⭐', is_system: true },
  { id: 'signature', name: 'Signature quán', color: 'purple', icon: '👑', is_system: true },
  { id: 'suspended', name: 'Tạm ngưng', color: 'slate', icon: '⛔', is_system: true },
];

export const TAG_COLORS: { id: string; name: string; bg: string; text: string; border: string; preview: string }[] = [
  { id: 'rose', name: 'Đỏ Hồng (Rose)', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', preview: 'bg-rose-500' },
  { id: 'amber', name: 'Vàng Cam (Amber)', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', preview: 'bg-amber-500' },
  { id: 'green', name: 'Xanh Lá (Green)', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', preview: 'bg-green-500' },
  { id: 'indigo', name: 'Xanh Chàm (Indigo)', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', preview: 'bg-indigo-500' },
  { id: 'purple', name: 'Tím (Purple)', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', preview: 'bg-purple-500' },
  { id: 'sky', name: 'Xanh Trời (Sky)', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', preview: 'bg-sky-500' },
  { id: 'teal', name: 'Xanh Mòng Két (Teal)', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', preview: 'bg-teal-500' },
  { id: 'orange', name: 'Cam Đậm (Orange)', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', preview: 'bg-orange-500' },
  { id: 'slate', name: 'Xám Ghi (Slate)', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', preview: 'bg-slate-500' },
];

export const TAG_ICONS = ['🏷️', '🔥', '⭐', '✨', '👑', '🍹', '☕', '🥤', '🌿', '🍨', '🍰', '🍕', '🎯', '⚡', '💎', '🏆', '❤️', '👍'];

export function getTagBadgeStyle(tagId: string, customTags: CustomTag[] = []) {
  const allTags = customTags && customTags.length > 0 ? customTags : DEFAULT_SYSTEM_TAGS;
  const found = allTags.find((t) => t.id === tagId) || DEFAULT_SYSTEM_TAGS.find((t) => t.id === tagId);
  const colorId = found ? found.color : 'purple';
  const colorDef = TAG_COLORS.find((c) => c.id === colorId) || (colorId === 'emerald' ? TAG_COLORS.find(c => c.id === 'green') : null) || TAG_COLORS[0];
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

  // Initialize tags: if customTags is provided, filter out removed 'new' and 'coming_soon' tags
  const getInitialTags = (rawList: CustomTag[]) => {
    const cleaned = (rawList || []).filter((t) => t.id !== 'new' && t.id !== 'coming_soon');
    if (cleaned.length === 0) {
      return [...DEFAULT_SYSTEM_TAGS];
    }
    // Ensure standard system tags exist if not present
    const existingIds = new Set(cleaned.map((t) => t.id));
    const missingDefaults = DEFAULT_SYSTEM_TAGS.filter((dt) => !existingIds.has(dt.id));
    return [...cleaned, ...missingDefaults];
  };

  const [tags, setTags] = useState<CustomTag[]>(() => getInitialTags(customTags));
  const [editingTag, setEditingTag] = useState<CustomTag | null>(null);
  const [tagName, setTagName] = useState<string>('');
  const [tagId, setTagId] = useState<string>('');
  const [tagColor, setTagColor] = useState<string>('purple');
  const [tagIcon, setTagIcon] = useState<string>('🏷️');
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [draggedTagIndex, setDraggedTagIndex] = useState<number | null>(null);
  const [dragOverTagIndex, setDragOverTagIndex] = useState<number | null>(null);

  React.useEffect(() => {
    setTags(getInitialTags(customTags));
  }, [customTags]);

  if (!isOpen) return null;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTagIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverTagIndex !== index) {
      setDragOverTagIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedTagIndex(null);
    setDragOverTagIndex(null);
  };

  const handleDropTag = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTagIndex === null || draggedTagIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const updated = [...tags];
    const [moved] = updated.splice(draggedTagIndex, 1);
    updated.splice(targetIndex, 0, moved);

    setTags(updated);
    handleDragEnd();

    setSaving(true);
    try {
      await onSaveTags(updated);
    } catch (err: any) {
      showAlert('Lỗi', 'Không thể lưu thứ tự nhãn: ' + err.message, 'danger');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingTag(null);
    setTagName('');
    setTagId('');
    setTagColor('purple');
    setTagIcon('🏷️');
    setErrorMsg('');
  };

  const handleStartEdit = (tag: CustomTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagId(tag.id);
    setTagColor(tag.color || 'purple');
    setTagIcon(tag.icon || '🏷️');
    setErrorMsg('');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = tagName.trim();
    const cleanId = tagId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (!cleanName) {
      setErrorMsg('Vui lòng nhập tên nhãn');
      return;
    }
    if (!cleanId) {
      setErrorMsg('Mã nhãn không hợp lệ');
      return;
    }

    if (!editingTag && tags.some((t) => t.id === cleanId)) {
      setErrorMsg(`Mã nhãn "${cleanId}" đã tồn tại! Vui lòng chọn mã khác.`);
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      let updatedList: CustomTag[];
      if (editingTag) {
        updatedList = tags.map((t) =>
          t.id === editingTag.id
            ? { ...t, name: cleanName, color: tagColor, icon: tagIcon }
            : t
        );
      } else {
        const newTag: CustomTag = {
          id: cleanId,
          name: cleanName,
          color: tagColor,
          icon: tagIcon,
        };
        updatedList = [...tags, newTag];
      }

      await onSaveTags(updatedList);
      setTags(updatedList);
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu nhãn');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    const isConfirmed = await confirm({
      title: 'Khôi phục nhãn mặc định',
      message: 'Hành động này sẽ khôi phục danh sách nhãn về các nhãn hệ thống chuẩn. Các nhãn tự tạo vẫn được giữ.',
      type: 'warning',
      confirmText: 'Khôi phục',
      cancelText: 'Hủy',
    });
    if (!isConfirmed) return;

    setSaving(true);
    try {
      const customOnly = tags.filter((t) => !DEFAULT_SYSTEM_TAGS.some((dt) => dt.id === t.id));
      const resetList = [...DEFAULT_SYSTEM_TAGS, ...customOnly];
      await onSaveTags(resetList);
      setTags(resetList);
      resetForm();
    } catch (err: any) {
      showAlert('Lỗi', 'Không thể khôi phục: ' + err.message, 'danger');
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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      preventClose={saving}
      icon={<Tag className="w-5 h-5 text-brand-purple" />}
      title={
        <div className="flex items-center gap-2">
          <span>Quản Lý Nhãn (Tags)</span>
          <span className="bg-purple-100 text-purple-700 text-caption px-2 py-0.5 rounded-full font-num font-black">
            {DEFAULT_SYSTEM_TAGS.length + tags.length}
          </span>
        </div>
      }
      description="Tạo và tùy biến các huy hiệu gắn lên món ăn"
      headerActions={
        onOpenAutoTagging ? (
          <button
            type="button"
            onClick={onOpenAutoTagging}
            className="bg-purple-50 hover:bg-purple-100 text-purple-900 text-caption font-bold px-3 py-1.5 rounded-full border border-purple-200 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            title="Tự động phân hạng & gán nhãn Best Seller, Món mới, Lợi nhuận cao"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Tự Động Gán Nhãn</span>
            <span className="sm:hidden">Auto-Tag</span>
          </button>
        ) : null
      }
      footer={
        <div className="flex justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-full shadow-sm transition cursor-pointer text-center justify-center flex items-center"
          >
            Đóng trình quản lý
          </button>
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        {/* Auto-tagging Quick Feature Banner */}
        {onOpenAutoTagging && (
          <div className="bg-purple-50/60 p-3 sm:p-3.5 rounded-2xl border border-purple-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black shrink-0 shadow-sm text-xs">
                ⚡
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  Bộ Động Cơ Tự Động Gán Nhãn (Auto-Tag)
                </div>
                <div className="text-caption text-slate-500 truncate">
                  Tự động tính Best Seller, Món mới, Biên lợi nhuận cao
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAutoTagging}
              className="w-full sm:w-auto px-4 py-1.5 bg-brand-purple hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-full transition cursor-pointer shrink-0 shadow-sm text-center justify-center flex items-center"
            >
              Cấu hình &amp; Chạy
            </button>
          </div>
        )}

        {/* Tag Editor Form */}
        <form onSubmit={handleSaveForm} className="bg-slate-50/80 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
              <span>{editingTag ? `Sửa nhãn: ${editingTag.name}` : 'Thêm nhãn sản phẩm mới'}</span>
            </h4>
            {editingTag && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
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
                className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
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
                className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-400 font-mono shadow-sm"
              />
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Chọn Biểu tượng (Icon)</label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
              {TAG_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setTagIcon(ic)}
                  className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition cursor-pointer ${
                    tagIcon === ic ? 'bg-brand-purple text-white shadow-sm scale-110' : 'hover:bg-slate-100'
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
                        ? `${col.bg} ${col.text} ${col.border} ring-2 ring-purple-500 shadow-sm font-black`
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

          {/* Live Preview & Submit Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Xem trước:</span>
              <span
                className={`text-xs uppercase font-extrabold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 truncate ${
                  TAG_COLORS.find((c) => c.id === tagColor)?.bg
                } ${TAG_COLORS.find((c) => c.id === tagColor)?.text} ${
                  TAG_COLORS.find((c) => c.id === tagColor)?.border
                }`}
              >
                <span>{tagIcon}</span>
                <span className="truncate">{tagName.trim() || 'Tên nhãn mẫu'}</span>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {editingTag && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer text-center justify-center flex items-center"
                >
                  Hủy
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial bg-brand-purple hover:bg-purple-700 active:scale-95 text-white font-bold text-xs px-5 py-2 rounded-full shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>Đang lưu...</span>
                  </>
                ) : editingTag ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> <span>Lưu cập nhật</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> <span>Thêm nhãn này</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Tags List */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-brand-purple" />
              <span>Danh sách nhãn ({tags.length} nhãn)</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefaults}
                className="text-caption font-bold text-slate-500 hover:text-purple-700 transition flex items-center gap-1 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full"
                title="Khôi phục về danh sách nhãn mặc định"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
          </div>

          <p className="text-caption text-slate-400 mb-2">
            💡 Kéo thả biểu tượng <span className="font-mono font-bold">⋮⋮</span> để sắp xếp thứ tự hiển thị của tất cả các nhãn (kể cả nhãn mặc định)
          </p>

          {/* Unified Drag-and-Drop Tags List */}
          {tags.length === 0 ? (
            <div className="p-5 sm:p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-semibold">
              Chưa có nhãn nào. Hãy nhấn &quot;Khôi phục mặc định&quot; hoặc thêm nhãn mới từ biểu mẫu phía trên!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tags.map((ct, idx) => {
                const style = getTagBadgeStyle(ct.id, tags);
                const count = productCountsByTag[ct.id] || 0;
                const isDragging = draggedTagIndex === idx;
                const isDragOver = dragOverTagIndex === idx && draggedTagIndex !== idx;

                return (
                  <div
                    key={ct.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDropTag(e, idx)}
                    className={`p-2.5 sm:p-3 bg-white rounded-2xl border shadow-sm flex items-center justify-between gap-2 group transition cursor-move select-none ${
                      isDragging
                        ? 'opacity-40 scale-95 border-dashed border-purple-400 bg-purple-50/30'
                        : isDragOver
                        ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/20'
                        : 'border-slate-200 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border shrink-0 ${style.badgeClasses}`}>
                        {ct.icon} {ct.name}
                      </span>
                      <span className="text-caption text-slate-400 font-mono font-medium truncate">({ct.id})</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-caption font-num font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                        {count} món
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStartEdit(ct)}
                        className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-full transition cursor-pointer"
                        title="Sửa nhãn"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(ct)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition cursor-pointer"
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
    </ModalShell>
  );
}
