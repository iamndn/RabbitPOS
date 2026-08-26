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

// getAnalyticsLocation returns Vietnam timezone (Asia/Ho_Chi_Minh / ICT +07:00)
func getAnalyticsLocation() *time.Location {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		return time.FixedZone("ICT", 7*3600)
	}
	return loc
}

// parseAnalyticsPeriod parses period, from, to query parameters and returns current and previous time windows
func parseAnalyticsPeriod(c *gin.Context) (startTime, endTime, prevStartTime, prevEndTime time.Time, periodName, fromStr, toStr string) {
	loc := getAnalyticsLocation()
	now := time.Now().In(loc)
	period := strings.ToLower(c.DefaultQuery("period", "today"))
	fromParam := c.Query("from")
	toParam := c.Query("to")

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
				TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:00') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:00')
			ORDER BY date ASC
		`
	} else if durationHours <= 24*90 { // Under 90 days: group by day
		groupFormat = "YYYY-MM-DD"
		timelineQuery = `
			SELECT 
				TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
			ORDER BY date ASC
		`
	} else { // Over 90 days / year: group by month
		groupFormat = "YYYY-MM"
		timelineQuery = `
			SELECT 
				TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') as date,
				COALESCE(SUM(total_amount), 0) as net_revenue,
				COALESCE(SUM(subtotal), 0) as gross_sales,
				COALESCE(SUM(discount_amount + promotion_discount + platform_fee_discount), 0) as discounts,
				COUNT(id) as orders_count
			FROM orders
			WHERE status = 'completed' AND created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM')
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
				TO_CHAR(orders.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', '%s') as dt,
				COALESCE(SUM(orders.total_amount), 0) as rev,
				COALESCE(SUM(product_variants.cogs_price * order_items.quantity), 0) as cogs
			FROM orders
			JOIN order_items ON order_items.order_id = orders.id
			JOIN product_variants ON product_variants.id = order_items.product_variant_id
			WHERE orders.status = 'completed' AND orders.created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(orders.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', '%s')
		),
		expense_daily AS (
			SELECT 
				TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', '%s') as dt,
				COALESCE(SUM(CASE WHEN transaction_type = 'outflow' AND category != 'reconciliation_variance' THEN amount ELSE 0 END), 0) as exp,
				COALESCE(SUM(CASE WHEN transaction_type = 'inflow' AND reference_order_id IS NULL AND category != 'reconciliation_variance' THEN amount ELSE 0 END), 0) as inf
			FROM transactions
			WHERE created_at BETWEEN ? AND ?
			GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', '%s')
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
			TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS date,
			SUM(CASE WHEN transaction_type = 'inflow' THEN amount ELSE 0 END) AS inflow,
			SUM(CASE WHEN transaction_type = 'outflow' THEN amount ELSE 0 END) AS outflow
		FROM transactions
		WHERE created_at BETWEEN ? AND ?
		GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
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
	loc := getAnalyticsLocation()
	now := time.Now().In(loc)
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

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

// GetProductsSalesPerformance returns product-level sales, COGS, profit and margin analytics.
// GET /api/v1/analytics/products-sales-performance
// Query params:
//   - period (today|yesterday|week|month|year|custom), from, to — time window
//   - category_id — filter by category (optional)
//   - search — search by product name (optional)
//   - sort_by (quantity|revenue|profit|margin) — default: revenue
//   - sort_order (asc|desc) — default: desc
func (h *AnalyticsHandler) GetProductsSalesPerformance(c *gin.Context) {
	startTime, endTime, _, _, period, fromStr, toStr := parseAnalyticsPeriod(c)

	sortBy := strings.ToLower(c.DefaultQuery("sort_by", "revenue"))
	sortOrder := strings.ToLower(c.DefaultQuery("sort_order", "desc"))
	search := strings.TrimSpace(c.Query("search"))
	categoryIDStr := c.Query("category_id")

	// Validate sort direction to prevent SQL injection
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// --- Determine ORDER BY expression ---
	var orderExpr string
	switch sortBy {
	case "quantity":
		orderExpr = "quantity_sold " + strings.ToUpper(sortOrder)
	case "profit":
		orderExpr = "total_profit " + strings.ToUpper(sortOrder)
	case "margin":
		orderExpr = "margin_percentage " + strings.ToUpper(sortOrder)
	default:
		sortBy = "revenue"
		orderExpr = "total_revenue " + strings.ToUpper(sortOrder)
	}

	// --- Build base query grouped by product (all variants aggregated) ---
	type RawProductRow struct {
		ProductID    uint
		ProductName  string
		CategoryName string
		ImageURL     string
		QuantitySold int64
		TotalRevenue float64
		TotalCOGS    float64
		TotalProfit  float64
		// MarginPercentage computed in Go to avoid PostgreSQL CASE precision issues
	}

	baseQuery := h.db.Table("order_items").
		Select(`
			products.id                                                        as product_id,
			products.name                                                      as product_name,
			COALESCE(categories.name, 'Chưa phân loại')                       as category_name,
			COALESCE(products.image_url, '')                                   as image_url,
			SUM(order_items.quantity)                                          as quantity_sold,
			SUM(order_items.line_total)                                        as total_revenue,
			SUM(product_variants.cogs_price * order_items.quantity)            as total_cogs,
			SUM(order_items.line_total) - SUM(product_variants.cogs_price * order_items.quantity) as total_profit
		`).
		Joins("JOIN orders ON orders.id = order_items.order_id").
		Joins("JOIN product_variants ON product_variants.id = order_items.product_variant_id").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Joins("LEFT JOIN categories ON categories.id = products.category_id").
		Where("orders.status = ? AND orders.created_at BETWEEN ? AND ?", models.OrderStatusCompleted, startTime, endTime).
		Group("products.id, products.name, categories.name, products.image_url")

	// Optional search filter
	if search != "" {
		lowerSearch := "%" + strings.ToLower(search) + "%"
		baseQuery = baseQuery.Where("LOWER(products.name) LIKE ? OR LOWER(categories.name) LIKE ?", lowerSearch, lowerSearch)
	}

	// Optional category filter
	if categoryIDStr != "" {
		if catID, err := strconv.ParseUint(categoryIDStr, 10, 32); err == nil && catID > 0 {
			baseQuery = baseQuery.Where("products.category_id = ?", catID)
		}
	}

	// Fetch raw rows ordered by chosen column
	var rawRows []RawProductRow
	if err := baseQuery.Order(orderExpr).Scan(&rawRows).Error; err != nil {
		models.SendInternalError(c, "Failed to query product sales performance: "+err.Error())
		return
	}

	// --- Compute total revenue across ALL returned rows for revenue-share calculation ---
	var grandTotalRevenue float64
	for _, r := range rawRows {
		grandTotalRevenue += r.TotalRevenue
	}

	// --- Build response items and running summary ---
	items := make([]models.ProductSalesPerformanceItem, 0, len(rawRows))

	var (
		totalUnits  int64
		totalRev    float64
		totalProfit float64

		topSoldName    string
		topSoldQty     int64
		topRevName     string
		topRevAmount   float64
		topProfitName  string
		topProfitAmt   float64
	)

	for _, r := range rawRows {
		var marginPct float64
		if r.TotalRevenue > 0 {
			marginPct = math.Round((r.TotalProfit/r.TotalRevenue)*10000) / 100 // 2 decimal places
		}

		var revShare float64
		if grandTotalRevenue > 0 {
			revShare = math.Round((r.TotalRevenue/grandTotalRevenue)*10000) / 100
		}

		item := models.ProductSalesPerformanceItem{
			ProductID:              r.ProductID,
			ProductName:            r.ProductName,
			CategoryName:           r.CategoryName,
			ImageURL:               r.ImageURL,
			QuantitySold:           r.QuantitySold,
			TotalRevenue:           r.TotalRevenue,
			TotalCOGS:              r.TotalCOGS,
			TotalProfit:            r.TotalProfit,
			MarginPercentage:       marginPct,
			RevenueSharePercentage: revShare,
		}
		items = append(items, item)

		// Accumulate totals
		totalUnits += r.QuantitySold
		totalRev += r.TotalRevenue
		totalProfit += r.TotalProfit

		// Track leaders (always scanning full slice regardless of sort order)
		if r.QuantitySold > topSoldQty {
			topSoldQty = r.QuantitySold
			topSoldName = r.ProductName
		}
		if r.TotalRevenue > topRevAmount {
			topRevAmount = r.TotalRevenue
			topRevName = r.ProductName
		}
		if r.TotalProfit > topProfitAmt {
			topProfitAmt = r.TotalProfit
			topProfitName = r.ProductName
		}
	}

	// Average margin: weighted by revenue share
	var avgMargin float64
	if totalRev > 0 {
		avgMargin = math.Round((totalProfit/totalRev)*10000) / 100
	}

	summary := models.ProductSalesPerformanceSummary{
		TotalUnitsSold:          totalUnits,
		TotalProductsRevenue:    totalRev,
		TotalProductsProfit:     totalProfit,
		AverageMarginPercentage: avgMargin,
		TopSoldProduct:          topSoldName,
		TopRevenueProduct:       topRevName,
		TopProfitProduct:        topProfitName,
	}

	resp := models.ProductSalesPerformanceResponse{
		Summary: summary,
		Items:   items,
		Period:  period,
		From:    fromStr,
		To:      toStr,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Product sales performance retrieved successfully")
}

// HourlyDistributionItem holds metrics for one hour of the day (0..23)
type HourlyDistributionItem struct {
	Hour        int     `json:"hour"`
	Label       string  `json:"label"` // e.g. "07:00 - 08:00"
	OrderCount  int64   `json:"order_count"`
	Revenue     float64 `json:"revenue"`
	Percentage  float64 `json:"percentage"`
}

type HourlyDistributionResponse struct {
	Items        []HourlyDistributionItem `json:"items"`
	TotalOrders  int64                    `json:"total_orders"`
	TotalRevenue float64                  `json:"total_revenue"`
	PeakHour     string                   `json:"peak_hour"`
	PeakOrders   int64                    `json:"peak_orders"`
	Period       string                   `json:"period"`
	From         string                   `json:"from"`
	To           string                   `json:"to"`
}

// GetHourlyDistribution computes order count and revenue grouped by hour (0..23)
// GET /api/v1/analytics/hourly-distribution
func (h *AnalyticsHandler) GetHourlyDistribution(c *gin.Context) {
	startTime, endTime, _, _, period, fromStr, toStr := parseAnalyticsPeriod(c)

	type HourlyRaw struct {
		Hour       int     `gorm:"column:hour"`
		OrderCount int64   `gorm:"column:order_count"`
		Revenue    float64 `gorm:"column:revenue"`
	}

	var rawRows []HourlyRaw
	query := `
		SELECT 
			EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::INTEGER as hour,
			COUNT(id) as order_count,
			COALESCE(SUM(total_amount), 0) as revenue
		FROM orders
		WHERE status = 'completed' AND created_at BETWEEN ? AND ?
		GROUP BY hour
		ORDER BY hour ASC
	`

	if err := h.db.Raw(query, startTime, endTime).Scan(&rawRows).Error; err != nil {
		models.SendInternalError(c, "Failed to calculate hourly distribution: "+err.Error())
		return
	}

	hourMap := make(map[int]HourlyRaw)
	var grandTotalRevenue float64
	var grandTotalOrders int64
	for _, r := range rawRows {
		hourMap[r.Hour] = r
		grandTotalRevenue += r.Revenue
		grandTotalOrders += r.OrderCount
	}

	items := make([]HourlyDistributionItem, 24)
	var peakHourLabel string = "—"
	var peakOrders int64 = 0

	for hIdx := 0; hIdx < 24; hIdx++ {
		raw := hourMap[hIdx]
		var pct float64
		if grandTotalRevenue > 0 {
			pct = math.Round((raw.Revenue/grandTotalRevenue)*10000) / 100
		}

		label := fmt.Sprintf("%02d:00 - %02d:00", hIdx, (hIdx+1)%24)
		items[hIdx] = HourlyDistributionItem{
			Hour:       hIdx,
			Label:      label,
			OrderCount: raw.OrderCount,
			Revenue:    raw.Revenue,
			Percentage: pct,
		}

		if raw.OrderCount > peakOrders {
			peakOrders = raw.OrderCount
			peakHourLabel = label
		}
	}

	resp := HourlyDistributionResponse{
		Items:        items,
		TotalOrders:  grandTotalOrders,
		TotalRevenue: grandTotalRevenue,
		PeakHour:     peakHourLabel,
		PeakOrders:   peakOrders,
		Period:       period,
		From:         fromStr,
		To:           toStr,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Hourly distribution retrieved successfully")
}
