package models

// --- Revenue Analytics Models ---

type RevenueSummary struct {
	TotalGrossSales         float64 `json:"total_gross_sales"`
	TotalDiscounts          float64 `json:"total_discounts"`
	ManualDiscount          float64 `json:"manual_discount"`
	PromotionDiscount       float64 `json:"promotion_discount"`
	PlatformDiscount        float64 `json:"platform_discount"`
	TotalShippingFees       float64 `json:"total_shipping_fees"`
	TotalSurcharges         float64 `json:"total_surcharges"`
	NetRevenue              float64 `json:"net_revenue"`
	CompletedOrderCount     int64   `json:"completed_order_count"`
	AverageOrderValue       float64 `json:"average_order_value"`
	PrevNetRevenue          float64 `json:"prev_net_revenue"`
	PrevCompletedOrderCount int64   `json:"prev_completed_order_count"`
	PrevAverageOrderValue   float64 `json:"prev_average_order_value"`
	RevenueDeltaPct         float64 `json:"revenue_delta_pct"`
	OrdersDeltaPct          float64 `json:"orders_delta_pct"`
	AOVDeltaPct             float64 `json:"aov_delta_pct"`
}

type RevenueTimelinePoint struct {
	Date        string  `json:"date"`
	NetRevenue  float64 `json:"net_revenue"`
	GrossSales  float64 `json:"gross_sales"`
	Discounts   float64 `json:"discounts"`
	OrdersCount int64   `json:"orders_count"`
}

type PaymentMethodBreakdown struct {
	FundID      uint    `json:"fund_id"`
	FundName    string  `json:"fund_name"`
	TotalAmount float64 `json:"total_amount"`
	OrderCount  int64   `json:"order_count"`
	Percentage  float64 `json:"percentage"`
}

type TopSellingProductItem struct {
	ProductID    uint    `json:"product_id"`
	ProductName  string  `json:"product_name"`
	VariantName  string  `json:"variant_name"`
	QuantitySold int64   `json:"quantity_sold"`
	TotalRevenue float64 `json:"total_revenue"`
	Percentage   float64 `json:"percentage"`
}

type RevenueAnalyticsResponse struct {
	Period         string                   `json:"period"`
	From           string                   `json:"from"`
	To             string                   `json:"to"`
	Summary        RevenueSummary           `json:"summary"`
	Timeline       []RevenueTimelinePoint   `json:"timeline"`
	PaymentMethods []PaymentMethodBreakdown `json:"payment_methods"`
	TopProducts    []TopSellingProductItem  `json:"top_products"`
}

// --- Profit & Loss (P&L) Analytics Models ---

type ProfitSummary struct {
	NetRevenue            float64 `json:"net_revenue"`
	TotalCogs             float64 `json:"total_cogs"`
	GrossProfit           float64 `json:"gross_profit"`
	GrossMarginPercentage float64 `json:"gross_margin_percentage"`
	OperatingExpenses     float64 `json:"operating_expenses"`
	OtherInflow           float64 `json:"other_inflow"`
	NetProfit             float64 `json:"net_profit"`
	NetMarginPercentage   float64 `json:"net_margin_percentage"`
	PrevGrossProfit       float64 `json:"prev_gross_profit"`
	PrevNetProfit         float64 `json:"prev_net_profit"`
	PrevTotalCogs         float64 `json:"prev_total_cogs"`
	PrevOperatingExpenses float64 `json:"prev_operating_expenses"`
	GrossProfitDeltaPct   float64 `json:"gross_profit_delta_pct"`
	NetProfitDeltaPct     float64 `json:"net_profit_delta_pct"`
}

type ProfitTimelinePoint struct {
	Date              string  `json:"date"`
	Revenue           float64 `json:"revenue"`
	Cogs              float64 `json:"cogs"`
	GrossProfit       float64 `json:"gross_profit"`
	OperatingExpenses float64 `json:"operating_expenses"`
	NetProfit         float64 `json:"net_profit"`
}

type TopProfitableProductItem struct {
	ProductID        uint    `json:"product_id"`
	ProductName      string  `json:"product_name"`
	VariantName      string  `json:"variant_name"`
	QuantitySold     int64   `json:"quantity_sold"`
	TotalRevenue     float64 `json:"total_revenue"`
	TotalCogs        float64 `json:"total_cogs"`
	TotalProfit      float64 `json:"total_profit"`
	MarginPercentage float64 `json:"margin_percentage"`
}

type FinancialStatementItem struct {
	ItemCode   string  `json:"item_code"`
	ItemName   string  `json:"item_name"`
	Amount     float64 `json:"amount"`
	Percentage float64 `json:"percentage"`
	IsHeader   bool    `json:"is_header"`
	IsTotal    bool    `json:"is_total"`
}

type ProfitAnalyticsResponse struct {
	Period      string                     `json:"period"`
	From        string                     `json:"from"`
	To          string                     `json:"to"`
	Summary     ProfitSummary              `json:"summary"`
	Timeline    []ProfitTimelinePoint      `json:"timeline"`
	TopProducts []TopProfitableProductItem `json:"top_products"`
	Statement   []FinancialStatementItem   `json:"statement"`
}

// --- Product Performance Ranking Models ---

type ProductRankingItem struct {
	ProductID        uint    `json:"product_id"`
	ProductName      string  `json:"product_name"`
	CategoryName     string  `json:"category_name"`
	VariantName      string  `json:"variant_name"`
	QuantitySold     int64   `json:"quantity_sold"`
	TotalRevenue     float64 `json:"total_revenue"`
	TotalCogs        float64 `json:"total_cogs"`
	TotalProfit      float64 `json:"total_profit"`
	MarginPercentage float64 `json:"margin_percentage"`
}

type ProductsRankingResponse struct {
	Items      []ProductRankingItem `json:"items"`
	TotalItems int64                `json:"total_items"`
	Page       int                  `json:"page"`
	Limit      int                  `json:"limit"`
	TotalPages int                  `json:"total_pages"`
}

// --- Funds Opening & Closing Period Summary Models ---

type FundPeriodStats struct {
	OpeningBalance float64 `json:"opening_balance"`
	TotalInflow    float64 `json:"total_inflow"`
	TotalOutflow   float64 `json:"total_outflow"`
	ClosingBalance float64 `json:"closing_balance"`
	NetChange      float64 `json:"net_change"`
}

type FundPeriodItem struct {
	FundID       uint            `json:"fund_id"`
	FundName     string          `json:"fund_name"`
	FundType     FundType        `json:"fund_type"`
	CurrentMonth FundPeriodStats `json:"current_month"`
	PrevMonth    FundPeriodStats `json:"prev_month"`
	GrowthPct    float64         `json:"growth_pct"`
}

type FundPeriodTotals struct {
	CurrentMonth FundPeriodStats `json:"current_month"`
	PrevMonth    FundPeriodStats `json:"prev_month"`
	GrowthPct    float64         `json:"growth_pct"`
}

type FundsPeriodSummaryResponse struct {
	SelectedMonth string             `json:"selected_month"`
	PreviousMonth string             `json:"previous_month"`
	Funds         []FundPeriodItem   `json:"funds"`
	Totals        FundPeriodTotals   `json:"totals"`
}

// --- Expense Category Breakdown Models ---

type CategoryBreakdownItem struct {
	Category      string  `json:"category"`
	CategoryLabel string  `json:"category_label"`
	TotalAmount   float64 `json:"total_amount"`
	Percentage    float64 `json:"percentage"`
	Count         int64   `json:"count"`
}

type CategoryBreakdownResponse struct {
	TransactionType string                  `json:"transaction_type"`
	TotalAmount     float64                 `json:"total_amount"`
	TotalCount      int64                   `json:"total_count"`
	From            string                  `json:"from"`
	To              string                  `json:"to"`
	Categories      []CategoryBreakdownItem `json:"categories"`
}

// --- Legacy Models (Preserved for backward compatibility) ---

type DashboardMetricsResponse struct {
	TotalRevenue      float64 `json:"total_revenue"`
	TotalCogs         float64 `json:"total_cogs"`
	TotalOutflow      float64 `json:"total_outflow"`
	GrossProfit       float64 `json:"gross_profit"`
	NetProfit         float64 `json:"net_profit"`
	OrderCount        int64   `json:"order_count"`
	AverageOrderValue float64 `json:"average_order_value"`
	StartDate         string  `json:"start_date"`
	EndDate           string  `json:"end_date"`
}

type TopProductVariantItem struct {
	VariantID    uint    `json:"variant_id"`
	ProductName  string  `json:"product_name"`
	VariantName  string  `json:"variant_name"`
	QuantitySold int64   `json:"quantity_sold"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalCogs    float64 `json:"total_cogs"`
	ProfitMargin float64 `json:"profit_margin"`
}

type CashFlowSummaryItem struct {
	Date    string  `json:"date"`
	Inflow  float64 `json:"inflow"`
	Outflow float64 `json:"outflow"`
	Net     float64 `json:"net"`
}

// --- Product Sales Performance Models ---

// ProductSalesPerformanceItem holds aggregated sales metrics for a single product
// across all its variants combined within a given time window.
type ProductSalesPerformanceItem struct {
	ProductID              uint    `json:"product_id"`
	ProductName            string  `json:"product_name"`
	CategoryName           string  `json:"category_name"`
	ImageURL               string  `json:"image_url"`
	QuantitySold           int64   `json:"quantity_sold"`
	TotalRevenue           float64 `json:"total_revenue"`
	TotalCOGS              float64 `json:"total_cogs"`
	TotalProfit            float64 `json:"total_profit"`
	MarginPercentage       float64 `json:"margin_percentage"`
	RevenueSharePercentage float64 `json:"revenue_share_percentage"`
}

// ProductSalesPerformanceSummary is the aggregate KPI banner for the entire product list.
type ProductSalesPerformanceSummary struct {
	TotalUnitsSold          int64   `json:"total_units_sold"`
	TotalProductsRevenue    float64 `json:"total_products_revenue"`
	TotalProductsProfit     float64 `json:"total_products_profit"`
	AverageMarginPercentage float64 `json:"average_margin_percentage"`
	TopSoldProduct          string  `json:"top_sold_product"`
	TopRevenueProduct       string  `json:"top_revenue_product"`
	TopProfitProduct        string  `json:"top_profit_product"`
}

// ProductSalesPerformanceResponse is the full API response envelope for the endpoint.
type ProductSalesPerformanceResponse struct {
	Summary ProductSalesPerformanceSummary `json:"summary"`
	Items   []ProductSalesPerformanceItem  `json:"items"`
	Period  string                         `json:"period"`
	From    string                         `json:"from"`
	To      string                         `json:"to"`
}
