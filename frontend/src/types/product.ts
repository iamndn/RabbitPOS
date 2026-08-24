export interface Category {
  id: number;
  name: string;
  image_url?: string;
  display_order: number;
}

export interface ProductVariant {
  id?: number;
  product_id?: number;
  variant_name: string;
  cogs_price: number;
  retail_price: number;
  sku: string;
  is_active?: boolean;
}

export interface Product {
  id: number;
  category_id: number;
  category?: Category;
  name: string;
  description: string;
  image_url: string;
  tag: string;
  tag_locked?: boolean;
  is_active?: boolean;
  variants: ProductVariant[];
  created_at?: string;
}

export interface Topping {
  id: number;
  name: string;
  price: number;
  cogs: number;
  category_id: number | null;
  display_order?: number;
  is_active: boolean;
}
