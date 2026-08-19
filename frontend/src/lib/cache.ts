/**
 * In-Memory Stale-While-Revalidate Client-Side Cache
 * Eliminates redundant network requests for static/semi-static entities:
 *  - Categories & Toppings: 5 minutes TTL
 *  - System Settings: 10 minutes TTL
 *  - Payment Funds: 2 minutes TTL
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();

  public get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  public set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }

  public invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.store.clear();
      return;
    }

    for (const key of this.store.keys()) {
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
  }
}

export const clientCache = new MemoryCache();

// Standard TTL presets
export const TTL = {
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
  if (endpoint === '/categories' || endpoint.startsWith('/categories?')) return TTL.CATEGORIES;
  if (endpoint === '/toppings' || endpoint.startsWith('/toppings/')) return TTL.TOPPINGS;
  if (endpoint === '/settings') return TTL.SETTINGS;
  if (endpoint === '/funds' || endpoint.startsWith('/funds?')) return TTL.FUNDS;
  if (endpoint === '/promotions/active') return TTL.PROMOTIONS;
  return null;
}
