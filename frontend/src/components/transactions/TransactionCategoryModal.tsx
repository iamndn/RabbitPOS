'use client';

import React, { useState, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Tag,
  Check,
  AlertCircle,
  FolderPlus,
  GripVertical,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { useConfirm } from '@/context/ConfirmContext';
import { TransactionCategory } from '@/types/transaction_category';
import ModernSelect from '@/components/common/ModernSelect';
import { ModalShell } from '@/components/ui/ModalShell';

interface TransactionCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: TransactionCategory[];
  onCategoriesUpdated: () => void;
}

export default function TransactionCategoryModal({
  isOpen,
  onClose,
  categories,
  onCategoriesUpdated,
}: TransactionCategoryModalProps) {
  const { t } = useTranslation();
  const { showAlert } = useConfirm();

  const [localCategories, setLocalCategories] = useState<TransactionCategory[]>(categories);
  const [activeFilter, setActiveFilter] = useState<'all' | 'outflow' | 'inflow'>('all');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<TransactionCategory | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    type: 'outflow' | 'inflow' | 'both';
    is_default: boolean;
  }>({
    name: '',
    type: 'outflow',
    is_default: false,
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Delete confirmation
  const [deletingCategory, setDeletingCategory] = useState<TransactionCategory | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const deleteSubmittingRef = useRef<boolean>(false);

  React.useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const filteredCategories = localCategories.filter((cat) => {
    if (activeFilter === 'all') return true;
    return cat.type === activeFilter || cat.type === 'both';
  });

  const handleStartAdd = () => {
    setIsEditing(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      type: activeFilter === 'all' ? 'outflow' : activeFilter,
      is_default: false,
    });
    setErrorMessage(null);
  };

  const handleStartEdit = (cat: TransactionCategory) => {
    setIsEditing(true);
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      type: cat.type,
      is_default: Boolean(cat.is_default),
    });
    setErrorMessage(null);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingCategory(null);
    setFormData({ name: '', type: 'outflow', is_default: false });
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMessage(t('tx_cat.err_name_required') || 'Tên danh mục không được để trống');
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (isEditing && editingCategory) {
        const res = await fetchApi<TransactionCategory>(`/transaction-categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });

        if (res.status === 'success' && res.data) {
          onCategoriesUpdated();
          handleCancelForm();
        } else {
          setErrorMessage(res.message || 'Cập nhật thất bại');
        }
      } else {
        const res = await fetchApi<TransactionCategory>('/transaction-categories', {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        if (res.status === 'success' && res.data) {
          onCategoriesUpdated();
          handleStartAdd();
        } else {
          setErrorMessage(res.message || 'Thêm danh mục thất bại');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Có lỗi xảy ra');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (cat: TransactionCategory) => {
    try {
      const res = await fetchApi<TransactionCategory>(`/transaction-categories/${cat.id}/default`, {
        method: 'PATCH',
      });
      if (res.status === 'success') {
        onCategoriesUpdated();
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Không thể đặt mặc định', 'danger');
      }
    } catch (err: any) {
      showAlert(t('common.error') || 'Lỗi', err.message || 'Lỗi cập nhật', 'danger');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...localCategories];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setLocalCategories(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    const reorderPayload = updated.map((c, idx) => ({
      id: c.id,
      display_order: idx + 1,
    }));

    try {
      await fetchApi('/transaction-categories/reorder', {
        method: 'PUT',
        body: JSON.stringify({ items: reorderPayload }),
      });
      onCategoriesUpdated();
    } catch {
      // rollback silently
      setLocalCategories(categories);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    if (deleteSubmittingRef.current) return;
    deleteSubmittingRef.current = true;
    setDeleteSubmitting(true);
    try {
      const res = await fetchApi(`/transaction-categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });

      if (res.status === 'success') {
        setDeletingCategory(null);
        onCategoriesUpdated();
        if (editingCategory?.id === deletingCategory.id) {
          handleCancelForm();
        }
      } else {
        showAlert(t('common.error') || 'Lỗi', res.message || 'Xóa danh mục thất bại', 'danger');
      }
    } catch (err: any) {
      showAlert(t('common.error') || 'Lỗi', err.message || 'Lỗi khi xóa danh mục', 'danger');
    } finally {
      deleteSubmittingRef.current = false;
      setDeleteSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'outflow':
        return (
          <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-rose-50 text-rose-700 border border-rose-200">
            {t('tx_cat.type_outflow') || 'Khoản chi (-)'}
          </span>
        );
      case 'inflow':
        return (
          <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-purple-50 text-brand-purple border border-purple-200">
            {t('tx_cat.type_inflow') || 'Khoản thu (+)'}
          </span>
        );
      case 'both':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-caption font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {t('tx_cat.type_both') || 'Cả hai (+/-)'}
          </span>
        );
    }
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={t('tx_cat.modal_title') || 'Danh mục Thu / Chi'}
        description={t('tx_cat.modal_subtitle') || 'Tạo, chỉnh sửa và quản lý các danh mục phân loại thu chi.'}
        icon={<Tag className="w-5 h-5 text-brand-purple" />}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer text-center justify-center flex items-center"
            >
              {t('common.close') || 'Đóng'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Add / Edit Form Box */}
          <div className="surface-card border border-card rounded-2xl p-4 space-y-3 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                {isEditing ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-brand-purple" />
                    <span>{t('tx_cat.edit_category_title') || 'Chỉnh sửa danh mục'}</span>
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-3.5 h-3.5 text-brand-purple" />
                    <span>{t('tx_cat.add_category_title') || 'Thêm danh mục mới'}</span>
                  </>
                )}
              </h3>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  {t('common.cancel') || 'Hủy'}
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-7">
                  <label className="app-label">
                    {t('tx_cat.name_label') || 'Tên danh mục'} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={t('tx_cat.name_placeholder') || 'VD: Tiền thuê mặt bằng, Tiền nhân công...'}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="app-input text-xs"
                  />
                </div>

                <div className="sm:col-span-5">
                  <label className="app-label">
                    {t('tx_cat.type_label') || 'Loại giao dịch'} *
                  </label>
                  <ModernSelect
                    size="sm"
                    value={formData.type}
                    onChange={(val) => setFormData({ ...formData, type: val as any })}
                    options={[
                      { value: 'outflow', label: t('tx_cat.type_outflow') || 'Khoản chi (-)', badge: '-', badgeColor: 'rose' },
                      { value: 'inflow', label: t('tx_cat.type_inflow') || 'Khoản thu (+)', badge: '+', badgeColor: 'purple' },
                      { value: 'both', label: t('tx_cat.type_both') || 'Cả hai (+/-)', badge: '+/-', badgeColor: 'indigo' },
                    ]}
                  />
                </div>
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">
                  ⭐ Đặt làm danh mục mặc định cho {formData.type === 'inflow' ? 'Khoản thu' : formData.type === 'outflow' ? 'Khoản chi' : 'Thu & Chi'}
                </span>
              </label>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-purple hover:bg-purple-700 disabled:opacity-50 rounded-full shadow-card flex items-center space-x-1.5 transition cursor-pointer"
                >
                  {isEditing ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Đang lưu...' : t('common.save') || 'Lưu thay đổi'}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Đang thêm...' : t('tx_cat.add_btn') || 'Thêm danh mục'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Categories List Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {t('tx_cat.category_list_title') || 'Danh sách danh mục'} ({filteredCategories.length})
              </h3>

              {/* Type Filter Pills */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-full">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    activeFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-card'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t('common.all') || 'Tất cả'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('outflow')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    activeFilter === 'outflow'
                      ? 'bg-white text-rose-600 shadow-card'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t('tx.outflows') || 'Khoản chi'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('inflow')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    activeFilter === 'inflow'
                      ? 'bg-white text-brand-purple shadow-card'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t('tx.inflows') || 'Khoản thu'}
                </button>
              </div>
            </div>

            {/* Categories Table / List */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
              <span>💡 Kéo thả biểu tượng ⋮⋮ để sắp xếp thứ tự danh mục</span>
            </div>
            <div className="border border-card rounded-2xl overflow-hidden divide-y divide-slate-100 surface-card shadow-card">
              {filteredCategories.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {t('tx_cat.no_categories') || 'Chưa có danh mục nào trong nhóm này.'}
                </div>
              ) : (
                filteredCategories.map((cat, idx) => {
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
                      className={`p-3.5 flex items-center justify-between transition group cursor-move select-none ${
                        isDragging
                          ? 'opacity-40 bg-purple-50/40 border-dashed border-purple-400'
                          : isDragOver
                          ? 'bg-purple-50/30 ring-2 ring-purple-500/20'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <GripVertical className="w-4 h-4 text-slate-300 group-hover:text-slate-500 shrink-0 cursor-grab active:cursor-grabbing" />
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-xs font-bold text-slate-800">{cat.name}</span>
                            {cat.is_default && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-caption font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <span>⭐ Mặc định</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            {getTypeBadge(cat.type)}
                            {cat.code && (
                              <span className="text-caption text-slate-400 font-mono font-num">
                                #{cat.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        {!cat.is_default && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(cat);
                            }}
                            className="px-2.5 py-1 text-caption font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition flex items-center gap-1 cursor-pointer"
                            title="Đặt làm danh mục mặc định"
                          >
                            <span>⭐ Đặt mặc định</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(cat);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-purple hover:bg-purple-50 rounded-lg transition cursor-pointer"
                          title={t('common.edit') || 'Chỉnh sửa'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCategory(cat);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title={t('common.delete') || 'Xóa'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </ModalShell>

      {/* Delete Confirmation Modal (Nested z-60) */}
      <ModalShell
        isOpen={Boolean(deletingCategory)}
        onClose={() => !deleteSubmitting && setDeletingCategory(null)}
        nested={true}
        size="sm"
        title={t('tx_cat.confirm_delete_title') || 'Xác nhận xóa danh mục'}
        description={deletingCategory?.name}
        icon={<Trash2 className="w-5 h-5 text-rose-600" />}
        preventClose={deleteSubmitting}
        footer={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:space-x-2">
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={() => setDeletingCategory(null)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition cursor-pointer text-center justify-center flex items-center"
            >
              {t('common.cancel') || 'Hủy'}
            </button>
            <button
              type="button"
              disabled={deleteSubmitting}
              onClick={handleDelete}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-full shadow-card transition cursor-pointer text-center justify-center flex items-center"
            >
              {deleteSubmitting ? 'Đang xóa...' : t('common.delete') || 'Xóa danh mục'}
            </button>
          </div>
        }
      >
        <p className="text-xs text-slate-600 leading-relaxed">
          {t('tx_cat.confirm_delete_desc') ||
            'Bạn có chắc chắn muốn xóa danh mục này? Các giao dịch lịch sử đã ghi nhận vẫn sẽ được giữ nguyên tên.'}
        </p>
      </ModalShell>
    </>
  );
}
