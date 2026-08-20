import { logout } from './auth';
import { clientCache, getDefaultTtlForEndpoint } from './cache';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T | null;
  message: string;
}

declare const process: {
  env: {
    NEXT_PUBLIC_API_URL?: string;
  };
};

export function getApiBaseUrl(): string {
  const envUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL?.trim() : undefined;

  // Sanitize any legacy 2-level subdomain api.rabbitpos.ndnworks.com -> single-level rabbitpos-api.ndnworks.com
  let cleanEnvUrl = envUrl ? envUrl.replace('api.rabbitpos.ndnworks.com', 'rabbitpos-api.ndnworks.com') : undefined;

  // Dynamic resolution on client-side (in browser)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol || 'http:';

    // 1. Localhost or LAN IP access (e.g. localhost, 127.0.0.1, 10.0.0.10, 192.168.x.x)
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);

    if (isLocalhost || isIpAddress) {
      return `http://${hostname}:8080/api/v1`;
    }

    // 2. Production domain access (e.g. rabbitpos.ndnworks.com or ndnworks.com)
    if (hostname.includes('ndnworks.com') || hostname.includes('rabbitpos')) {
      return 'https://rabbitpos-api.ndnworks.com/api/v1';
    }

    // 3. Fallback for custom domains if valid clean absolute URL is provided in env
    if (cleanEnvUrl && cleanEnvUrl !== '' && (cleanEnvUrl.startsWith('http://') || cleanEnvUrl.startsWith('https://'))) {
      return cleanEnvUrl;
    }

    return `${protocol}//${hostname}:8080/api/v1`;
  }

  // SSR / Build-time fallback
  if (cleanEnvUrl && cleanEnvUrl !== '' && (cleanEnvUrl.startsWith('http://') || cleanEnvUrl.startsWith('https://'))) {
    return cleanEnvUrl;
  }

  return 'https://rabbitpos-api.ndnworks.com/api/v1';
}

export interface FetchApiOptions extends RequestInit {
  cacheTtl?: number | null; // Set specific TTL, or false/null to bypass cache
  skipCache?: boolean;
}

export async function fetchApi<T>(
  endpoint: string,
  options: FetchApiOptions = {}
): Promise<ApiResponse<T>> {
  const method = (options.method || 'GET').toUpperCase();

  // 1. Check in-memory cache for GET requests
  if (method === 'GET' && !options.skipCache) {
    const ttl = options.cacheTtl !== undefined ? options.cacheTtl : getDefaultTtlForEndpoint(endpoint);
    if (ttl && ttl > 0) {
      const cached = clientCache.get<ApiResponse<T>>(endpoint);
      if (cached) {
        return cached;
      }
    }
  }

  const baseUrl = getApiBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (res.status === 401 && endpoint !== '/auth/login') {
      logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    const data: ApiResponse<T> = await res.json();

    // 2. Populate cache on successful GET
    if (method === 'GET' && data.status === 'success' && !options.skipCache) {
      const ttl = options.cacheTtl !== undefined ? options.cacheTtl : getDefaultTtlForEndpoint(endpoint);
      if (ttl && ttl > 0) {
        clientCache.set(endpoint, data, ttl);
      }
    }

    // 3. Invalidate relevant caches on mutation methods (POST, PUT, DELETE)
    if (method !== 'GET' && data.status === 'success') {
      if (endpoint.includes('/categories')) clientCache.invalidate('categories');
      if (endpoint.includes('/toppings')) clientCache.invalidate('toppings');
      if (endpoint.includes('/settings')) clientCache.invalidate('settings');
      if (endpoint.includes('/funds') || endpoint.includes('/orders') || endpoint.includes('/transactions')) {
        clientCache.invalidate('funds');
      }
      if (endpoint.includes('/promotions')) clientCache.invalidate('promotions');
    }

    return data;
  } catch (error: any) {
    return {
      status: 'error',
      data: null,
      message: error?.message || 'Network communication error',
    };
  }
}

export function getImageUrl(url?: string | null): string | null {
  if (!url || url.trim() === '') return null;
  let trimmed = url.trim().replace('api.rabbitpos.ndnworks.com', 'rabbitpos-api.ndnworks.com');

  // Convert Google Drive view links to direct image CDN links
  const gDriveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?.*id=)([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && gDriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // If it's a frontend public asset (e.g. /logo.png, /favicon.ico, /icon.png, /images/...)
  // and does not start with /uploads, return as-is for frontend domain serving
  if (!trimmed.startsWith('/uploads') && !trimmed.startsWith('uploads/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // If in browser on production domain and is an uploaded media file (/uploads/...)
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    if (hostname.includes('ndnworks.com') || hostname.includes('rabbitpos')) {
      const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      return `https://rabbitpos-api.ndnworks.com${path}`;
    }
  }

  const apiBase = getApiBaseUrl();
  // Relative API base: serve upload from same origin
  if (apiBase.startsWith('/')) {
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  // Absolute API base: strip trailing /api/v1 and prefix
  const origin = apiBase.replace(/\/api\/v1\/?$/, '');
  return `${origin}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export async function uploadImage(file: File): Promise<ApiResponse<{ url: string }>> {
  const baseUrl = getApiBaseUrl();
  const token = typeof window !== 'undefined' ? localStorage.getItem('rabbitpos_jwt_token') : null;

  const formData = new FormData();
  formData.append('image', file);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

    const data: ApiResponse<{ url: string }> = await res.json();
    return data;
  } catch (error: any) {
    return {
      status: 'error',
      data: null,
      message: error?.message || 'Failed to upload image file',
    };
  }
}
