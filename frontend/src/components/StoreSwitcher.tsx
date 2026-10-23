'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store as StoreIcon, ChevronDown, Check, Search, PlusCircle, Settings, Coffee, ShoppingBag, Utensils, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/StoreContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { getImageUrl } from '@/lib/api';
import { Store } from '@/types/store';

function getStoreInitials(name?: string): string {
  if (!name) return 'RP';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getBusinessBadge(type?: string, t?: (k: string) => string) {
  switch (type) {
    case 'fb':
      return { label: t ? t('storeSwitcher.business_fb') : 'F&B', color: 'bg-amber-400/20 text-amber-200 border-amber-300/30' };
    case 'retail':
      return { label: t ? t('storeSwitcher.business_retail') : 'Retail', color: 'bg-blue-400/20 text-blue-200 border-blue-300/30' };
    case 'bakery':
      return { label: t ? t('storeSwitcher.business_bakery') : 'Bakery', color: 'bg-rose-400/20 text-rose-200 border-rose-300/30' };
    default:
      return { label: t ? t('storeSwitcher.business_other') : 'POS', color: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/30' };
  }
}

export default function StoreSwitcher() {
  const { activeStore, storesList, switchStore, isSuperAdmin, isLoading } = useStore();
  const { t } = useTranslation();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canSwitch = isSuperAdmin || storesList.length > 1;

  // Filter accessible stores by search term
  const filteredStores = useMemo(() => {
    if (!searchQuery.trim()) return storesList;
    const q = searchQuery.toLowerCase();
    return storesList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.address && s.address.toLowerCase().includes(q))
    );
  }, [storesList, searchQuery]);

  // Handle outside click to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus search input when open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelectStore = (store: Store) => {
    if (store.id === activeStore?.id) {
      setIsOpen(false);
      return;
    }
    switchStore(store.id);
    setIsOpen(false);
  };

  const badge = getBusinessBadge(activeStore?.business_type, t);
  const initials = getStoreInitials(activeStore?.name);

  // If user only has access to 1 store and is not super_admin, render clean static badge
  if (!canSwitch) {
    return (
      <div className="flex items-center space-x-2 bg-emerald-800/60 border border-emerald-700/50 py-1 px-2.5 rounded-xl text-white select-none">
        {activeStore?.logo_url ? (
          <img
            src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
            alt={activeStore.name}
            className="w-5 h-5 rounded-md object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-md bg-emerald-700 text-emerald-100 font-black text-[10px] flex items-center justify-center shrink-0">
            {initials}
          </div>
        )}
        <span className="text-xs font-semibold max-w-[130px] sm:max-w-[160px] truncate leading-tight">
          {activeStore?.name || 'RabbitPOS'}
        </span>
        <span className={`hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.2 border rounded ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-emerald-800/90 hover:bg-emerald-800 border border-emerald-700/60 py-1.5 px-2.5 sm:px-3 rounded-xl transition cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-white/40 active:scale-95 text-white"
        aria-expanded={isOpen}
        title={t('storeSwitcher.switch_store') || 'Chuyển cửa hàng'}
      >
        {activeStore?.logo_url ? (
          <img
            src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
            alt={activeStore.name}
            className="w-5 h-5 rounded-md object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-md bg-emerald-700 text-emerald-100 font-black text-[10px] flex items-center justify-center shrink-0 border border-emerald-600/50">
            {initials}
          </div>
        )}

        <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-[170px]">
          <span className="font-bold text-xs leading-none truncate text-white">
            {activeStore?.name || 'RabbitPOS'}
          </span>
          <span className="text-[9px] text-emerald-200/90 uppercase font-semibold leading-tight mt-0.5 truncate">
            {activeStore?.code || badge.label}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-emerald-200 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Modal */}
      {isOpen && (
        <>
          {/* Mobile backdrop for easy dismissal */}
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 sm:hidden animate-in fade-in-0 duration-150"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed sm:absolute left-3 sm:left-0 right-3 sm:right-auto top-14 sm:top-auto sm:mt-2 w-[calc(100vw-1.5rem)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-[100] text-slate-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Header: Title & Count */}
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <StoreIcon className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-900">
                  {t('storeSwitcher.select_store') || 'Chọn cửa hàng'}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {storesList.length} {storesList.length === 1 ? 'store' : 'stores'}
              </span>
            </div>

            {/* Search Bar (if > 3 stores or search term exists) */}
            {storesList.length > 3 && (
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('storeSwitcher.search_store') || 'Tìm kiếm cửa hàng...'}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </div>
            )}

            {/* Stores List */}
            <div className="max-h-64 overflow-y-auto py-1 px-1.5 space-y-0.5">
              {filteredStores.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  {t('storeSwitcher.no_stores_found') || 'Không tìm thấy cửa hàng'}
                </div>
              ) : (
                filteredStores.map((store) => {
                  const isCurrent = store.id === activeStore?.id;
                  const itemBadge = getBusinessBadge(store.business_type, t);
                  const itemInitials = getStoreInitials(store.name);

                  return (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => handleSelectStore(store)}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer active:scale-[0.98] ${
                        isCurrent
                          ? 'bg-emerald-50/90 text-emerald-950 font-semibold border border-emerald-200/80 shadow-xs'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {/* Store Avatar */}
                      {store.logo_url ? (
                        <img
                          src={getImageUrl(store.logo_url) || store.logo_url}
                          alt={store.name}
                          className="w-8 h-8 rounded-lg object-contain bg-slate-100 border border-slate-200 shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center shrink-0 border ${
                            isCurrent
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {itemInitials}
                        </div>
                      )}

                      {/* Store Name & Meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-bold truncate text-slate-900">
                            {store.name}
                          </span>
                          {!store.is_active && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Tạm dừng
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                          <span className="font-mono text-slate-500 font-semibold">{store.code}</span>
                          <span>•</span>
                          <span className="truncate">{store.address || itemBadge.label}</span>
                        </div>
                      </div>

                      {/* Active Checkmark */}
                      {isCurrent && (
                        <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Super Admin Quick Link: Manage Stores */}
            {isSuperAdmin && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <div className="px-1.5 py-0.5">
                  <Link
                    href="/stores"
                    onClick={() => setIsOpen(false)}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer active:scale-95"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{t('storeSwitcher.manage_stores') || 'Quản lý cửa hàng'}</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
