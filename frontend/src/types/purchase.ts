export interface IngredientConversionPreset {
  id?: string;
  label?: string;
  purchase_unit: string;
  pack_qty: number;
  pack_unit: string;
  capacity_qty: number;
  capacity_unit: string;
  loss_rate?: number;
}

export interface Ingredient {
  id: number;
  name: string;
  category: 'fruit' | 'ingredient' | 'packaging' | 'other' | string;
  unit: string; // Legacy / synced with base_unit
  base_unit: string; // 'ml', 'g', 'cái', 'quả', 'viên', 'lon', 'hộp', 'túi', 'lít', 'kg'
  loss_rate: number; // 0.05 = 5% hao hụt
  latest_purchase_price: number; // Giá quy đổi / base_unit
  average_purchase_price: number; // Giá BQ quy đổi / base_unit
  yield_rate: number; // 1.0 - loss_rate
  default_purchase_unit?: string;
  default_pack_qty?: number;
  default_pack_unit?: string;
  default_capacity_qty?: number;
  default_capacity_unit?: string;
  saved_conversions?: string | IngredientConversionPreset[]; // JSON string or parsed array
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
  quantity: number; // Base quantity / legacy
  unit_price: number; // Base unit price / legacy
  unit?: string;
  subtotal: number;
  purchase_unit?: string;
  purchase_quantity?: number;
  purchase_unit_price?: number;
  pack_qty?: number;
  pack_unit?: string;
  capacity_qty?: number;
  capacity_unit?: string;
  conversion_rate?: number;
  total_base_quantity?: number;
  base_unit?: string;
  base_unit_price?: number;
  loss_rate?: number;
  effective_base_quantity?: number;
  effective_base_price?: number;
  conversion_spec?: string;
  created_at?: string;
}

export interface RecipeItem {
  id?: number;
  product_variant_id?: number;
  topping_id?: number;
  ingredient_id: number;
  ingredient?: Ingredient;
  usage_quantity: number; // In Ingredient's BaseUnit (e.g. 60 ml, 30 g, 1 cái)
  created_at?: string;
  updated_at?: string;
}

export interface RecipeDetailItem {
  ingredient_id: number;
  ingredient_name: string;
  category: string;
  unit: string;
  base_unit?: string;
  usage_quantity: number;
  loss_rate?: number;
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
  purchase_unit?: string;
  purchase_quantity?: number;
  purchase_unit_price?: number;
  pack_qty?: number;
  pack_unit?: string;
  capacity_qty?: number;
  capacity_unit?: string;
  conversion_rate?: number;
  total_base_quantity?: number;
  base_unit?: string;
  base_unit_price?: number;
  loss_rate?: number;
  effective_base_quantity?: number;
  effective_base_price?: number;
  conversion_spec?: string;
  created_at: string;
  fund_name?: string;
  cashier_name?: string;
  description?: string;
}
