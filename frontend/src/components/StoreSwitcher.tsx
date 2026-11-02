'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Store as StoreIcon, ChevronDown, Check, Search, PlusCircle } from 'lucide-react';
import { useStore } from '@/lib/StoreContext';
import { useTranslation } from '@/lib/i18n/LanguageContext';
import { getImageUrl } from '@/lib/api';
import { ResponsiveSheet } from '@/components/ui';
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
      return {
        label: t ? t('storeSwitcher.business_fb') : 'F&B',
        color: 'bg-amber-50 text-amber-800 border-amber-200/80',
      };
    case 'retail':
      return {
        label: t ? t('storeSwitcher.business_retail') : 'Retail',
        color: 'bg-sky-50 text-sky-800 border-sky-200/80',
      };
    case 'bakery':
      return {
        label: t ? t('storeSwitcher.business_bakery') : 'Bakery',
        color: 'bg-rose-50 text-rose-800 border-rose-200/80',
      };
    default:
      return {
        label: t ? t('storeSwitcher.business_other') : 'POS',
        color: 'bg-brand-50 text-brand-700 border-brand-200/80',
      };
  }
}

export default function StoreSwitcher() {
  const { activeStore, storesList, switchStore, isSuperAdmin } = useStore();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
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

  // Focus search input when open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
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
    switchStore(store.id, store);
    setIsOpen(false);
  };

  const badge = getBusinessBadge(activeStore?.business_type, t);
  const initials = getStoreInitials(activeStore?.name);

  // Single-store static capsule pill on light glass-regular Top Bar
  if (!canSwitch) {
    return (
      <div className="inline-flex items-center gap-2 bg-surface-card/90 border border-card min-h-[38px] md:min-h-[36px] px-2.5 sm:px-3 rounded-full text-slate-900 shadow-card select-none max-w-[175px] sm:max-w-[230px]">
        {activeStore?.logo_url ? (
          <img
            src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
            alt={activeStore.name}
            className="w-5 h-5 rounded-full object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-caption flex items-center justify-center shrink-0">
            {initials}
          </div>
        )}
        <span className="text-footnote font-semibold truncate text-slate-900">
          {activeStore?.name || t('common.app_title')}
        </span>
        <span className={`hidden lg:inline-flex items-center text-caption font-semibold px-2 py-0.5 border rounded-full shrink-0 ${badge.color}`}>
          {badge.label}
        </span>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      {/* Capsule Trigger Button on light glass-regular Top Bar (44px mobile / 36px desktop) */}
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 bg-surface-card/90 hover:bg-surface-card border border-card min-h-[44px] md:min-h-[36px] px-2.5 sm:px-3 rounded-full text-slate-900 shadow-card transition duration-press ease-press active:scale-[0.97] cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        aria-expanded={isOpen}
        title={t('storeSwitcher.switch_store')}
      >
        {activeStore?.logo_url ? (
          <img
            src={getImageUrl(activeStore.logo_url) || activeStore.logo_url}
            alt={activeStore.name}
            className="w-5 h-5 rounded-full object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-brand-600 text-white font-bold text-caption flex items-center justify-center shrink-0">
            {initials}
          </div>
        )}

        <div className="flex flex-col min-w-0 max-w-[100px] sm:max-w-[160px]">
          <span className="font-semibold text-footnote leading-snug truncate text-slate-900">
            {activeStore?.name || t('common.app_title')}
          </span>
          <span className="hidden sm:block text-caption text-slate-500 font-medium leading-tight truncate">
            {activeStore?.code || badge.label}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-snappy ease-spring-snappy shrink-0 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {/* Tahoe ResponsiveSheet (z-75 mobile sheet / z-70 desktop anchored popover) */}
      <ResponsiveSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={triggerButtonRef}
        exclusiveId="store-switcher"
        align="start"
        width="w-80"
        title={
          <div className="flex items-center gap-2">
            <StoreIcon className="w-4 h-4 text-brand-700 shrink-0" />
            <span className="text-headline font-semibold text-slate-900">
              {t('storeSwitcher.select_store')}
            </span>
            <span className="text-caption font-semibold font-num px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {storesList.length}
            </span>
          </div>
        }
        footer={
          isSuperAdmin ? (
            <Link
              href="/stores"
              onClick={() => setIsOpen(false)}
              className="w-full min-h-[44px] md:min-h-[36px] flex items-center justify-center gap-2 px-4 py-2 text-subhead md:text-footnote font-semibold text-brand-700 bg-brand-50/80 hover:bg-brand-100/80 border border-brand-200/80 rounded-full transition duration-press ease-press cursor-pointer active:scale-[0.97]"
            >
              <PlusCircle className="w-4 h-4 text-brand-600" />
              <span>{t('storeSwitcher.manage_stores')}</span>
            </Link>
          ) : undefined
        }
      >
        {/* Capsule Search Bar (16px mobile text prevents iOS Safari zoom) */}
        {storesList.length > 3 && (
          <div className="mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('storeSwitcher.search_store')}
                className="w-full h-11 md:h-9 pl-9 pr-3.5 text-base md:text-sm bg-surface-card border border-slate-300/80 rounded-full text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/35 focus-visible:border-brand-600 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Stores List */}
        <div className="space-y-1">
          {filteredStores.length === 0 ? (
            <div className="py-6 text-center text-subhead text-slate-500 font-medium">
              {t('storeSwitcher.no_stores_found')}
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
                  className={`w-full min-h-[48px] md:min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-field text-left transition duration-press ease-press cursor-pointer active:scale-[0.98] ${isCurrent
                    ? 'bg-brand-50 text-brand-950 font-semibold border border-brand-200 shadow-card'
                    : 'hover:bg-slate-900/[0.04] text-slate-700 border border-transparent'
                    }`}
                >
                  {/* Store Avatar */}
                  {store.logo_url ? (
                    <img
                      src={getImageUrl(store.logo_url) || store.logo_url}
                      alt={store.name}
                      className="w-8 h-8 rounded-sm-tahoe object-contain bg-surface-grouped border border-card shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-sm-tahoe font-bold text-footnote flex items-center justify-center shrink-0 border ${isCurrent
                        ? 'bg-brand-600 text-white border-brand-700'
                        : 'bg-surface-grouped text-slate-700 border-card'
                        }`}
                    >
                      {itemInitials}
                    </div>
                  )}

                  {/* Store Name & Meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-subhead font-semibold truncate text-slate-900">
                        {store.name}
                      </span>
                      {!store.is_active && (
                        <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          {t('storeSwitcher.inactive_badge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-caption text-slate-500 mt-0.5 truncate">
                      <span className="font-mono text-slate-600 font-semibold">{store.code}</span>
                      <span>•</span>
                      <span className="truncate">{store.address || itemBadge.label}</span>
                    </div>
                  </div>

                  {/* Active Checkmark */}
                  {isCurrent && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </ResponsiveSheet>
    </div>
  );
}
