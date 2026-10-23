'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Store, StoreRole } from '@/types/store';
import { getActiveStoreId, setActiveStoreId, saveStoreBrand } from './store';
import { getAuthUser, isAuthenticated } from './auth';
import { fetchApi } from './api';
import { clientCache } from './cache';

export interface StoreContextValue {
  activeStore: Store | null;
  storesList: Store[];
  switchStore: (storeId: number) => void;
  refreshStores: () => Promise<void>;
  isSuperAdmin: boolean;
  storeRole: StoreRole;
  isLoading: boolean;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [storesList, setStoresList] = useState<Store[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentUser = getAuthUser();
  const superAdminFlag = useMemo(() => {
    return currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  }, [currentUser?.role]);

  const refreshStores = useCallback(async () => {
    if (!isAuthenticated()) {
      setStoresList([]);
      setActiveStore(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetchApi<Store[]>('/stores', { skipCache: true });
      if (res.status === 'success' && Array.isArray(res.data)) {
        const stores = res.data;
        setStoresList(stores);

        // Resolve active store
        const savedId = getActiveStoreId();
        const user = getAuthUser();
        const defaultId = user?.default_store_id;

        let target: Store | null = null;
        if (savedId) {
          target = stores.find((s) => s.id === savedId && s.is_active) || null;
        }
        if (!target && defaultId) {
          target = stores.find((s) => s.id === defaultId && s.is_active) || null;
        }
        if (!target && stores.length > 0) {
          target = stores.find((s) => s.is_active) || stores[0];
        }

        if (target) {
          setActiveStore(target);
          setActiveStoreId(target.id);
          saveStoreBrand({
            store_id: target.id,
            store_name: target.name,
            logo_url: target.logo_url || '',
            currency_symbol: target.currency_symbol || 'đ',
          });
          if (typeof document !== 'undefined') {
            document.title = `${target.name} · RabbitPOS`;
          }
        } else {
          setActiveStore(null);
        }
      }
    } catch (err) {
      console.error('[StoreContext] Failed to load stores list:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchStore = useCallback(
    (storeId: number) => {
      const target = storesList.find((s) => s.id === storeId);
      if (!target) {
        console.warn(`[StoreContext] Cannot switch to store ID ${storeId}: not found in accessible stores`);
        return;
      }

      // 1. Persist active store ID for synchronous reads
      setActiveStoreId(target.id);

      // 2. Clear in-memory client API cache
      clientCache.invalidate();

      // 3. Save branding preview for login page
      saveStoreBrand({
        store_id: target.id,
        store_name: target.name,
        logo_url: target.logo_url || '',
        currency_symbol: target.currency_symbol || 'đ',
      });

      // 4. Update browser tab title
      if (typeof document !== 'undefined') {
        document.title = `${target.name} · RabbitPOS`;
      }

      // 5. Update state (which triggers remounting of store-scoped pages via AppShell key)
      setActiveStore(target);
    },
    [storesList]
  );

  // Compute effective role of caller inside activeStore
  const storeRole = useMemo<StoreRole>(() => {
    if (superAdminFlag) return 'super_admin';
    if (!activeStore || !currentUser?.stores) return 'staff';
    const m = currentUser.stores.find((item) => item.store_id === activeStore.id);
    return m?.role || 'staff';
  }, [superAdminFlag, activeStore, currentUser?.stores]);

  useEffect(() => {
    refreshStores();
  }, [refreshStores]);

  const value = useMemo<StoreContextValue>(
    () => ({
      activeStore,
      storesList,
      switchStore,
      refreshStores,
      isSuperAdmin: superAdminFlag,
      storeRole,
      isLoading,
    }),
    [activeStore, storesList, switchStore, refreshStores, superAdminFlag, storeRole, isLoading]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
