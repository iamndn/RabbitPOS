package handlers

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AnalyticsHandler struct {
	db       *gorm.DB
	emailSvc *services.EmailService
}

func NewAnalyticsHandler(db *gorm.DB, emailSvc *services.EmailService) *AnalyticsHandler {
	return &AnalyticsHandler{db: db, emailSvc: emailSvc}
}

// SendDailyReportEmail is an admin-only endpoint to trigger an on-demand financial email report
// POST /api/v1/analytics/send-daily-report-email
// Body (all optional): { "date": "YYYY-MM-DD", "recipients": ["email@example.com"] }
func (h *AnalyticsHandler) SendDailyReportEmail(c *gin.Context) {
	// Extract requesting admin username for attribution in the email
	triggeredBy := ""
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(*models.User); ok {
			triggeredBy = u.Username
		}
	}

	// Parse optional request body
	var req struct {
		Date       string   `json:"date"`
		Recipients []string `json:"recipients"`
	}
	// ShouldBindJSON is lenient — OK if body is empty
	_ = c.ShouldBindJSON(&req)

	// Determine target date (default: today in server timezone)
	var targetDate time.Time
	if req.Date != "" {
		parsed, err := time.ParseInLocation("2006-01-02", req.Date, time.Now().Location())
		if err != nil {
			models.SendError(c, http.StatusBadRequest, fmt.Sprintf("Invalid date format '%s': use YYYY-MM-DD", req.Date))
			return
		}
		targetDate = parsed
	} else {
		targetDate = time.Now()
	}

	// Fire email in a goroutine so the API returns immediately
	errCh := make(chan error, 1)
	go func() {
		errCh <- h.emailSvc.SendDailyFinancialReport(targetDate, triggeredBy, req.Recipients)
	}()

	// Wait up to 30 seconds for send (reasonable for SMTP; avoids HTTP timeout)
	select {
	case err := <-errCh:
		if err != nil {
			models.SendError(c, http.StatusInternalServerError, "Failed to send email report: "+err.Error())
			return
		}
	case <-time.After(30 * time.Second):
		models.SendError(c, http.StatusGatewayTimeout, "Email dispatch timed out — check SMTP settings")
		return
	}

	recipients := h.emailSvc.GetDefaultRecipients()
	if len(req.Recipients) > 0 {
		recipients = req.Recipients
	}
	models.SendSuccess(c, http.StatusOK, gin.H{
		"date":             targetDate.Format("2006-01-02"),
		"recipients_count": len(recipients),
		"recipients":       recipients,
	}, fmt.Sprintf("Email report sent successfully to %d recipient(s)", len(recipients)))
}

// parseAnalyticsPeriod parses period, from, to query parameters and returns current and previous time windows
func parseAnalyticsPeriod(c *gin.Context) (startTime, endTime, prevStartTime, prevEndTime time.Time, periodName, fromStr, toStr string) {
	now := time.Now()
	period := strings.ToLower(c.DefaultQuery("period", "today"))
	fromParam := c.Query("from")
	toParam := c.Query("to")

	loc := now.Location()

	switch period {
	case "today":
		startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		prevStartTime = startTime.AddDate(0, 0, -1)
		prevEndTime = endTime.AddDate(0, 0, -1)

	case "yesterday":
		y := now.AddDate(0, 0, -1)
		startTime = time.Date(y.Year(), y.Month(), y.Day(), 0, 0, 0, 0, loc)
		endTime = time.Date(y.Year(), y.Month(), y.Day(), 23, 59, 59, 999999999, loc)
		prevStartTime = startTime.AddDate(0, 0, -1)
		prevEndTime = endTime.AddDate(0, 0, -1)

	case "week":
		// Monday as start of week
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		mon := now.AddDate(0, 0, -(weekday - 1))
		startTime = time.Date(mon.Year(), mon.Month(), mon.Day(), 0, 0, 0, 0, loc)
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		prevStartTime = startTime.AddDate(0, 0, -7)
		prevEndTime = endTime.AddDate(0, 0, -7)

	case "month":
		startTime = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		prevMonth := startTime.AddDate(0, -1, 0)
		prevStartTime = time.Date(prevMonth.Year(), prevMonth.Month(), 1, 0, 0, 0, 0, loc)
		prevEndTime = time.Date(prevMonth.Year(), prevMonth.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		// If prev month has fewer days, clamp to end of month
		lastDayPrevMonth := prevStartTime.AddDate(0, 1, -1)
		if prevEndTime.After(lastDayPrevMonth) {
			prevEndTime = time.Date(lastDayPrevMonth.Year(), lastDayPrevMonth.Month(), lastDayPrevMonth.Day(), 23, 59, 59, 999999999, loc)
		}

	case "year":
		startTime = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, loc)
		endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		prevStartTime = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, loc)
		prevEndTime = time.Date(now.Year()-1, now.Month(), now.Day(), 23, 59, 59, 999999999, loc)

	case "custom":
		fallthrough
	default:
		period = "custom"
		if fromParam != "" {
			t, err := time.ParseInLocation("2006-01-02", fromParam, loc)
			if err != nil {
				t, err = time.Parse(time.RFC3339, fromParam)
			}
			if err == nil {
				startTime = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
			}
		}
		if startTime.IsZero() {
			startTime = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		}

		if toParam != "" {
			t, err := time.ParseInLocation("2006-01-02", toParam, loc)
			if err != nil {
				t, err = time.Parse(time.RFC3339, toParam)
			}
			if err == nil {
				endTime = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 999999999, loc)
			}
		}
		if endTime.IsZero() || endTime.Before(startTime) {
			endTime = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		}

		duration := endTime.Sub(startTime)
		prevEndTime = startTime.Add(-1 * time.Nanosecond)
		prevStartTime = prevEndTime.Add(-duration)
	}

	fromStr = startTime.Format("2006-01-02")
	toStr = endTime.Format("2006-01-02")
	periodName = period
	return
}

func calculateDelta(current, prev float64) float64 {
	if prev <= 0 {
		if current > 0 {
			return 100.0
		}
		return 0.0
	}
	return math.Round(((current-prev)/prev)*1000) / 10
}

// GetRevenueAnalytics computes comprehensive revenue KPIs, trend timeline, payment methods, and top selling items
func (h *AnalyticsHandler) GetRevenueAnalytics(c *gin.Context) {
	startTime, endTime, prevStartTime, prevEndTime, period, fromStr, toStr := parseAnalyticsPeriod(c)

	// 1. Current Period Summary (completed orders only)
	type OrderSummaryResult struct {
		GrossSales          float64
		ManualDiscount      float64
		PromotionDiscount   float64
		PlatformDiscount    float64
		ShippingFee         float64
		Surcharge           float64
		NetRevenue          float64
		CompletedOrderCount int64
	}

	var currSummary OrderSummaryResult
	h.db.Table("orders").
		Select(`
			COALESCE(SUM(subtotal), 0) as gross_sales,
			COALESCE(SUM(discount_amount), 0) as manual_discount,
			COALESCE(SUM(promotion_discount), 0) as promotion_discount,
			COALESCE(SUM(platform_fee_discount), 0) as platform_discount,
			COALESCE(SUM(shipping_fee), 0) as shipping_fee,
			COALESCE(SUM(surcharge), 0) as surcharge,
			COALESCE(SUM(total_amount), 0) as net_revenue,
			COUNT(id) as completed_order_count
		`).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Scan(&currSummary)

	// 2. Previous Period Summary for Delta Comparison
	var prevSummary OrderSummaryResult
	h.db.Table("orders").
		Select(`
			COALESCE(SUM(total_amount), 0) as net_revenue,
			COUNT(id) as completed_order_count
		`).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, prevStartTime, prevEndTime).
		Scan(&prevSummary)

	totalDiscounts := currSummary.ManualDiscount + currSummary.PromotionDiscount + currSummary.PlatformDiscount

	var aov float64 = 0
	if currSummary.CompletedOrderCount > 0 {
		aov = currSummary.NetRevenue / float64(currSummary.CompletedOrderCount)
	}

	var prevAov float64 = 0
	if prevSummary.CompletedOrderCount > 0 {
		prevAov = prevSummary.NetRevenue / float64(prevSummary.CompletedOrderCount)
	}

	revenueDelta := calculateDelta(currSummary.NetRevenue, prevSummary.NetRevenue)
	ordersDelta := calculateDelta(float64(currSummary.CompletedOrderCount), float64(prevSummary.CompletedOrderCount))
	aovDelta := calculateDelta(aov, prevAov)

	summary := models.RevenueSummary{
		TotalGrossSales:         currSummary.GrossSales,
		TotalDiscounts:          totalDiscounts,
		ManualDiscount:          currSummary.ManualDiscount,
		PromotionDiscount:       currSummary.PromotionDiscount,
		PlatformDiscount:        currSummary.PlatformDiscount,
		TotalShippingFees:       currSummary.ShippingFee,
		TotalSurcharges:         currSummary.Surcharge,
		NetRevenue:              currSummary.NetRevenue,
		CompletedOrderCount:     currSummary.CompletedOrderCount,
		AverageOrderValue:       aov,
		PrevNetRevenue:          prevSummary.NetRevenue,
		PrevCompletedOrderCount: prevSummary.CompletedOrderCount,
		PrevAverageOrderValue:   prevAov,
		RevenueDeltaPct:         revenueDelta,
		OrdersDeltaPct:          ordersDelta,
		AOVDeltaPct:             aovDelta,
	}

	// 3. Time-series Revenue Trend Timeline
	durationHours := endTime.Sub(startTime).Hours()
	var timelineQuery string
	var groupFormat string

	if durationHours <= 36 { // 1 day / today / yesterday: group by hour
		groupFormat = "YYYY-MM-DD HH24:00"
		timelineQuery = `
			SELECT 
				TO_CHAR(created_at, 'YYYY-MM-DD HH24:00') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD HH24:00')
			ORDER BY date ASC
		`
	} else if durationHours <= 24*90 { // Under 90 days: group by day
		groupFormat = "YYYY-MM-DD"
		timelineQuery = `
			SELECT 
				TO_CHAR(created_at, 'YYYY-MM-DD') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
			ORDER BY date ASC
		`
	} else { // Over 90 days / year: group by month
		groupFormat = "YYYY-MM"
		timelineQuery = `
			SELECT 
				TO_CHAR(created_at, 'YYYY-MM') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at, 'YYYY-MM')
			ORDER BY date ASC
		`
	}

	_ = groupFormat
	timeline := make([]models.RevenueTimelinePoint, 0)
	h.db.Raw(timelineQuery, startTime, endTime).Scan(&timeline)

	// 4. Payment Methods Breakdown
	type PaymentMethodRaw struct {
		FundID      uint
		FundName    string
		TotalAmount float64
		OrderCount  int64
	}
	var rawMethods []PaymentMethodRaw
	h.db.Table("orders").
		Select("orders.fund_id, COALESCE(funds.name, 'Unknown') as fund_name, SUM(orders.total_amount) as total_amount, COUNT(orders.id) as order_count").
		Joins("LEFT JOIN funds ON funds.id = orders.fund_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Group("orders.fund_id, funds.name").
		Order("total_amount desc").
		Scan(&rawMethods)

	paymentMethods := make([]models.PaymentMethodBreakdown, 0)
	for _, pm := range rawMethods {
		var pct float64 = 0
		if currSummary.NetRevenue > 0 {
			pct = math.Round((pm.TotalAmount/currSummary.NetRevenue)*1000) / 10
		}
		paymentMethods = append(paymentMethods, models.PaymentMethodBreakdown{
			FundID:      pm.FundID,
			FundName:    pm.FundName,
			TotalAmount: pm.TotalAmount,
			OrderCount:  pm.OrderCount,
			Percentage:  pct,
		})
	}

	// 5. Top 5 Selling Products by Revenue
	type TopProductRaw struct {
		ProductID    uint
		ProductName  string
		VariantName  string
		QuantitySold int64
		TotalRevenue float64
	}
	var rawTop []TopProductRaw
	h.db.Table("order_items").
		Select("products.id as product_id, products.name as product_name, product_variants.variant_name, SUM(order_items.quantity) as quantity_sold, SUM(order_items.line_total) as total_revenue").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Group("products.id, products.name, product_variants.variant_name").
		Order("total_revenue desc").
		Limit(5).
		Scan(&rawTop)

	topProducts := make([]models.TopSellingProductItem, 0)
	for _, tp := range rawTop {
		var pct float64 = 0
		if currSummary.NetRevenue > 0 {
			pct = math.Round((tp.TotalRevenue/currSummary.NetRevenue)*1000) / 10
		}
		topProducts = append(topProducts, models.TopSellingProductItem{
			ProductID:    tp.ProductID,
			ProductName:  tp.ProductName,
			VariantName:  tp.VariantName,
			QuantitySold: tp.QuantitySold,
			TotalRevenue: tp.TotalRevenue,
			Percentage:   pct,
		})
	}

	resp := models.RevenueAnalyticsResponse{
		Period:         period,
		From:           fromStr,
		To:             toStr,
		Summary:        summary,
		Timeline:       timeline,
		PaymentMethods: paymentMethods,
		TopProducts:    topProducts,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Revenue analytics calculated successfully")
}

// GetProfitAnalytics computes P&L metrics, Gross/Net Margins, COGS, Operating Expenses, and Financial Statement
func (h *AnalyticsHandler) GetProfitAnalytics(c *gin.Context) {
	startTime, endTime, prevStartTime, prevEndTime, period, fromStr, toStr := parseAnalyticsPeriod(c)

	// 1. Current Period Revenue
	var netRevenue float64 = 0
	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&netRevenue)

	// 2. Current Period Total COGS (product variant cogs * quantity)
	var totalCogs float64 = 0
	h.db.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Select("COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0)").
		Scan(&totalCogs)

	// 3. Current Operating Expenses (outflow transactions excluding reconciliation variances)
	var operatingExpenses float64 = 0
	h.db.Model(&models.Transaction{}).
		Where("transaction_type = ? AND category != ? AND created_at BETWEEN ? AND ?",
			models.TransactionTypeOutflow, models.CategoryReconciliationVariance, startTime, endTime).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&operatingExpenses)

	// 4. Current Other Inflows (non-order manual inflows excluding reconciliation variances)
	var otherInflow float64 = 0
	h.db.Model(&models.Transaction{}).
		Where("transaction_type = ? AND reference_order_id IS NULL AND category != ? AND created_at BETWEEN ? AND ?",
			models.TransactionTypeInflow, models.CategoryReconciliationVariance, startTime, endTime).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&otherInflow)

	grossProfit := netRevenue - totalCogs
	var grossMarginPct float64 = 0
	if netRevenue > 0 {
		grossMarginPct = math.Round((grossProfit/netRevenue)*1000) / 10
	}

	netProfit := grossProfit - operatingExpenses + otherInflow
	var netMarginPct float64 = 0
	if netRevenue > 0 {
		netMarginPct = math.Round((netProfit/netRevenue)*1000) / 10
	}

	// 5. Previous Period for Deltas
	var prevRevenue, prevCogs, prevExpenses, prevOtherInflow float64
	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, prevStartTime, prevEndTime).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&prevRevenue)

	h.db.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, prevStartTime, prevEndTime).
		Select("COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0)").
		Scan(&prevCogs)

	h.db.Model(&models.Transaction{}).
		Where("transaction_type = ? AND category != ? AND created_at BETWEEN ? AND ?",
			models.TransactionTypeOutflow, models.CategoryReconciliationVariance, prevStartTime, prevEndTime).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&prevExpenses)

	h.db.Model(&models.Transaction{}).
		Where("transaction_type = ? AND reference_order_id IS NULL AND category != ? AND created_at BETWEEN ? AND ?",
			models.TransactionTypeInflow, models.CategoryReconciliationVariance, prevStartTime, prevEndTime).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&prevOtherInflow)

	prevGrossProfit := prevRevenue - prevCogs
	prevNetProfit := prevGrossProfit - prevExpenses + prevOtherInflow

	grossProfitDelta := calculateDelta(grossProfit, prevGrossProfit)
	netProfitDelta := calculateDelta(netProfit, prevNetProfit)

	summary := models.ProfitSummary{
		NetRevenue:            netRevenue,
		TotalCogs:             totalCogs,
		GrossProfit:           grossProfit,
		GrossMarginPercentage: grossMarginPct,
		OperatingExpenses:     operatingExpenses,
		OtherInflow:           otherInflow,
		NetProfit:             netProfit,
		NetMarginPercentage:   netMarginPct,
		PrevGrossProfit:       prevGrossProfit,
		PrevNetProfit:         prevNetProfit,
		PrevTotalCogs:         prevCogs,
		PrevOperatingExpenses: prevExpenses,
		GrossProfitDeltaPct:   grossProfitDelta,
		NetProfitDeltaPct:     netProfitDelta,
	}

	// 6. Multi-Series Profit Timeline
	durationHours := endTime.Sub(startTime).Hours()
	var timeFormat string
	if durationHours <= 36 {
		timeFormat = "YYYY-MM-DD HH24:00"
	} else if durationHours <= 24*90 {
		timeFormat = "YYYY-MM-DD"
	} else {
		timeFormat = "YYYY-MM"
	}

	timelineQuery := fmt.Sprintf(`
		WITH order_daily AS (
			SELECT 
				TO_CHAR(orders.created_at, '%s') as dt,
				COALESCE(SUM(orders.total_amount), 0) as rev,
				COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0) as cogs
			FROM orders
			JOIN order_items ON order_items.order_id = orders.id
			JOIN product_variants ON product_variants.id = order_items.product_variant_id
			WHERE orders.status = 'completed' AND orders.created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(orders.created_at, '%s')
		),
		expense_daily AS (
			SELECT 
				TO_CHAR(created_at, '%s') as dt,
				COALESCE(SUM(CASE WHEN transaction_type = 'outflow' AND category != 'reconciliation_variance' THEN amount ELSE 0 END), 0) as exp,
				COALESCE(SUM(CASE WHEN transaction_type = 'inflow' AND reference_order_id IS NULL AND category != 'reconciliation_variance' THEN amount ELSE 0 END), 0) as inf
			FROM transactions
			WHERE created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at, '%s')
		),
		all_dates AS (
			SELECT dt FROM order_daily UNION SELECT dt FROM expense_daily
		)
		SELECT 
			all_dates.dt as date,
			COALESCE(order_daily.rev, 0) as revenue,
			COALESCE(order_daily.cogs, 0) as cogs,
			COALESCE(order_daily.rev, 0) - COALESCE(order_daily.cogs, 0) as gross_profit,
			COALESCE(expense_daily.exp, 0) as operating_expenses,
			(COALESCE(order_daily.rev, 0) - COALESCE(order_daily.cogs, 0) - COALESCE(expense_daily.exp, 0) + COALESCE(expense_daily.inf, 0)) as net_profit
		FROM all_dates
		LEFT JOIN order_daily ON order_daily.dt = all_dates.dt
		LEFT JOIN expense_daily ON expense_daily.dt = all_dates.dt
		ORDER BY date ASC
	`, timeFormat, timeFormat, timeFormat, timeFormat)

	timeline := make([]models.ProfitTimelinePoint, 0)
	h.db.Raw(timelineQuery, startTime, endTime, startTime, endTime).Scan(&timeline)

	// 7. Top 5 Profitable Products
	type ProfitableProductRaw struct {
		ProductID    uint
		ProductName  string
		VariantName  string
		QuantitySold int64
		TotalRevenue float64
		TotalCogs    float64
	}
	var rawProfitable []ProfitableProductRaw
	h.db.Table("order_items").
		Select("products.id as product_id, products.name as product_name, product_variants.variant_name, SUM(order_items.quantity) as quantity_sold, SUM(order_items.line_total) as total_revenue, SUM(product_variants.cogs_price * order_items.quantity) as total_cogs").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Group("products.id, products.name, product_variants.variant_name").
		Order("(SUM(order_items.line_total) - SUM(product_variants.cogs_price * order_items.quantity)) desc").
		Limit(5).
		Scan(&rawProfitable)

	topProfitable := make([]models.TopProfitableProductItem, 0)
	for _, tp := range rawProfitable {
		profit := tp.TotalRevenue - tp.TotalCogs
		var margin float64 = 0
		if tp.TotalRevenue > 0 {
			margin = math.Round((profit/tp.TotalRevenue)*1000) / 10
		}
		topProfitable = append(topProfitable, models.TopProfitableProductItem{
			ProductID:        tp.ProductID,
			ProductName:      tp.ProductName,
			VariantName:      tp.VariantName,
			QuantitySold:     tp.QuantitySold,
			TotalRevenue:     tp.TotalRevenue,
			TotalCogs:        tp.TotalCogs,
			TotalProfit:      profit,
			MarginPercentage: margin,
		})
	}

	// 8. Financial P&L Statement Structure
	calcPct := func(amt float64) float64 {
		if netRevenue <= 0 {
			return 0
		}
		return math.Round((amt/netRevenue)*1000) / 10
	}

	statement := []models.FinancialStatementItem{
		{ItemCode: "REV", ItemName: "1. Doanh thu thuần (Net Sales)", Amount: netRevenue, Percentage: 100.0, IsHeader: true, IsTotal: false},
		{ItemCode: "COGS", ItemName: "2. Giá vốn hàng bán (COGS)", Amount: totalCogs, Percentage: calcPct(totalCogs), IsHeader: false, IsTotal: false},
		{ItemCode: "GP", ItemName: "3. Lợi nhuận gộp (Gross Profit)", Amount: grossProfit, Percentage: grossMarginPct, IsHeader: false, IsTotal: true},
		{ItemCode: "OPEX", ItemName: "4. Chi phí vận hành & Nguyên liệu ngoài (Operating Expenses)", Amount: operatingExpenses, Percentage: calcPct(operatingExpenses), IsHeader: false, IsTotal: false},
		{ItemCode: "OTHER", ItemName: "5. Thu nhập khác (Other Inflow)", Amount: otherInflow, Percentage: calcPct(otherInflow), IsHeader: false, IsTotal: false},
		{ItemCode: "NP", ItemName: "6. Lợi nhuận ròng (Net Profit)", Amount: netProfit, Percentage: netMarginPct, IsHeader: false, IsTotal: true},
	}

	resp := models.ProfitAnalyticsResponse{
		Period:      period,
		From:        fromStr,
		To:          toStr,
		Summary:     summary,
		Timeline:    timeline,
		TopProducts: topProfitable,
		Statement:   statement,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Profit analytics calculated successfully")
}

// GetProductsRanking returns paginated rankings of products by revenue, profit, or quantity sold
func (h *AnalyticsHandler) GetProductsRanking(c *gin.Context) {
	startTime, endTime, _, _, _, _, _ := parseAnalyticsPeriod(c)

	sortBy := strings.ToLower(c.DefaultQuery("sort_by", "revenue"))
	search := strings.TrimSpace(c.Query("search"))
	categoryIDStr := c.Query("category_id")

	pageStr := c.DefaultQuery("page", "1")
	page, _ := strconv.Atoi(pageStr)
	if page < 1 {
		page = 1
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, _ := strconv.Atoi(limitStr)
	if limit < 1 || limit > 100 {
		limit = 10
	}

	offset := (page - 1) * limit

	baseQuery := h.db.Table("order_items").
		Select(`
			products.id as product_id,
			products.name as product_name,
			COALESCE(categories.name, 'Chưa phân loại') as category_name,
			product_variants.variant_name,
			SUM(order_items.quantity) as quantity_sold,
			SUM(order_items.line_total) as total_revenue,
			SUM(product_variants.cogs_price * order_items.quantity) as total_cogs,
			(SUM(order_items.line_total) - SUM(product_variants.cogs_price * order_items.quantity)) as total_profit,
			CASE WHEN SUM(order_items.line_total) > 0 
				THEN ROUND(((SUM(order_items.line_total) - SUM(product_variants.cogs_price * order_items.quantity)) / SUM(order_items.line_total) * 100)::numeric, 1) 
				ELSE 0 END as margin_percentage
		`).
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Joins("LEFT JOIN categories ON categories.id = products.category_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Group("products.id, products.name, categories.name, product_variants.variant_name")

	if search != "" {
		baseQuery = baseQuery.Where("LOWER(products.name) LIKE ? OR LOWER(categories.name) LIKE ?", "%"+strings.ToLower(search)+"%", "%"+strings.ToLower(search)+"%")
	}

	if categoryIDStr != "" {
		if catID, err := strconv.ParseUint(categoryIDStr, 10, 32); err == nil && catID > 0 {
			baseQuery = baseQuery.Where("products.category_id = ?", catID)
		}
	}

	// Count total groups
	var totalItems int64
	countQuery := h.db.Table("(?) as sub", baseQuery).Count(&totalItems)
	if countQuery.Error != nil {
		models.SendInternalError(c, "Failed to count product rankings: "+countQuery.Error.Error())
		return
	}

	// Apply Sorting
	orderClause := "total_revenue DESC"
	if sortBy == "profit" {
		orderClause = "total_profit DESC"
	} else if sortBy == "quantity" {
		orderClause = "quantity_sold DESC"
	} else if sortBy == "margin" {
		orderClause = "margin_percentage DESC"
	}

	var items []models.ProductRankingItem
	err := baseQuery.Order(orderClause).Limit(limit).Offset(offset).Scan(&items).Error
	if err != nil {
		models.SendInternalError(c, "Failed to retrieve product rankings: "+err.Error())
		return
	}

	totalPages := int(math.Ceil(float64(totalItems) / float64(limit)))

	resp := models.ProductsRankingResponse{
		Items:      items,
		TotalItems: totalItems,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Product rankings retrieved successfully")
}

// GetDashboardMetrics (Legacy endpoint preserved for backwards compatibility)
func (h *AnalyticsHandler) GetDashboardMetrics(c *gin.Context) {
	startDate, endDate, startDateStr, endDateStr := parseDateRange(c)

	var totalRevenue float64 = 0
	var orderCount int64 = 0

	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&totalRevenue)

	h.db.Model(&models.Order{}).
		Where("status = ? AND created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Count(&orderCount)

	var totalCogs float64 = 0
	h.db.Table("order_items").
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startDate, endDate).
		Select("COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0)").
		Scan(&totalCogs)

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

// GetTopProducts (Legacy endpoint preserved for backwards compatibility)
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

// GetCashFlowSummary (Legacy endpoint preserved for backwards compatibility)
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

	response := make([]models.CashFlowSummaryItem, 0)
	for _, r := range results {
		response = append(response, models.CashFlowSummaryItem{
			Date:    r.Date,
			Inflow:  r.Inflow,
			Outflow: r.Outflow,
			Net:     r.Inflow - r.Outflow,
		})
	}

	models.SendSuccess(c, http.StatusOK, response, "Cash flow summary retrieved successfully")
}

func parseDateRange(c *gin.Context) (time.Time, time.Time, string, string) {
	now := time.Now()
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	loc := now.Location()

	if startDateStr != "" {
		startDate, err = time.ParseInLocation("2006-01-02", startDateStr, loc)
		if err != nil {
			startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
			startDateStr = startDate.Format("2006-01-02")
		} else {
			startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, loc)
		}
	} else {
		startDate = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		startDateStr = startDate.Format("2006-01-02")
	}

	if endDateStr != "" {
		endDate, err = time.ParseInLocation("2006-01-02", endDateStr, loc)
		if err != nil {
			endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
			endDateStr = endDate.Format("2006-01-02")
		} else {
			endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 23, 59, 59, 999999999, loc)
		}
	} else {
		endDate = time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, loc)
		endDateStr = endDate.Format("2006-01-02")
	}

	return startDate, endDate, startDateStr, endDateStr
}
