'use client';

import React, { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  X,
  Search,
  Upload,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Package,
  Layers,
  GripVertical,
} from 'lucide-react';
import { fetchApi, getImageUrl, uploadImage } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { Category, Product } from '@/types/product';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  products?: Product[];
  onCategoriesUpdated: () => void;
}

export default function CategoryManagerModal({
  isOpen,
  onClose,
  categories = [],
  products = [],
  onCategoriesUpdated,
}: CategoryManagerModalProps) {
  const { t } = useTranslation();
  const { confirm, showAlert } = useConfirm();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingCategory(null);
    setName('');
    setImageUrl('');
    setDisplayOrder(0);
    setErrorMsg('');
    setShowForm(false);
  };

  const handleStartCreate = () => {
    setEditingCategory(null);
    setName('');
    setImageUrl('');
    setDisplayOrder(categories.length > 0 ? Math.max(...categories.map((c) => c.display_order || 0)) + 1 : 1);
    setErrorMsg('');
    setShowForm(true);
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setImageUrl(cat.image_url || '');
    setDisplayOrder(cat.display_order || 0);
    setErrorMsg('');
    setShowForm(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const res = await uploadImage(file);
      if (res.status === 'success' && res.data?.url) {
        setImageUrl(res.data.url);
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Tải ảnh thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert(t('common.error') || 'Lỗi', err.message || 'Lỗi tải ảnh', 'danger');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên danh mục');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      if (editingCategory) {
        const res = await fetchApi<Category>(`/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            image_url: imageUrl,
            display_order: Number(displayOrder) || 0,
          }),
        });
        if (res.status === 'success') {
          onCategoriesUpdated();
          resetForm();
        } else {
          setErrorMsg(res.message || 'Cập nhật danh mục thất bại');
        }
      } else {
        const res = await fetchApi<Category>('/categories', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            image_url: imageUrl,
            display_order: Number(displayOrder) || 0,
          }),
        });
        if (res.status === 'success') {
          onCategoriesUpdated();
          resetForm();
        } else {
          setErrorMsg(res.message || 'Tạo danh mục thất bại');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu danh mục');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    const itemCount = products.filter((p) => p.category_id === cat.id).length;
    const isConfirmed = await confirm({
      title: 'Xác nhận xóa danh mục',
      message: `Bạn có chắc chắn muốn xóa danh mục "${cat.name}"? ${
        itemCount > 0 ? `Hiện có ${itemCount} món trong danh mục này.` : ''
      }`,
      type: 'danger',
      confirmText: 'Xóa danh mục',
      cancelText: 'Hủy',
    });
    if (!isConfirmed) return;

    try {
      const res = await fetchApi(`/categories/${cat.id}`, { method: 'DELETE' });
      if (res.status === 'success') {
        onCategoriesUpdated();
        if (editingCategory?.id === cat.id) {
          resetForm();
        }
      } else {
        showAlert('Lỗi', res.message || 'Xóa danh mục thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert('Lỗi', err.message || 'Lỗi kết nối khi xóa danh mục', 'danger');
    }
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
    const currentList = [...filteredCategories];
    const [moved] = currentList.splice(draggedIndex, 1);
    currentList.splice(targetIndex, 0, moved);
    handleDragEnd();

    try {
      const orderedIds = currentList.map((c) => c.id);
      await fetchApi('/categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      onCategoriesUpdated();
    } catch (err) {
      console.error('Failed to reorder categories', err);
    }
  };

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-150 pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-2xs shrink-0">
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base truncate">Quản Lý Danh Mục Món</h3>
                <span className="bg-emerald-100 text-emerald-700 text-[11px] px-2 py-0.2 rounded-full font-black">
                  {categories.length}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Phân loại thực đơn theo nhóm món
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
          {/* Top action toolbar: Search + Add button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên danh mục..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
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

            {!showForm && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer shrink-0 w-full sm:w-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Danh Mục</span>
              </button>
            )}
          </div>

          {/* Form Card (Create or Edit) */}
          {showForm && (
            <form
              onSubmit={handleSaveForm}
              className="bg-emerald-50/40 p-3.5 sm:p-5 rounded-2xl border border-emerald-200/80 space-y-3.5 sm:space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-emerald-800 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-emerald-600" />
                  <span>{editingCategory ? `Sửa danh mục: ${editingCategory.name}` : 'Thêm danh mục mới'}</span>
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
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Tên danh mục <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Cà phê, Trà hoa quả, Bánh ngọt..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="1, 2, 3..."
                    value={displayOrder === 0 ? '' : displayOrder}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setDisplayOrder(raw === '' ? 0 : parseInt(raw, 10));
                    }}
                    className="w-full text-xs font-bold px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Image Upload Row */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hình ảnh danh mục (Icon/Ảnh đại diện)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 relative shadow-2xs">
                    {getImageUrl(imageUrl) ? (
                      <img
                        src={getImageUrl(imageUrl)!}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                    {uploadingImg && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 inline-flex items-center gap-1.5 transition shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" /> <span>Tải ảnh lên</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Hoặc dán URL ảnh trực tiếp..."
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Form Buttons (Balanced on mobile) */}
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end pt-2 border-t border-emerald-200/60">
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
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 text-center justify-center flex items-center"
                >
                  {saving ? 'Đang lưu...' : editingCategory ? 'Lưu Thay Đổi' : 'Tạo Danh Mục'}
                </button>
              </div>
            </form>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                Danh sách danh mục ({filteredCategories.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">
                💡 Kéo thả biểu tượng ⋮⋮ để đổi thứ tự
              </span>
            </div>

            {filteredCategories.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-semibold">
                  {searchQuery ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredCategories.map((cat, idx) => {
                  const itemCount = products.filter((p) => p.category_id === cat.id).length;
                  const isEditing = editingCategory?.id === cat.id;
                  const isDragging = draggedIndex === idx;
                  const isDragOver = dragOverIndex === idx && draggedIndex !== idx;

                  return (
                    <div
                      key={cat.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all gap-2 cursor-move select-none ${
                        isDragging
                          ? 'opacity-40 scale-95 border-dashed border-emerald-400 bg-emerald-50/40'
                          : isDragOver
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                          : isEditing
                          ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                          {getImageUrl(cat.image_url) ? (
                            <img
                              src={getImageUrl(cat.image_url)!}
                              alt={cat.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {cat.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                              #{cat.display_order}
                            </span>
                            <span className="text-emerald-700 font-bold flex items-center gap-0.5 text-[10px]">
                              <Package className="w-3 h-3" />
                              {itemCount} món
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(cat);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                          title="Sửa danh mục"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(cat);
                          }}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Xóa danh mục"
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

        {/* Footer */}
        <div className="p-3.5 sm:px-5 sm:py-3.5 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Tổng cộng: <strong>{categories.length}</strong> danh mục
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
