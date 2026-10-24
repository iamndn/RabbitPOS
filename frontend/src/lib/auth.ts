import { StoreMembership } from '@/types/store';
import { clearActiveStoreId } from './store';

export type UserRole = 'master' | 'owner' | 'staff' | 'admin' | 'super_admin';

export interface UserInfo {
  id: number;
  username: string;
  full_name?: string;
  phone?: string;
  email?: string;
  role: UserRole;
  is_active: boolean;
  has_pin?: boolean;
  stores?: StoreMembership[];
  default_store_id?: number;
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

export function isMasterRole(role?: string): boolean {
  return role === 'master' || role === 'super_admin' || role === 'admin';
}

export function isOwnerRole(role?: string): boolean {
  return role === 'owner' || role === 'store_admin';
}

export function isStaffRole(role?: string): boolean {
  return role === 'staff' || role === 'cashier';
}

export function isAdmin(): boolean {
  const user = getAuthUser();
  return isMasterRole(user?.role) || isOwnerRole(user?.role);
}

export function isSuperAdmin(): boolean {
  const user = getAuthUser();
  return isMasterRole(user?.role);
}

export function canManageUsers(): boolean {
  const user = getAuthUser();
  return isMasterRole(user?.role) || isOwnerRole(user?.role);
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    clearActiveStoreId();
  }
}
