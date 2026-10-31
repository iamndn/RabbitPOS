/**
 * In-Memory Stale-While-Revalidate Client-Side Cache
 * Namespaced by store ID (`s${storeId}:${endpoint}`) for multi-tenant isolation.
 *
 * Eliminates redundant network requests for static/semi-static entities:
 *  - Categories & Toppings: 5 minutes TTL
 *  - System Settings: 10 minutes TTL
 *  - Payment Funds: 2 minutes TTL
 */

import { getActiveStoreId } from './store';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function isPlatformEndpoint(endpoint: string): boolean {
  return (
    endpoint.startsWith('/auth') ||
    endpoint.startsWith('/stores') ||
    endpoint.startsWith('/users') ||
    endpoint.startsWith('/backup') ||
    endpoint === '/analytics/overview-all-stores'
  );
}

export function buildCacheKey(endpoint: string, storeId?: number | null): string {
  if (isPlatformEndpoint(endpoint)) {
    return endpoint;
  }
  const sid = storeId !== undefined ? storeId : getActiveStoreId();
  return sid ? `s${sid}:${endpoint}` : endpoint;
}

type InvalidationListener = (pattern?: string | RegExp, storeId?: number | null) => void;

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private listeners: InvalidationListener[] = [];

  public onInvalidate(listener: InvalidationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public get<T>(key: string, storeId?: number | null): T | null {
    const fullKey = buildCacheKey(key, storeId);
    const entry = this.store.get(fullKey);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.store.delete(fullKey);
      return null;
    }

    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs: number, storeId?: number | null): void {
    const fullKey = buildCacheKey(key, storeId);
    this.store.set(fullKey, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  public invalidate(pattern?: string | RegExp, storeId?: number | null): void {
    if (!pattern && !storeId) {
      this.store.clear();
      this.listeners.forEach((l) => l(pattern, storeId));
      return;
    }

    const sidPrefix = storeId ? `s${storeId}:` : '';

    for (const key of this.store.keys()) {
      if (sidPrefix && !key.startsWith(sidPrefix)) {
        continue;
      }

      if (!pattern) {
        this.store.delete(key);
        continue;
      }

      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.store.delete(key);
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(key)) {
          this.store.delete(key);
        }
      }
    }

    this.listeners.forEach((l) => l(pattern, storeId));
  }

  public clear(): void {
    this.store.clear();
    this.listeners.forEach((l) => l());
  }
}

export const clientCache = new MemoryCache();

// Standard TTL presets
export const TTL = {
  PRODUCTS: 3 * 60 * 1000,   // 3 minutes
  CATEGORIES: 5 * 60 * 1000, // 5 minutes
  TOPPINGS: 5 * 60 * 1000,   // 5 minutes
  SETTINGS: 10 * 60 * 1000,  // 10 minutes
  FUNDS: 2 * 60 * 1000,      // 2 minutes
  PROMOTIONS: 3 * 60 * 1000, // 3 minutes
};

/**
 * Determine default cache TTL based on endpoint pattern
 */
export function getDefaultTtlForEndpoint(endpoint: string): number | null {
  if (endpoint === '/products' || endpoint.startsWith('/products?')) return TTL.PRODUCTS;
  if (endpoint === '/categories' || endpoint.startsWith('/categories?')) return TTL.CATEGORIES;
  if (endpoint === '/toppings' || endpoint.startsWith('/toppings/') || endpoint.startsWith('/toppings?')) return TTL.TOPPINGS;
  if (endpoint === '/settings/store' || endpoint === '/settings') return TTL.SETTINGS;
  if (endpoint === '/funds' || endpoint.startsWith('/funds?')) return TTL.FUNDS;
  if (endpoint === '/promotions/active') return TTL.PROMOTIONS;
  return null;
}
