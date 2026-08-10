// Standardized Response Envelope matching Go Backend
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data: T;
  message: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const data: ApiResponse<T> = await response.json();

    if (!response.ok || data.status === 'error') {
      throw new Error(data.message || `HTTP Error ${response.status}`);
    }

    return data;
  } catch (err: any) {
    return {
      status: 'error',
      data: null as unknown as T,
      message: err.message || 'Network request failed',
    };
  }
}
