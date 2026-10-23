/**
 * Store & Multi-Store Domain Types for RabbitPOS Frontend
 */

export type StoreRole = 'super_admin' | 'store_admin' | 'staff';

export type StoreBusinessType = 'fnb' | 'cafe' | 'retail' | 'bakery' | 'other';
export type CurrencyPosition = 'prefix' | 'suffix';

export interface Store {
  id: number;
  code: string;
  name: string;
  business_type: StoreBusinessType | string;
  logo_url: string;
  address: string;
  phone: string;
  currency_code: string;
  currency_symbol: string;
  currency_position: CurrencyPosition;
  vietqr_bank_id: string;
  vietqr_account_no: string;
  vietqr_account_name: string;
  timezone: string;
  is_active: boolean;
  member_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StoreMembership {
  store_id: number;
  store_code: string;
  store_name: string;
  role: StoreRole;
  is_default: boolean;
}

export interface StoreMemberUser {
  user_id: number;
  username: string;
  role: StoreRole;
  is_default: boolean;
  created_at?: string;
}

export interface StoreBrandPreview {
  store_id: number;
  store_name: string;
  logo_url: string;
  currency_symbol: string;
}

export interface CloneMenuOptions {
  categories: boolean;
  products: boolean;
  variants: boolean;
  toppings: boolean;
  promotions: boolean;
  recipes: boolean;
}

export interface StoreMemberInput {
  user_id: number;
  role: StoreRole;
  is_default?: boolean;
}

export interface CreateStoreRequest {
  code: string;
  name: string;
  business_type?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_position?: CurrencyPosition;
  vietqr_bank_id?: string;
  vietqr_account_no?: string;
  vietqr_account_name?: string;
  timezone?: string;
  clone_from_store_id?: number | null;
  clone_options?: CloneMenuOptions;
  members?: StoreMemberInput[];
}

export interface UpdateStoreRequest {
  code?: string;
  name?: string;
  business_type?: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  currency_code?: string;
  currency_symbol?: string;
  currency_position?: CurrencyPosition;
  vietqr_bank_id?: string;
  vietqr_account_no?: string;
  vietqr_account_name?: string;
  timezone?: string;
  is_active?: boolean;
}

export interface StoreMemberResponse {
  user_id: number;
  username: string;
  email: string;
  global_role: string;
  is_active: boolean;
  needs_password_setup: boolean;
  role: StoreRole;
  is_default: boolean;
}

export interface UserMembership {
  store_id: number;
  role: StoreRole;
  is_default: boolean;
}

export interface UserListItem {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  needs_password_setup: boolean;
  memberships: UserMembership[];
}

export interface CreateUserRequest {
  username: string;
  full_name?: string;
  email?: string;
  role: StoreRole;
  temp_password?: string;
  memberships?: UserMembership[];
}

export interface StoreOverviewItem {
  store_id: number;
  store_name: string;
  store_code: string;
  business_type: string;
  is_active: boolean;
  currency: string;
  today_revenue: number;
  today_orders: number;
  month_revenue: number;
  month_orders: number;
  range_revenue?: number;
  range_orders?: number;
  range_aov?: number;
  range_profit?: number;
}

export interface OverviewAllStoresResponse {
  total_stores: number;
  active_stores: number;
  total_staff_count?: number;
  total_today_revenue: number;
  total_today_orders: number;
  total_month_revenue: number;
  total_month_orders: number;
  total_range_revenue?: number;
  total_range_orders?: number;
  total_range_profit?: number;
  stores: StoreOverviewItem[];
}
