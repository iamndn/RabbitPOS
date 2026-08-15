import { logout } from './auth';

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

    // 2. Production domain (e.g. ndnworks.com or rabbitpos)
    if (hostname.includes('ndnworks.com') || hostname.includes('rabbitpos')) {
      if (hostname.startsWith('api.')) {
        return `https://${hostname}/api/v1`;
      }
      return `https://api.${hostname}/api/v1`;
    }

    // 3. Fallback for custom domains if valid absolute NEXT_PUBLIC_API_URL is present
    if (envUrl && envUrl !== '' && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
      return envUrl;
    }

    return `${protocol}//${hostname}:8080/api/v1`;
  }

  // SSR / Build-time fallback
  if (envUrl && envUrl !== '' && (envUrl.startsWith('http://') || envUrl.startsWith('https://'))) {
    return envUrl;
  }

  return 'http://localhost:8080/api/v1';
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
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
  const trimmed = url.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
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
