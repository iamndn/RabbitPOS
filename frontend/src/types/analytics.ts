export interface RevenueSummary {
  total_gross_sales: number;
  total_discounts: number;
  manual_discount: number;
  promotion_discount: number;
  platform_discount: number;
  total_shipping_fees: number;
  total_surcharges: number;
  net_revenue: number;
  completed_order_count: number;
  average_order_value: number;
  prev_net_revenue: number;
  prev_completed_order_count: number;
  prev_average_order_value: number;
  revenue_delta_pct: number;
  orders_delta_pct: number;
  aov_delta_pct: number;
}

export interface RevenueTimelinePoint {
  date: string;
  net_revenue: number;
  gross_sales: number;
  discounts: number;
  orders_count: number;
}

export interface PaymentMethodBreakdown {
  fund_id: number;
  fund_name: string;
  total_amount: number;
  order_count: number;
  percentage: number;
}

export interface TopSellingProductItem {
  product_id: number;
  product_name: string;
  variant_name: string;
  quantity_sold: number;
  total_revenue: number;
  percentage: number;
}

export interface RevenueAnalyticsResponse {
  period: string;
  from: string;
  to: string;
  summary: RevenueSummary;
  timeline: RevenueTimelinePoint[];
  payment_methods: PaymentMethodBreakdown[];
  top_products: TopSellingProductItem[];
}

export interface ProfitSummary {
  net_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin_percentage: number;
  operating_expenses: number;
  other_inflow: number;
  net_profit: number;
  net_margin_percentage: number;
  prev_gross_profit: number;
  prev_net_profit: number;
  prev_total_cogs: number;
  prev_operating_expenses: number;
  gross_profit_delta_pct: number;
  net_profit_delta_pct: number;
}

export interface ProfitTimelinePoint {
  date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
}

export interface TopProfitableProductItem {
  product_id: number;
  product_name: string;
  variant_name: string;
  quantity_sold: number;
  total_revenue: number;
  total_cogs: number;
  total_profit: number;
  margin_percentage: number;
}

export interface FinancialStatementItem {
  item_code: string;
  item_name: string;
  amount: number;
  percentage: number;
  is_header: boolean;
  is_total: boolean;
}

export interface ProfitAnalyticsResponse {
  period: string;
  from: string;
  to: string;
  summary: ProfitSummary;
  timeline: ProfitTimelinePoint[];
  top_products: TopProfitableProductItem[];
  statement: FinancialStatementItem[];
}

export interface FundPeriodStats {
  opening_balance: number;
  total_inflow: number;
  total_outflow: number;
  closing_balance: number;
  net_change: number;
}

export interface FundPeriodItem {
  fund_id: number;
  fund_name: string;
  fund_type: string;
  current_month: FundPeriodStats;
  prev_month: FundPeriodStats;
  growth_pct: number;
}

export interface FundPeriodTotals {
  current_month: FundPeriodStats;
  prev_month: FundPeriodStats;
  growth_pct: number;
}

export interface FundsPeriodSummaryResponse {
  selected_month: string;
  previous_month: string;
  funds: FundPeriodItem[];
  totals: FundPeriodTotals;
}

export interface CategoryBreakdownItem {
  category: string;
  category_label: string;
  total_amount: number;
  percentage: number;
  count: number;
}

export interface CategoryBreakdownResponse {
  transaction_type: string;
  total_amount: number;
  total_count: number;
  from: string;
  to: string;
  categories: CategoryBreakdownItem[];
}
