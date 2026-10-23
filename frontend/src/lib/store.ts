/**
 * Synchronous non-React store state helpers for RabbitPOS
 * Used by api.ts, offline engine, and background sync without React context dependency.
 */

import { StoreBrandPreview } from '@/types/store';

export const ACTIVE_STORE_ID_KEY = 'rabbitpos_active_store_id';
export const LAST_STORE_BRAND_KEY = 'rabbitpos_last_store_brand';

/**
 * Retrieve the currently active store ID from localStorage synchronously.
 * Returns null if not set or running on the server.
 */
export function getActiveStoreId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_STORE_ID_KEY);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

/**
 * Persist the active store ID in localStorage.
 */
export function setActiveStoreId(storeId: number): void {
  if (typeof window === 'undefined') return;
  if (!storeId || storeId <= 0) {
    localStorage.removeItem(ACTIVE_STORE_ID_KEY);
  } else {
    localStorage.setItem(ACTIVE_STORE_ID_KEY, String(storeId));
  }
}

/**
 * Clear the active store ID from localStorage (e.g. on logout).
 */
export function clearActiveStoreId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_STORE_ID_KEY);
}

/**
 * Save lightweight branding snapshot to localStorage for display on the login screen.
 */
export function saveStoreBrand(brand: StoreBrandPreview): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_STORE_BRAND_KEY, JSON.stringify(brand));
  } catch (e) {
    // Ignore storage quota errors
  }
}

/**
 * Retrieve the last known store branding for the login page before authentication.
 */
export function getSavedStoreBrand(): StoreBrandPreview | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(LAST_STORE_BRAND_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Retrieve all known store IDs that this device or user has accessed.
 * Used by offline sync to flush pending queues across store databases.
 */
export function getKnownStoreIds(): number[] {
  if (typeof window === 'undefined') return [1];
  const set = new Set<number>();

  // 1. Current active store
  const active = getActiveStoreId();
  if (active) set.add(active);

  // 2. User profile accessible stores
  try {
    const rawUser = localStorage.getItem('rabbitpos_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user?.stores && Array.isArray(user.stores)) {
        for (const m of user.stores) {
          if (m?.store_id) set.add(Number(m.store_id));
        }
      }
    }
  } catch {}

  // 3. Always include store #1 (legacy default)
  set.add(1);

  return Array.from(set).sort((a, b) => a - b);
}

