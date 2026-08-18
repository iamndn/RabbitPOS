export interface TransactionCategory {
  id: number;
  name: string;
  type: 'outflow' | 'inflow' | 'both';
  code?: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTransactionCategoryRequest {
  name: string;
  type: 'outflow' | 'inflow' | 'both';
  code?: string;
}

export interface UpdateTransactionCategoryRequest {
  name: string;
  type: 'outflow' | 'inflow' | 'both';
}
