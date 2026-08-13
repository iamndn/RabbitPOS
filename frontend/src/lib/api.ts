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
  // NEXT_PUBLIC_API_URL is baked into the build artifact at compile time.
  // If set, it is always correct for this build — use it unconditionally.
  const envUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL?.trim() : undefined;
  if (envUrl && envUrl !== '') {
    return envUrl;
  }

  // Fallback: dynamically derive API URL from the current window hostname.
  // This path is only reached when NEXT_PUBLIC_API_URL was not set at build time.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname;
    // Production domain pattern: prepend 'api.' subdomain
    if (hostname.includes('ndnworks.com') || hostname.includes('rabbitpos')) {
      return `https://api.${hostname}/api/v1`;
    }
    // Local / Headscale IP access: same host, port 8080
    return `${protocol}//${hostname}:8080/api/v1`;
  }

  // Last resort local development fallback
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
  const apiBase = getApiBaseUrl();
  const origin = apiBase.replace(/\/api\/v1\/?$/, '');

  if (trimmed.includes(':3000/uploads/')) {
    return trimmed.replace(/^https?:\/\/[^\/]+:3000/, origin);
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
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
