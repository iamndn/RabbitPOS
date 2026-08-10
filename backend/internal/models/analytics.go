package models

// DashboardMetricsResponse holds high-level KPI business statistics
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

// TopProductVariantItem represents top performing drink variants
type TopProductVariantItem struct {
	VariantID    uint    `json:"variant_id"`
	ProductName  string  `json:"product_name"`
	VariantName  string  `json:"variant_name"`
	QuantitySold int64   `json:"quantity_sold"`
	TotalRevenue float64 `json:"total_revenue"`
	TotalCogs    float64 `json:"total_cogs"`
	ProfitMargin float64 `json:"profit_margin"`
}

// CashFlowSummaryItem represents daily inflow vs outflow breakdown
type CashFlowSummaryItem struct {
	Date    string  `json:"date"`
	Inflow  float64 `json:"inflow"`
	Outflow float64 `json:"outflow"`
	Net     float64 `json:"net"`
}
