'use client';

import React, { useEffect, useRef } from 'react';
import {
  Trash2,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ConfirmOptions, ConfirmType } from '@/types/confirm';
import { useTranslation } from '@/lib/i18n/LanguageContext';

interface ConfirmModalProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  options,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen || !options) return;

    // Manage button focus
    const timer = setTimeout(() => {
      if (options.autoFocusButton === 'cancel') {
        cancelBtnRef.current?.focus();
      } else {
        confirmBtnRef.current?.focus();
      }
    }, 50);

    // Keyboard listener for Escape & Enter
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Prevent accidental double enter if active element is a button
        if (document.activeElement?.tagName === 'BUTTON') return;
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, options, onConfirm, onCancel]);

  if (!isOpen || !options) return null;

  const type: ConfirmType = options.type || 'info';

  const renderIcon = () => {
    if (options.icon) return options.icon;

    switch (type) {
      case 'danger':
        return <Trash2 className="w-6 h-6 text-rose-600 animate-pulse" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getBadgeStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-100 border-rose-200 text-rose-700';
      case 'warning':
        return 'bg-amber-100 border-amber-200 text-amber-700';
      case 'success':
        return 'bg-emerald-100 border-emerald-200 text-emerald-700';
      case 'info':
      default:
        return 'bg-blue-100 border-blue-200 text-blue-700';
    }
  };

  const getConfirmBtnStyle = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white shadow-sm active:scale-98';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 text-white shadow-sm active:scale-98';
      case 'success':
        return 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-500 text-white shadow-sm active:scale-98';
      case 'info':
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white shadow-sm active:scale-98';
    }
  };

  const defaultConfirmText = () => {
    if (options.confirmText) return options.confirmText;
    if (options.isAlert) return t('common.close') || 'Đóng';
    switch (type) {
      case 'danger':
        return t('common.delete') || 'Xóa';
      case 'warning':
        return t('common.confirm') || 'Xác nhận';
      case 'success':
        return t('common.ok') || 'Đồng ý';
      case 'info':
      default:
        return t('common.confirm') || 'Xác nhận';
    }
  };

  const defaultCancelText = () => {
    return options.cancelText || t('common.cancel') || 'Hủy bỏ';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-full md:max-w-md bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all duration-200 animate-slideUp md:animate-scaleIn pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Bar */}
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        {/* Close Button Top Right */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {/* Type Badge Icon */}
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${getBadgeStyle()} shadow-xs`}
            >
              {renderIcon()}
            </div>

            {/* Title & Message */}
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                {options.title}
              </h3>
              {options.message && (
                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                  {options.message}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className={`mt-6 pt-4 border-t border-slate-100 ${
            options.isAlert ? 'flex justify-end' : 'grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3'
          }`}>
            {!options.isAlert && (
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={onCancel}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300 transition active:scale-98 text-center justify-center flex items-center"
              >
                {defaultCancelText()}
              </button>
            )}
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 transition text-center justify-center flex items-center ${getConfirmBtnStyle()}`}
            >
              {defaultConfirmText()}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
