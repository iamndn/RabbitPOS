package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupPOSFastCheckoutRouter(db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	orderHandler := NewOrderHandler(db, nil, nil)
	analyticsHandler := NewAnalyticsHandler(db, nil)

	r.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Set("username", "admin_tester")
		c.Set("user_id", uint(1))

		storeID := uint(1)
		if s := c.GetHeader("X-Store-ID"); s != "" {
			if id, err := strconv.ParseUint(s, 10, 32); err == nil && id > 0 {
				storeID = uint(id)
			}
		}
		c.Set("store_id", storeID)
		c.Next()
	})

	v1 := r.Group("/api/v1")
	{
		v1.GET("/orders", orderHandler.ListOrders)
		v1.POST("/orders", orderHandler.CreateOrder)
		v1.GET("/analytics/revenue", analyticsHandler.GetRevenueAnalytics)
	}

	return r
}

func TestStoreSettingsKeys_CommissionsWhitelist(t *testing.T) {
	requiredKeys := []string{
		"commission_shopeefood_pct",
		"commission_grabfood_pct",
		"commission_befood_pct",
	}

	for _, k := range requiredKeys {
		if !models.StoreSettingsKeys[k] {
			t.Errorf("Expected StoreSettingsKeys to contain %q, but it was missing", k)
		}
	}
}

func TestPOSFastCheckout_DailySeqNoAndChannels(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed minimal fixtures: %v", err)
	}

	r := setupPOSFastCheckoutRouter(db)

	// Create Store 2 to test sequence isolation across stores
	store2 := models.Store{
		Code:         fmt.Sprintf("branch-test-%d", time.Now().UnixNano()),
		Name:         "Store Branch 2",
		BusinessType: "cafe",
		Timezone:     "Asia/Ho_Chi_Minh",
		IsActive:     true,
	}
	if err := db.Create(&store2).Error; err != nil {
		t.Fatalf("Failed to create store 2: %v", err)
	}

	// Create Product and Variant for Store 2
	product2 := models.Product{
		StoreID:    store2.ID,
		Name:       "Store2 Product",
		CategoryID: fixtures.Category.ID,
		IsActive:   true,
	}
	db.Create(&product2)
	variant2 := models.ProductVariant{
		ProductID:   product2.ID,
		VariantName: "Standard",
		RetailPrice: 35000,
	}
	db.Create(&variant2)

	fund2 := models.Fund{
		StoreID:        store2.ID,
		Name:           "Store2 Cash",
		FundType:       models.FundTypeCash,
		CurrentBalance: 0,
		IsActive:       true,
	}
	db.Create(&fund2)

	// Step 1: Create Order 1 for Store 1 (dine_in)
	orderReq1 := models.CreateOrderRequest{
		FundID:       fixtures.CashFund.ID,
		SalesChannel: models.SalesChannelDineIn,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
			},
		},
	}
	body1, _ := json.Marshal(orderReq1)
	req1 := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body1))
	req1.Header.Set("X-Store-ID", "1")
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)

	if w1.Code != http.StatusCreated {
		t.Fatalf("Expected 201 creating Order 1, got %d: %s", w1.Code, w1.Body.String())
	}
	var res1 struct {
		Data models.Order `json:"data"`
	}
	json.Unmarshal(w1.Body.Bytes(), &res1)
	if res1.Data.DailySeqNo < 1 {
		t.Errorf("Expected Order 1 daily_seq_no >= 1, got %d", res1.Data.DailySeqNo)
	}
	firstStoreSeq := res1.Data.DailySeqNo
	if res1.Data.SalesChannel != models.SalesChannelDineIn {
		t.Errorf("Expected Order 1 sales_channel='dine_in', got %s", res1.Data.SalesChannel)
	}

	// Step 2: Create Order 2 for Store 1 (shopeefood with 20% platform commission)
	commPct := 20.0
	orderReq2 := models.CreateOrderRequest{
		FundID:                    fixtures.CashFund.ID,
		SalesChannel:              models.SalesChannelShopeeFood,
		PlatformCommissionPercent: &commPct,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: fixtures.Variant.ID,
				Quantity:         1,
			},
		},
	}
	body2, _ := json.Marshal(orderReq2)
	req2 := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(body2))
	req2.Header.Set("X-Store-ID", "1")
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Fatalf("Expected 201 creating Order 2, got %d: %s", w2.Code, w2.Body.String())
	}
	var res2 struct {
		Data models.Order `json:"data"`
	}
	json.Unmarshal(w2.Body.Bytes(), &res2)
	if res2.Data.DailySeqNo != firstStoreSeq+1 {
		t.Errorf("Expected Order 2 daily_seq_no=%d, got %d", firstStoreSeq+1, res2.Data.DailySeqNo)
	}
	if res2.Data.SalesChannel != models.SalesChannelShopeeFood {
		t.Errorf("Expected Order 2 sales_channel='shopeefood', got %s", res2.Data.SalesChannel)
	}
	if res2.Data.PlatformCommissionPercent != 20.0 {
		t.Errorf("Expected Order 2 platform_commission_percent=20.0, got %f", res2.Data.PlatformCommissionPercent)
	}

	// Step 3: Create Order 1 for Store 2 -> Daily sequence should be 1 (isolated from Store 1)
	orderReqS2 := models.CreateOrderRequest{
		FundID:       fund2.ID,
		SalesChannel: models.SalesChannelGrabFood,
		Items: []models.CreateOrderItemRequest{
			{
				ProductVariantID: variant2.ID,
				Quantity:         1,
			},
		},
	}
	bodyS2, _ := json.Marshal(orderReqS2)
	reqS2 := httptest.NewRequest("POST", "/api/v1/orders", bytes.NewBuffer(bodyS2))
	reqS2.Header.Set("X-Store-ID", fmt.Sprintf("%d", store2.ID))
	reqS2.Header.Set("Content-Type", "application/json")
	wS2 := httptest.NewRecorder()
	r.ServeHTTP(wS2, reqS2)

	if wS2.Code != http.StatusCreated {
		t.Fatalf("Expected 201 creating Store 2 Order 1, got %d: %s", wS2.Code, wS2.Body.String())
	}
	var resS2 struct {
		Data models.Order `json:"data"`
	}
	json.Unmarshal(wS2.Body.Bytes(), &resS2)
	if resS2.Data.DailySeqNo != 1 {
		t.Errorf("Expected Store 2 Order 1 daily_seq_no=1, got %d", resS2.Data.DailySeqNo)
	}
	if resS2.Data.SalesChannel != models.SalesChannelGrabFood {
		t.Errorf("Expected Store 2 sales_channel='grabfood', got %s", resS2.Data.SalesChannel)
	}

	// Step 4: Test ListOrders with ?sales_channel= filter
	reqList := httptest.NewRequest("GET", "/api/v1/orders?sales_channel=shopeefood", nil)
	reqList.Header.Set("X-Store-ID", "1")
	wList := httptest.NewRecorder()
	r.ServeHTTP(wList, reqList)

	if wList.Code != http.StatusOK {
		t.Fatalf("Expected 200 on ListOrders with sales_channel filter, got %d", wList.Code)
	}
	var listRes struct {
		Data []models.Order `json:"data"`
	}
	json.Unmarshal(wList.Body.Bytes(), &listRes)
	if len(listRes.Data) < 1 {
		t.Fatalf("Expected >= 1 order filtered by sales_channel=shopeefood, got %d", len(listRes.Data))
	}
	for _, o := range listRes.Data {
		if o.SalesChannel != models.SalesChannelShopeeFood {
			t.Errorf("Expected filtered order to be shopeefood, got %s", o.SalesChannel)
		}
	}

	// Step 5: Test Revenue Analytics Breakdown by Sales Channel
	reqAnalytics := httptest.NewRequest("GET", "/api/v1/analytics/revenue?period=today", nil)
	reqAnalytics.Header.Set("X-Store-ID", "1")
	wAnalytics := httptest.NewRecorder()
	r.ServeHTTP(wAnalytics, reqAnalytics)

	if wAnalytics.Code != http.StatusOK {
		t.Fatalf("Expected 200 on GetRevenueAnalytics, got %d", wAnalytics.Code)
	}
	var analyticsRes struct {
		Data models.RevenueAnalyticsResponse `json:"data"`
	}
	json.Unmarshal(wAnalytics.Body.Bytes(), &analyticsRes)
	if len(analyticsRes.Data.RevenueByChannel) == 0 {
		t.Errorf("Expected non-empty RevenueByChannel in revenue analytics, got 0")
	} else {
		foundShopee := false
		foundDineIn := false
		for _, cb := range analyticsRes.Data.RevenueByChannel {
			if cb.SalesChannel == models.SalesChannelShopeeFood {
				foundShopee = true
			}
			if cb.SalesChannel == models.SalesChannelDineIn {
				foundDineIn = true
			}
		}
		if !foundShopee || !foundDineIn {
			t.Errorf("Expected both shopeefood and dine_in in RevenueByChannel, got: %+v", analyticsRes.Data.RevenueByChannel)
		}
	}
}
