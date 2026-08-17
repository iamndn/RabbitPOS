package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AnalyticsHandler struct {
	db *gorm.DB
}

func NewAnalyticsHandler(db *gorm.DB) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

// parseDateRange extracts start_date and end_date query params with defaults to today
func parseDateRange(c *gin.Context) (time.Time, time.Time, string, string) {
	now := time.Now()
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	if startDateStr != "" {
		startDate, err = time.Parse("2006-01-02", startDateStr)
		if err != nil {
			startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
			startDateStr = startDate.Format("2006-01-02")
		} else {
			startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, now.Location())
		}
	} else {
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		startDateStr = startDate.Format("2006-01-02")
	}

	if endDateStr != "" {
		endDate, err = time.Parse("2006-01-02", endDateStr)
		if err != nil {
			endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
			endDateStr = endDate.Format("2006-01-02")
		} else {
			endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, now.Location())
		}
	} else {
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
		endDateStr = endDate.Format("2006-01-02")
	}

	return startDate, endDate, startDateStr, endDateStr
}

// GetDashboardMetrics calculates total revenue, COGS, gross profit, net profit, order count, and AOV
func (h *AnalyticsHandler) GetDashboardMetrics(c *gin.Context) {
	startDate, endDate, startDateStr, endDateStr := parseDateRange(c)

	var totalRevenue float64 = 0
	var orderCount int64 = 0

	// 1. Calculate Revenue & Order Count from completed orders
	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&totalRevenue)

	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Count(&orderCount)

	// 2. Calculate Total COGS for completed order items
	var totalCogs float64 = 0
	h.db.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Select("COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0)").
		Scan(&totalCogs)

	// 3. Calculate Total Outflow Expenses from transactions table
	var totalOutflow float64 = 0
	h.db.Model(&models.Transaction{}).
		Where("transaction_type = ? AND created_at BETWEEN ? AND ?", models.TransactionTypeOutflow, startDate, endDate).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalOutflow)

	grossProfit := totalRevenue - totalCogs
	netProfit := grossProfit - totalOutflow

	var aov float64 = 0
	if orderCount > 0 {
		aov = totalRevenue / float64(orderCount)
	}

	resp := models.DashboardMetricsResponse{
		TotalRevenue:      totalRevenue,
		TotalCogs:         totalCogs,
		TotalOutflow:      totalOutflow,
		GrossProfit:       grossProfit,
		NetProfit:         netProfit,
		OrderCount:        orderCount,
		AverageOrderValue: aov,
		StartDate:         startDateStr,
		EndDate:           endDateStr,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Dashboard analytics metrics calculated successfully")
}

// GetTopProducts ranks top selling product variants by sales volume & revenue
func (h *AnalyticsHandler) GetTopProducts(c *gin.Context) {
	startDate, endDate, _, _ := parseDateRange(c)

	limitStr := c.DefaultQuery("limit", "10")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 {
		limit = 10
	}

	type Result struct {
		VariantID    uint
		ProductName  string
		VariantName  string
		QuantitySold int64
		TotalRevenue float64
		TotalCogs    float64
	}

	var results []Result

	err := h.db.Table("order_items").
		Select("product_variants.id as variant_id, products.name as product_name, product_variants.variant_name, SUM(order_items.quantity) as quantity_sold, SUM(order_items.line_total) as total_revenue, SUM(product_variants.cogs_price * order_items.quantity) as total_cogs").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Group("product_variants.id, products.name, product_variants.variant_name").
		Order("quantity_sold desc").
		Limit(limit).
		Scan(&results).Error

	if err != nil {
		models.SendInternalError(c, "Failed to calculate top products: "+err.Error())
		return
	}

	topProducts := make([]models.TopProductVariantItem, 0)
	for _, r := range results {
		profit := r.TotalRevenue - r.TotalCogs
		var margin float64 = 0
		if r.TotalRevenue > 0 {
			margin = (profit / r.TotalRevenue) * 100
		}

		topProducts = append(topProducts, models.TopProductVariantItem{
			VariantID:    r.VariantID,
			ProductName:  r.ProductName,
			VariantName:  r.VariantName,
			QuantitySold: r.QuantitySold,
			TotalRevenue: r.TotalRevenue,
			TotalCogs:    r.TotalCogs,
			ProfitMargin: margin,
		})
	}

	models.SendSuccess(c, http.StatusOK, topProducts, "Top products retrieved successfully")
}

// GetCashFlowSummary calculates daily inflow vs outflow summary
func (h *AnalyticsHandler) GetCashFlowSummary(c *gin.Context) {
	startDate, endDate, _, _ := parseDateRange(c)

	type DailyAggregate struct {
		Date    string
		Inflow  float64
		Outflow float64
	}

	var results []DailyAggregate

	query := `
		SELECT 
			TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
			SUM(CASE WHEN transaction_type = 'inflow' THEN amount ELSE 0 END) AS inflow,
			SUM(CASE WHEN transaction_type = 'outflow' THEN amount ELSE 0 END) AS outflow
		FROM transactions
		WHERE created_at BETWEEN ? AND ?
		GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
		ORDER BY date ASC
	`

	if err := h.db.Raw(query, startDate, endDate).Scan(&results).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve cash flow summary: "+err.Error())
		return
	}

	cashFlowList := make([]models.CashFlowSummaryItem, 0)
	for _, r := range results {
		cashFlowList = append(cashFlowList, models.CashFlowSummaryItem{
			Date:    r.Date,
			Inflow:  r.Inflow,
			Outflow: r.Outflow,
			Net:     r.Inflow - r.Outflow,
		})
	}

	models.SendSuccess(c, http.StatusOK, cashFlowList, "Cash flow summary calculated successfully")
}
