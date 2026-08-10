export interface UserInfo {
  id: number;
  username: string;
  role: 'admin' | 'staff';
  is_active: boolean;
}

const TOKEN_KEY = 'rabbitpos_jwt_token';
const USER_KEY = 'rabbitpos_user';

export function setAuth(token: string, user: UserInfo) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function getAuthUser(): UserInfo | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getAuthUser();
  return user?.role === 'admin';
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
