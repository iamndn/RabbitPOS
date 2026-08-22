export interface Ingredient {
  id: number;
  name: string;
  category: 'fruit' | 'ingredient' | 'packaging' | 'other' | string;
  unit: string;
  latest_purchase_price: number;
  average_purchase_price: number;
  yield_rate: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id?: number;
  transaction_id?: number;
  ingredient_id?: number;
  ingredient?: Ingredient;
  ingredient_name?: string;
  category?: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  subtotal: number;
  created_at?: string;
}

export interface RecipeItem {
  id?: number;
  product_variant_id?: number;
  topping_id?: number;
  ingredient_id: number;
  ingredient?: Ingredient;
  usage_quantity: number;
  created_at?: string;
  updated_at?: string;
}

export interface RecipeDetailItem {
  ingredient_id: number;
  ingredient_name: string;
  category: string;
  unit: string;
  usage_quantity: number;
  yield_rate: number;
  latest_purchase_price: number;
  effective_unit_cost: number;
  line_cost: number;
}

export interface CostComparisonItem {
  target_type: 'variant' | 'topping';
  target_id: number;
  product_id?: number;
  product_name: string;
  variant_name: string;
  category_name: string;
  image_url?: string;
  retail_price: number;
  current_cogs: number;
  estimated_cogs: number;
  estimated_cogs_avg: number;
  difference: number;
  margin_percentage: number;
  recipe_item_count: number;
  recipe_details?: RecipeDetailItem[];
}

export interface IngredientHistoryRecord {
  id: number;
  transaction_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  fund_name?: string;
  cashier_name?: string;
  description?: string;
}
