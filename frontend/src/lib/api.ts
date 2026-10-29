import { logout } from './auth';
import { clientCache, getDefaultTtlForEndpoint } from './cache';
import { getActiveStoreId } from './store';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  error_code?: string;
}

declare const process: {
  env: {
    NEXT_PUBLIC_API_URL?: string;
    INTERNAL_API_URL?: string;
    INTERNAL_BACKEND_URL?: string;
  };
};

export function getApiBaseUrl(): string {
  // Dynamic resolution on client-side (in browser):
  // Relative /api/v1 routes through the Same-Origin Next.js rewrite proxy (port 3000 / 443).
  // This eliminates all CORS issues, mixed-content errors, and domain/IP mismatches
  // whether accessed via localhost:3000, LAN IP (e.g. 10.0.0.10:3000), or Cloudflare domain.
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }

  // SSR / Build-time internal resolution
  const internalUrl = process.env.INTERNAL_API_URL || process.env.INTERNAL_BACKEND_URL;
  if (internalUrl) {
    return `${internalUrl.replace(/\/$/, '')}/api/v1`;
  }

  const envUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL?.trim() : undefined;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl;
  }

  return 'http://127.0.0.1:8080/api/v1';
}

/**
 * Returns standard authentication and store context headers.
 * Safe to pass to both fetchApi and raw fetch() requests (e.g. file exports or multipart uploads).
 */
export function authHeaders(customStoreId?: number | null): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const storeId = customStoreId !== undefined ? customStoreId : getActiveStoreId();
  if (storeId) {
    headers['X-Store-ID'] = String(storeId);
  }
  return headers;
}

/**
 * Appends `store_id` query parameter to direct download or QR image URLs.
 */
export function appendStoreParam(url: string, customStoreId?: number | null): string {
  const storeId = customStoreId !== undefined ? customStoreId : getActiveStoreId();
  if (!storeId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}store_id=${storeId}`;
}

export interface FetchApiOptions extends RequestInit {
  cacheTtl?: number | null; // Set specific TTL, or false/null to bypass cache
  skipCache?: boolean;
  storeId?: number | null; // Override active store ID for this request
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchApiOptions = {}
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();
  const activeStoreId = options.storeId !== undefined ? options.storeId : getActiveStoreId();

  // 1. Check in-memory cache for GET requests
  if (method === 'GET' && !options.skipCache) {
    const ttl = options.cacheTtl !== undefined ? options.cacheTtl : getDefaultTtlForEndpoint(endpoint);
    if (ttl && ttl > 0) {
      const cached = clientCache.get<ApiResponse<T>>(endpoint, activeStoreId);
      if (cached) {
        return cached;
      }
    }
  }

  const isAuthEndpoint =
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/register') ||
    endpoint.startsWith('/auth/setup-password');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(isAuthEndpoint ? null : activeStoreId),
    ...(options.headers as Record<string, string>),
  };
  // Ensure public authentication endpoints do NOT require or send X-Store-ID
  if (isAuthEndpoint) {
    delete headers['X-Store-ID'];
  }

  const baseUrl = getApiBaseUrl();

  const executeFetch = async (targetUrl: string) => {
    return await fetch(targetUrl, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  try {
    let res: Response;

    try {
      res = await executeFetch(`${baseUrl}${endpoint}`);
      // If relative proxy returns 500/502/503/504/404 on client side, wait briefly and retry once
      if (typeof window !== 'undefined' && (res.status >= 500 || res.status === 404) && baseUrl.startsWith('/')) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        try {
          const retryRes = await executeFetch(`${baseUrl}${endpoint}`);
          if (retryRes.ok || retryRes.status < 500) {
            res = retryRes;
          } else {
            const fallbackBase = `http://${window.location.hostname}:8080/api/v1`;
            const fallbackRes = await executeFetch(`${fallbackBase}${endpoint}`);
            if (fallbackRes.ok || fallbackRes.status < 500) {
              res = fallbackRes;
            }
          }
        } catch {
          // Keep original response if retry/fallback unreachable
        }
      }
    } catch (networkErr: any) {
      // If relative call fails due to proxy disconnect, retry once against backend port 8080 directly
      if (typeof window !== 'undefined' && baseUrl.startsWith('/')) {
        const fallbackBase = `http://${window.location.hostname}:8080/api/v1`;
        try {
          res = await executeFetch(`${fallbackBase}${endpoint}`);
        } catch {
          throw networkErr;
        }
      } else {
        throw networkErr;
      }
    }

    if (res.status === 401 && !isAuthEndpoint) {
      logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    let data: ApiResponse<T>;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = {
          status: 'error',
          data: null,
          message: res.status >= 500
            ? 'Máy chủ đang khởi động hoặc tạm thời gián đoạn. Vui lòng thử lại sau giây lát.'
            : `Định dạng phản hồi không hợp lệ từ máy chủ (HTTP ${res.status}).`,
        };
      }
    } else {
      const rawText = await res.text().catch(() => '');
      data = {
        status: 'error',
        data: null,
        message: res.status >= 500
          ? 'Máy chủ đang khởi động hoặc tạm thời gián đoạn. Vui lòng thử lại sau giây lát.'
          : (rawText && rawText.length < 150 ? rawText : `Lỗi máy chủ (HTTP ${res.status}). Vui lòng thử lại sau giây lát.`),
      };
    }

    // 2. Populate cache on successful GET
    if (method === 'GET' && data.status === 'success' && !options.skipCache) {
      const ttl = options.cacheTtl !== undefined ? options.cacheTtl : getDefaultTtlForEndpoint(endpoint);
      if (ttl && ttl > 0) {
        clientCache.set(endpoint, data, ttl, activeStoreId);
      }
    }

    // 3. Invalidate relevant caches on mutation methods (POST, PUT, DELETE)
    if (method !== 'GET' && data.status === 'success') {
      if (endpoint.includes('/products')) clientCache.invalidate('products', activeStoreId);
      if (endpoint.includes('/categories')) clientCache.invalidate('categories', activeStoreId);
      if (endpoint.includes('/toppings')) clientCache.invalidate('toppings', activeStoreId);
      if (endpoint.includes('/settings')) clientCache.invalidate('settings', activeStoreId);
      if (endpoint.includes('/funds') || endpoint.includes('/orders') || endpoint.includes('/transactions')) {
        clientCache.invalidate('funds', activeStoreId);
      }
      if (endpoint.includes('/promotions')) clientCache.invalidate('promotions', activeStoreId);
    }

    return data;
  } catch (error: any) {
    let friendlyMessage = error?.message || 'Lỗi kết nối máy chủ';
    if (
      friendlyMessage.includes('Failed to fetch') ||
      friendlyMessage.includes('NetworkError') ||
      friendlyMessage.includes('Load failed')
    ) {
      friendlyMessage = 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng hoặc thử lại sau.';
    } else if (
      friendlyMessage.includes('Unexpected token') ||
      friendlyMessage.includes('JSON') ||
      friendlyMessage.includes('is not valid JSON') ||
      friendlyMessage.includes('Internal Server Error')
    ) {
      friendlyMessage = 'Máy chủ đang khởi động hoặc tạm thời gián đoạn. Vui lòng thử lại sau giây lát.';
    }
    return {
      status: 'error',
      data: null,
      message: friendlyMessage,
    };
  }
}

export function getImageUrl(url?: string | null): string | null {
  if (!url || url.trim() === '') return null;
  const trimmed = url.trim();

  // Convert Google Drive view links to direct image CDN links
  const gDriveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Uploaded media or frontend public assets served directly via Next.js proxy/static
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function uploadImage(file: File): Promise<ApiResponse<{ url: string }>> {
  const baseUrl = getApiBaseUrl();

  const formData = new FormData();
  formData.append('image', file);

  const headers = authHeaders();

  try {
    const res = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });

    if (res.status === 401) {
      logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    let data: ApiResponse<{ url: string }>;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch {
        data = {
          status: 'error',
          data: null,
          message: 'Máy chủ phản hồi không đúng định dạng JSON khi tải ảnh lên.',
        };
      }
    } else {
      const rawText = await res.text().catch(() => '');
      data = {
        status: 'error',
        data: null,
        message: res.status >= 500
          ? 'Máy chủ đang bận khi tải ảnh lên. Vui lòng thử lại sau giây lát.'
          : (rawText || `Lỗi tải ảnh lên (HTTP ${res.status})`),
      };
    }
    return data;
  } catch (error: any) {
    let friendlyMessage = error?.message || 'Không thể tải lên tệp hình ảnh';
    if (
      friendlyMessage.includes('Failed to fetch') ||
      friendlyMessage.includes('NetworkError') ||
      friendlyMessage.includes('Load failed')
    ) {
      friendlyMessage = 'Không thể kết nối máy chủ để tải ảnh lên.';
    } else if (
      friendlyMessage.includes('Unexpected token') ||
      friendlyMessage.includes('JSON') ||
      friendlyMessage.includes('is not valid JSON') ||
      friendlyMessage.includes('Internal Server Error')
    ) {
      friendlyMessage = 'Máy chủ đang khởi động hoặc tạm thời gián đoạn khi tải ảnh lên. Vui lòng thử lại.';
    }
    return {
      status: 'error',
      data: null,
      message: friendlyMessage,
    };
  }
}
