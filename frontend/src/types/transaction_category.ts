export interface TransactionCategory {
  id: number;
  name: string;
  type: 'outflow' | 'inflow' | 'both';
  code?: string;
  display_order?: number;
  is_default?: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionCategoryRequest {
  name: string;
  type: 'outflow' | 'inflow' | 'both';
  code?: string;
  display_order?: number;
  is_default?: boolean;
}

export interface UpdateTransactionCategoryRequest {
  name: string;
  type: 'outflow' | 'inflow' | 'both';
  display_order?: number;
  is_default?: boolean;
}
