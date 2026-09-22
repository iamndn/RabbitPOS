package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
)

func setupFinancialTestRouter(orderHandler *OrderHandler, analyticsHandler *AnalyticsHandler, fundHandler *FundHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Set("username", "admin_boss")
		c.Set("user_id", uint(1))
		c.Next()
	})
	router.POST("/api/v1/orders", orderHandler.CreateOrder)
	router.POST("/api/v1/orders/:id/cancel", orderHandler.CancelOrder)
	router.DELETE("/api/v1/orders/:id", orderHandler.DeleteOrder)
	if analyticsHandler != nil {
		router.GET("/api/v1/analytics/profit", analyticsHandler.GetProfitAnalytics)
		router.GET("/api/v1/analytics/dashboard-metrics", analyticsHandler.GetDashboardMetrics)
	}
	if fundHandler != nil {
		router.GET("/api/v1/funds/cashier-shift-summary", fundHandler.GetCashierShiftSummary)
	}
	return router
}

func TestFinancial_OrderCancellationWithRefund_DoesNotCountAsOperatingExpense(t *testing.T) {
	db := testutils.GetTestDB(t)
	_ = testutils.CleanTables(db)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	orderHandler := NewOrderHandler(db, nil, nil)
	analyticsHandler := NewAnalyticsHandler(db, nil)
	fundHandler := NewFundHandler(db, nil)
	router := setupFinancialTestRouter(orderHandler, analyticsHandler, fundHandler)

	initialBalance := fixtures.CashFund.CurrentBalance

	// 1. Create an order (Price: RetailPrice * 2)
	itemPrice := fixtures.Variant.RetailPrice
	totalOrderAmount := itemPrice * 2
	payload := models.CreateOrderRequest{
		FundID: fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         2,
			},
		},
	}
	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Order creation failed: %s", w.Body.String())
	}

	var createResp struct {
		Data models.Order `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &createResp)
	orderID := createResp.Data.ID

	// Verify fund increased
	var fundAfterCreate models.Fund
	db.First(&fundAfterCreate, fixtures.CashFund.ID)
	if fundAfterCreate.CurrentBalance != initialBalance+totalOrderAmount {
		t.Fatalf("Fund expected %.0f, got %.0f", initialBalance+totalOrderAmount, fundAfterCreate.CurrentBalance)
	}

	// 2. Cancel order WITH refund
	cancelPayload := models.CancelOrderRequest{
		Refund:       true,
		CancelReason: "Khách đổi ý muốn hoàn tiền",
	}
	cancelBytes, _ := json.Marshal(cancelPayload)
	cancelReq, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/orders/%d/cancel", orderID), bytes.NewBuffer(cancelBytes))
	cancelReq.Header.Set("Content-Type", "application/json")
	wCancel := httptest.NewRecorder()
	router.ServeHTTP(wCancel, cancelReq)

	if wCancel.Code != http.StatusOK {
		t.Fatalf("Order cancellation failed: %s", wCancel.Body.String())
	}

	// Verify fund reverted back to initial
	var fundAfterCancel models.Fund
	db.First(&fundAfterCancel, fixtures.CashFund.ID)
	if fundAfterCancel.CurrentBalance != initialBalance {
		t.Fatalf("Fund after cancel expected %.0f, got %.0f", initialBalance, fundAfterCancel.CurrentBalance)
	}

	// 3. Query Profit Analytics - operating expenses MUST be 0 and net profit MUST NOT be negative!
	todayStr := time.Now().Format("2006-01-02")
	profitReq, _ := http.NewRequest("GET", fmt.Sprintf("/api/v1/analytics/profit?period=custom&from=%s&to=%s", todayStr, todayStr), nil)
	wProfit := httptest.NewRecorder()
	router.ServeHTTP(wProfit, profitReq)

	if wProfit.Code != http.StatusOK {
		t.Fatalf("GetProfitAnalytics failed: %s", wProfit.Body.String())
	}

	var profitResp struct {
		Data struct {
			Summary struct {
				NetRevenue        float64 `json:"net_revenue"`
				OperatingExpenses float64 `json:"operating_expenses"`
				NetProfit         float64 `json:"net_profit"`
			} `json:"summary"`
		} `json:"data"`
	}
	_ = json.Unmarshal(wProfit.Body.Bytes(), &profitResp)

	if profitResp.Data.Summary.OperatingExpenses != 0 {
		t.Errorf("Expected operating expenses to be 0, but got %.2f (order refund was falsely counted as operating expense!)", profitResp.Data.Summary.OperatingExpenses)
	}
	if profitResp.Data.Summary.NetProfit < 0 {
		t.Errorf("Expected net profit not to be negative, but got %.2f", profitResp.Data.Summary.NetProfit)
	}

	// 4. Query Cashier Shift Summary - orderCount MUST be 0 because cancelled orders should not count as completed
	shiftReq, _ := http.NewRequest("GET", fmt.Sprintf("/api/v1/funds/cashier-shift-summary?cashier=admin_boss&date=%s", todayStr), nil)
	wShift := httptest.NewRecorder()
	router.ServeHTTP(wShift, shiftReq)

	if wShift.Code != http.StatusOK {
		t.Fatalf("GetCashierShiftSummary failed: %s", wShift.Body.String())
	}

	var shiftResp struct {
		Data models.CashierShiftSummary `json:"data"`
	}
	_ = json.Unmarshal(wShift.Body.Bytes(), &shiftResp)

	if shiftResp.Data.OrderCount != 0 {
		t.Errorf("Expected completed order count to be 0, got %d", shiftResp.Data.OrderCount)
	}

	// 5. Permanently delete the cancelled order
	delReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/v1/orders/%d", orderID), nil)
	wDel := httptest.NewRecorder()
	router.ServeHTTP(wDel, delReq)

	if wDel.Code != http.StatusOK {
		t.Fatalf("DeleteOrder failed: %s", wDel.Body.String())
	}

	// Verify order is deleted
	var deletedOrder models.Order
	if err := db.First(&deletedOrder, orderID).Error; err == nil {
		t.Errorf("Order %d should be deleted from DB", orderID)
	}

	// Verify all linked transactions are deleted
	var txCount int64
	db.Model(&models.Transaction{}).Where("reference_order_id = ?", orderID).Count(&txCount)
	if txCount != 0 {
		t.Errorf("Expected 0 linked transactions, got %d", txCount)
	}

	// Verify fund balance remains clean at initialBalance
	var fundAfterDel models.Fund
	db.First(&fundAfterDel, fixtures.CashFund.ID)
	if fundAfterDel.CurrentBalance != initialBalance {
		t.Errorf("Fund balance corrupted after deleting cancelled order! Expected %.0f, got %.0f", initialBalance, fundAfterDel.CurrentBalance)
	}
}
