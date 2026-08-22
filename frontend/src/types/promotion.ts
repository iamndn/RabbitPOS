export type PromoType = 'discount_amount' | 'discount_percent' | 'gift_item';
export type PromoScope = 'all' | 'category' | 'product';

export interface Promotion {
  id: number;
  name: string;
  promo_type: PromoType;
  discount_value: number;
  min_order_amount: number;
  min_quantity: number;
  scope: PromoScope;
  target_ids: string;
  gift_product_variant_id?: number | null;
  gift_variant?: {
    id: number;
    variant_name: string;
    retail_price: number;
  };
  start_date?: string | null;
  end_date?: string | null;
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
  created_at?: string;
}
