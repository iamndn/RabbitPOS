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
