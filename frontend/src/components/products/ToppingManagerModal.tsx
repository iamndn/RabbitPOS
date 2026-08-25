'use client';

import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  AlertCircle,
  FolderOpen,
  DollarSign,
  Check,
  GripVertical,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { Topping, Category } from '@/types/product';
import ModernSelect from '@/components/common/ModernSelect';

interface ToppingManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  toppings: Topping[];
  categories: Category[];
  onToppingsUpdated: () => void;
  settings?: any;
}

export default function ToppingManagerModal({
  isOpen,
  onClose,
  toppings = [],
  categories = [],
  onToppingsUpdated,
  settings,
}: ToppingManagerModalProps) {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();

  const [localToppings, setLocalToppings] = useState<Topping[]>(toppings);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTopping, setEditingTopping] = useState<Topping | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form State
  const [toppingName, setToppingName] = useState('');
  const [toppingPrice, setToppingPrice] = useState<number>(0);
  const [toppingCogs, setToppingCogs] = useState<number>(0);
  const [toppingCategoryId, setToppingCategoryId] = useState<number | null>(null);
  const [toppingIsActive, setToppingIsActive] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  React.useEffect(() => {
    setLocalToppings(toppings);
  }, [toppings]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingTopping(null);
    setToppingName('');
    setToppingPrice(0);
    setToppingCogs(0);
    setToppingCategoryId(null);
    setToppingIsActive(true);
    setErrorMsg('');
    setShowForm(false);
  };

  const handleStartCreate = () => {
    setEditingTopping(null);
    setToppingName('');
    setToppingPrice(0);
    setToppingCogs(0);
    setToppingCategoryId(null);
    setToppingIsActive(true);
    setErrorMsg('');
    setShowForm(true);
  };

  const handleStartEdit = (tp: Topping) => {
    setEditingTopping(tp);
    setToppingName(tp.name);
    setToppingPrice(Number(tp.price) || 0);
    setToppingCogs(Number(tp.cogs) || 0);
    setToppingCategoryId(tp.category_id || null);
    setToppingIsActive(tp.is_active !== false);
    setErrorMsg('');
    setShowForm(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toppingName.trim()) {
      setErrorMsg('Vui lòng nhập tên topping');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      const payload = {
        name: toppingName.trim(),
        price: Number(toppingPrice) || 0,
        cogs: Number(toppingCogs) || 0,
        category_id: toppingCategoryId,
        is_active: toppingIsActive,
      };

      if (editingTopping) {
        const res = await fetchApi<Topping>(`/toppings/${editingTopping.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.status === 'success') {
          onToppingsUpdated();
          resetForm();
        } else {
          setErrorMsg(res.message || 'Cập nhật topping thất bại');
        }
      } else {
        const res = await fetchApi<Topping>('/toppings', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.status === 'success') {
          onToppingsUpdated();
          resetForm();
        } else {
          setErrorMsg(res.message || 'Tạo topping thất bại');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu topping');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tp: Topping) => {
    const newStatus = !tp.is_active;
    try {
      const res = await fetchApi<Topping>(`/toppings/${tp.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: tp.name,
          price: Number(tp.price),
          cogs: Number(tp.cogs) || 0,
          category_id: tp.category_id,
          is_active: newStatus,
        }),
      });
      if (res.status === 'success') {
        onToppingsUpdated();
      } else {
        showAlert('Lỗi', res.message || 'Cập nhật trạng thái thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi kết nối khi cập nhật', 'danger');
    }
  };

  const handleDelete = async (tp: Topping) => {
    const isConfirmed = await confirm({
      title: 'Xác nhận xóa Topping',
      message: `Bạn có chắc chắn muốn xóa topping "${tp.name}"? Topping này sẽ không còn xuất hiện trong menu chọn món.`,
      type: 'danger',
      confirmText: 'Xóa Topping',
      cancelText: 'Hủy',
    });
    if (!isConfirmed) return;

    try {
      const res = await fetchApi(`/toppings/${tp.id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        onToppingsUpdated();
        if (editingTopping?.id === tp.id) {
          resetForm();
        }
      } else {
        showAlert('Lỗi', res.message || 'Xóa topping thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi kết nối khi xóa', 'danger');
    }
  };

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const currentFiltered = [...filteredToppings];
    const [moved] = currentFiltered.splice(draggedIndex, 1);
    currentFiltered.splice(targetIndex, 0, moved);

    let newFullList: Topping[];
    const isFiltered = searchQuery.trim() !== '' || selectedCatFilter !== 'all';
    if (isFiltered) {
      const movedId = moved.id;
      const targetId = filteredToppings[targetIndex]?.id;
      const full = [...localToppings];
      const fromIdx = full.findIndex((t) => t.id === movedId);
      if (fromIdx >= 0) {
        const [fullMoved] = full.splice(fromIdx, 1);
        const toIdx = full.findIndex((t) => t.id === targetId);
        full.splice(toIdx >= 0 ? toIdx : full.length, 0, fullMoved);
      }
      newFullList = full;
    } else {
      newFullList = currentFiltered;
    }

    setLocalToppings(newFullList);
    handleDragEnd();

    try {
      const orderedIds = newFullList.map((t) => t.id);
      await fetchApi('/toppings/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      onToppingsUpdated();
    } catch (err) {
      console.error('Failed to reorder toppings', err);
    }
  };

  const filteredToppings = localToppings.filter((tp) => {
    const matchesSearch = tp.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (selectedCatFilter === 'global') {
      return tp.category_id === null;
    } else if (selectedCatFilter !== 'all') {
      return tp.category_id === Number(selectedCatFilter);
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150 pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">Quản Lý Topping &amp; Món Thêm</h3>
                <span className="bg-violet-100 text-violet-700 text-[11px] px-2 py-0.2 rounded-full font-black">
                  {toppings.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Các món topping kèm theo (Trân châu, Thạch, Pudding...)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Action Row: Search + Category Filter + Add Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên topping..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="app-input pl-9 pr-8 py-2 text-xs"
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

              <div className="w-full sm:w-48 shrink-0">
                <ModernSelect
                  value={selectedCatFilter}
                  onChange={(val) => setSelectedCatFilter(val as string)}
                  options={[
                    { value: 'all', label: 'Tất cả nhóm' },
                    { value: 'global', label: 'Toàn cục (Dùng chung)' },
                    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </div>
            </div>

            {!showForm && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Topping</span>
              </button>
            )}
          </div>

          {/* Form Card (Create or Edit) */}
          {showForm && (
            <form
              onSubmit={handleSaveForm}
              className="bg-violet-50/40 p-3.5 sm:p-5 rounded-2xl border border-violet-200/80 space-y-3.5 sm:space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-violet-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-violet-600" />
                  <span>{editingTopping ? `Sửa topping: ${editingTopping.name}` : 'Thêm topping mới'}</span>
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                >
                  Đóng form
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tên topping <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Trân châu đường đen, Thạch đào, Kem phô mai..."
                    value={toppingName}
                    onChange={(e) => setToppingName(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Giá bán (VNĐ)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={toppingPrice ? toppingPrice.toLocaleString('vi-VN') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setToppingPrice(raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    placeholder="VD: 5000, 10000..."
                    className="w-full text-xs font-bold px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Giá vốn (COGS)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={toppingCogs ? toppingCogs.toLocaleString('vi-VN') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setToppingCogs(raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    placeholder="VD: 2000..."
                    className="w-full text-xs font-bold px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Áp dụng cho nhóm
                  </label>
                  <ModernSelect
                    value={toppingCategoryId ?? ''}
                    placeholder="Toàn cục (Mọi món)"
                    clearable={true}
                    onChange={(val) =>
                      setToppingCategoryId(val === '' || val === null ? null : Number(val))
                    }
                    options={[
                      { value: '', label: 'Toàn cục (Dùng chung)', badge: 'Global', badgeColor: 'indigo' },
                      ...categories.map((cat) => ({
                        value: cat.id,
                        label: cat.name,
                        icon: <FolderOpen className="w-3.5 h-3.5 text-slate-400" />,
                      })),
                    ]}
                  />
                </div>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-violet-200/80 shadow-2xs">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Trạng thái bán</span>
                  <span className="text-[11px] text-slate-500">
                    {toppingIsActive ? '🟢 Đang BẬT (sẵn sàng phục vụ)' : '⚪ TẮT (tạm hết)'}
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={toppingIsActive}
                  onClick={() => setToppingIsActive(!toppingIsActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                    toppingIsActive ? 'bg-violet-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      toppingIsActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Form Buttons (Balanced on mobile) */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end pt-2 border-t border-violet-200/60">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer text-center justify-center flex items-center"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 text-center justify-center flex items-center"
                >
                  {saving ? 'Đang lưu...' : editingTopping ? 'Lưu Thay Đổi' : 'Tạo Topping'}
                </button>
              </div>
            </form>
          )}

          {/* Toppings Table / List Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                Danh sách topping ({filteredToppings.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                💡 Kéo thả biểu tượng ⋮⋮ để đổi thứ tự
              </span>
            </div>

            {filteredToppings.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-semibold">
                  {searchQuery ? 'Không tìm thấy topping phù hợp' : 'Chưa có topping nào'}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Mobile Cards View (sm:hidden) */}
                <div className="block sm:hidden space-y-2.5">
                  {filteredToppings.map((tp, idx) => {
                    const linkedCat = categories.find((c) => c.id === tp.category_id);
                    const isEditing = editingTopping?.id === tp.id;
                    const isDragging = draggedIndex === idx;
                    const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                    return (
                      <div
                        key={tp.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`p-3 rounded-2xl border transition-all space-y-2.5 cursor-move select-none ${
                          isDragging
                            ? 'opacity-40 scale-95 border-dashed border-violet-400 bg-violet-50/40'
                            : isDragOver
                            ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/20'
                            : isEditing
                            ? 'bg-violet-50 border-violet-300 ring-2 ring-violet-500/20'
                            : 'bg-white border-slate-200 shadow-2xs'
                        }`}
                      >
                        {/* Top: Name + Active Toggle */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                tp.is_active ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'
                              }`}
                            />
                            <span className={`font-bold text-xs truncate ${tp.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                              {tp.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStatus(tp);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold transition cursor-pointer shrink-0 ${
                              tp.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span>{tp.is_active ? '● Đang bán' : '○ Tạm hết'}</span>
                          </button>
                        </div>

                        {/* Mid Info: Prices + Scope */}
                        <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-violet-700 text-xs">
                              {formatPrice(tp.price)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (Vốn: {formatPrice(tp.cogs || 0)})
                            </span>
                          </div>

                          <div>
                            {linkedCat ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                                <FolderOpen className="w-3 h-3 text-slate-400" />
                                {linkedCat.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Toàn cục
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(tp);
                            }}
                            className="px-3 py-1 text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tp);
                            }}
                            className="px-3 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. Desktop Table View (hidden sm:block) */}
                <div className="hidden sm:block border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-700 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="w-8 px-2 py-3"></th>
                        <th className="px-3 py-3">Tên Topping</th>
                        <th className="px-3 py-3 text-right">Giá Bán</th>
                        <th className="px-3 py-3 text-right">Giá Vốn</th>
                        <th className="px-3 py-3 text-center">Nhóm Áp Dụng</th>
                        <th className="px-3 py-3 text-center">Trạng Thái</th>
                        <th className="px-3.5 py-3 text-right">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredToppings.map((tp, idx) => {
                        const linkedCat = categories.find((c) => c.id === tp.category_id);
                        const isEditing = editingTopping?.id === tp.id;
                        const isDragging = draggedIndex === idx;
                        const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                        return (
                          <tr
                            key={tp.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, idx)}
                            className={`hover:bg-slate-50 transition cursor-move select-none ${
                              isDragging
                                ? 'opacity-40 bg-violet-50/50'
                                : isDragOver
                                ? 'bg-violet-50/40 ring-2 ring-violet-500/20'
                                : isEditing
                                ? 'bg-violet-50/70'
                                : ''
                            }`}
                          >
                            <td className="px-2 py-3 text-center">
                              <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500 mx-auto cursor-grab active:cursor-grabbing" />
                            </td>
                            <td className="px-3 py-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    tp.is_active ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-slate-300'
                                  }`}
                                />
                                <span className={tp.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}>
                                  {tp.name}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-right font-black text-violet-700">
                              {formatPrice(tp.price)}
                            </td>

                            <td className="px-3 py-3 text-right font-medium text-slate-500">
                              {formatPrice(tp.cogs || 0)}
                            </td>

                            <td className="px-3 py-3 text-center">
                              {linkedCat ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <FolderOpen className="w-3 h-3 text-slate-400" />
                                  {linkedCat.name}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Toàn cục
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleStatus(tp);
                                }}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition cursor-pointer ${
                                  tp.is_active
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-2xs'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                }`}
                                title={tp.is_active ? 'Bấm để Tắt' : 'Bấm để Bật'}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    tp.is_active ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                <span>{tp.is_active ? 'Đang bán' : 'Tạm hết'}</span>
                              </button>
                            </td>

                            <td className="px-3.5 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(tp);
                                  }}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-violet-700 hover:bg-violet-50 transition cursor-pointer"
                                  title="Sửa topping"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(tp);
                                  }}
                                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Xóa topping"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:px-5 sm:py-3.5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Tổng cộng: <strong>{toppings.length}</strong> loại topping
          </span>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-white border border-slate-200 rounded-xl transition cursor-pointer text-center justify-center flex items-center"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
