package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
)

func setupOrderTestRouter(handler *OrderHandler, role string, username string, userID uint) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if role != "" {
			c.Set("role", role)
		}
		if username != "" {
			c.Set("username", username)
		}
		if userID > 0 {
			c.Set("user_id", userID)
		}
		c.Next()
	})
	router.POST("/api/v1/orders", handler.CreateOrder)
	return router
}

func TestOrder_Unauthorized_PriceOverride(t *testing.T) {
	handler := NewOrderHandler(nil, nil, nil)
	// Staff / Cashier role without admin privileges
	router := setupOrderTestRouter(handler, "cashier", "staff_bob", 5)

	customPrice := 20000.0
	payload := models.CreateOrderRequest{
		FundID: 1,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: 1,
				Quantity:         1,
				PriceOverride:    &customPrice, // Unauthorized override attempt by staff
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden when non-admin attempts price override, got %d. Body: %s", w.Code, w.Body.String())
	}

	var errResp models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp.ErrorCode != "AUTH_FORBIDDEN_ROLE" {
		t.Errorf("Expected error_code AUTH_FORBIDDEN_ROLE, got %s", errResp.ErrorCode)
	}
}

func TestOrder_Unauthorized_Backdating(t *testing.T) {
	handler := NewOrderHandler(nil, nil, nil)
	// Staff / Cashier role without admin privileges
	router := setupOrderTestRouter(handler, "cashier", "staff_bob", 5)

	pastDate := time.Now().Add(-24 * time.Hour)
	payload := models.CreateOrderRequest{
		FundID:    1,
		CreatedAt: &pastDate, // Unauthorized backdating attempt by staff
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: 1,
				Quantity:         1,
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden when non-admin attempts backdating, got %d. Body: %s", w.Code, w.Body.String())
	}

	var errResp models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp.ErrorCode != "AUTH_FORBIDDEN_ROLE" {
		t.Errorf("Expected error_code AUTH_FORBIDDEN_ROLE, got %s", errResp.ErrorCode)
	}
}

func TestOrder_ServerAuthoritative_PriceTampering(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	handler := NewOrderHandler(db, nil, nil)
	router := setupOrderTestRouter(handler, "cashier", "staff1", 2)

	// Tampered payload: Client tries to claim unit_price = 1,000 VND instead of DB price (e.g. 25,000 VND)
	tamperedPayload := models.CreateOrderRequest{
		FundID: fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         2,
				UnitPrice:        1000, // Tampered client price!
				LineTotal:        2000,
			},
		},
		TotalAmount: 2000, // Tampered total
	}

	bodyBytes, _ := json.Marshal(tamperedPayload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Expected status 201 Created, got %d. Body: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Status string       `json:"status"`
		Data   models.Order `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	// Expected: DB RetailPrice * 2
	expectedSubtotal := fixtures.Variant.RetailPrice * 2
	if resp.Data.Subtotal != expectedSubtotal {
		t.Errorf("Price tampering test failed: expected server-calculated subtotal %.0f, got %.0f", expectedSubtotal, resp.Data.Subtotal)
	}
	if resp.Data.TotalAmount != expectedSubtotal {
		t.Errorf("Price tampering test failed: expected server-calculated total %.0f, got %.0f", expectedSubtotal, resp.Data.TotalAmount)
	}
	if len(resp.Data.Items) > 0 && resp.Data.Items[0].UnitPrice != fixtures.Variant.RetailPrice {
		t.Errorf("Expected item UnitPrice to match DB %.0f, got %.0f", fixtures.Variant.RetailPrice, resp.Data.Items[0].UnitPrice)
	}
}

func TestOrder_InvalidTopping_Inactive(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	// Create an inactive topping
	inactiveTopping := models.Topping{
		Name:     "Topping Đã Hết",
		Price:    10000,
		IsActive: false,
	}
	db.Create(&inactiveTopping)

	handler := NewOrderHandler(db, nil, nil)
	router := setupOrderTestRouter(handler, "cashier", "staff1", 2)

	payload := models.CreateOrderRequest{
		FundID: fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
				ToppingIDs:       []uint{inactiveTopping.ID},
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request when referencing inactive topping, got %d", w.Code)
	}
}

func TestOrder_Promotion_ExpiredOrLimitExceeded(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	// Create expired promotion
	pastDate := time.Now().Add(-48 * time.Hour)
	expiredPromo := models.Promotion{
		Name:          "Khuyến mãi hết hạn",
		PromoType:     models.PromoTypeDiscountAmount,
		DiscountValue: 10000,
		EndDate:       &pastDate,
		IsActive:      true,
	}
	db.Create(&expiredPromo)

	handler := NewOrderHandler(db, nil, nil)
	router := setupOrderTestRouter(handler, "cashier", "staff1", 2)

	payload := models.CreateOrderRequest{
		FundID:      fixtures.CashFund.ID,
		PromotionID: &expiredPromo.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for expired promotion, got %d", w.Code)
	}
}

func TestOrder_Idempotency_DuplicateSuccess(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	// Record initial fund balance
	var initialFund models.Fund
	db.First(&initialFund, fixtures.CashFund.ID)
	initialBalance := initialFund.CurrentBalance

	handler := NewOrderHandler(db, nil, nil)
	router := setupOrderTestRouter(handler, "cashier", "staff1", 2)

	idempotencyKey := "test-idempotency-key-001"
	payload := models.CreateOrderRequest{
		IdempotencyKey: idempotencyKey,
		FundID:         fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)

	// 1st Request
	req1, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("First order request failed: %s", w1.Body.String())
	}

	var resp1 struct {
		Data models.Order `json:"data"`
	}
	_ = json.Unmarshal(w1.Body.Bytes(), &resp1)

	// 2nd Request (Identical retry)
	req2, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Fatalf("Second order request failed: %s", w2.Body.String())
	}

	if w2.Header().Get("X-Cache-Lookup") != "HIT-IDEMPOTENT" {
		t.Errorf("Expected header X-Cache-Lookup: HIT-IDEMPOTENT on duplicate request")
	}

	var resp2 struct {
		Data models.Order `json:"data"`
	}
	_ = json.Unmarshal(w2.Body.Bytes(), &resp2)

	if resp1.Data.ID != resp2.Data.ID || resp1.Data.OrderCode != resp2.Data.OrderCode {
		t.Errorf("Expected identical order returned for duplicate idempotency key")
	}

	// Verify Fund balance only incremented ONCE
	var finalFund models.Fund
	db.First(&finalFund, fixtures.CashFund.ID)
	expectedBalance := initialBalance + fixtures.Variant.RetailPrice
	if finalFund.CurrentBalance != expectedBalance {
		t.Errorf("Fund balance double-incremented! Expected %.0f, got %.0f", expectedBalance, finalFund.CurrentBalance)
	}
}

func TestOrder_Idempotency_Conflict(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	handler := NewOrderHandler(db, nil, nil)
	router := setupOrderTestRouter(handler, "cashier", "staff1", 2)

	idempotencyKey := "test-idempotency-key-conflict-002"
	payload1 := models.CreateOrderRequest{
		IdempotencyKey: idempotencyKey,
		FundID:         fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
			},
		},
	}
	bodyBytes1, _ := json.Marshal(payload1)
	req1, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("First order request failed: %s", w1.Body.String())
	}

	// Second request with SAME key but DIFFERENT quantity (changed payload)
	payload2 := models.CreateOrderRequest{
		IdempotencyKey: idempotencyKey,
		FundID:         fixtures.CashFund.ID,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         5, // Changed quantity!
			},
		},
	}
	bodyBytes2, _ := json.Marshal(payload2)
	req2, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusConflict {
		t.Errorf("Expected 409 Conflict on idempotency key payload mismatch, got %d. Body: %s", w2.Code, w2.Body.String())
	}

	var errResp models.ResponseEnvelope
	_ = json.Unmarshal(w2.Body.Bytes(), &errResp)
	if errResp.ErrorCode != "ORDER_IDEMPOTENT_CONFLICT" {
		t.Errorf("Expected error_code ORDER_IDEMPOTENT_CONFLICT, got %s", errResp.ErrorCode)
	}
}

func TestOrder_Admin_PriceOverride_Success(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	handler := NewOrderHandler(db, nil, nil)
	// Admin role
	router := setupOrderTestRouter(handler, "admin", "admin_boss", 1)

	customPrice := 25000.0
	overrideReason := "Chiết khấu đặc biệt cho khách VIP"
	payload := models.CreateOrderRequest{
		FundID:         fixtures.CashFund.ID,
		OverrideReason: overrideReason,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
				PriceOverride:    &customPrice,
				OverrideReason:   overrideReason,
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Admin price override failed with status %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Data models.Order `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if !resp.Data.IsPriceOverridden {
		t.Errorf("Expected order.IsPriceOverridden to be true")
	}
	if resp.Data.TotalAmount != 25000 {
		t.Errorf("Expected TotalAmount to match overridden price 25,000, got %.0f", resp.Data.TotalAmount)
	}
	if len(resp.Data.Items) > 0 {
		if !resp.Data.Items[0].IsPriceOverridden {
			t.Errorf("Expected item.IsPriceOverridden to be true")
		}
		if resp.Data.Items[0].OriginalUnitPrice != fixtures.Variant.RetailPrice {
			t.Errorf("Expected item.OriginalUnitPrice to be %.0f, got %.0f", fixtures.Variant.RetailPrice, resp.Data.Items[0].OriginalUnitPrice)
		}
	}
}
