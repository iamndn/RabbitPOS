package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// helper to issue JWT token for test user
func generateIsolationToken(userID uint, username string, role models.UserRole, jwtSecret string) string {
	tokenStr, _, _ := utils.GenerateJWT(userID, username, role, 0, jwtSecret, 24)
	return tokenStr
}

func doAuthRequest(router *gin.Engine, method, path, token string, storeID uint, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if storeID > 0 {
		req.Header.Set("X-Store-ID", fmt.Sprintf("%d", storeID))
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return w, resp
}

func setupIsolationRouter(cfg *config.Config, db *gorm.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	catHandler := NewCategoryHandler(db, nil)
	prodHandler := NewProductHandler(db, nil)
	varHandler := NewVariantHandler(db, nil)
	topHandler := NewToppingHandler(db, nil)
	promoHandler := NewPromotionHandler(db)
	fundHandler := NewFundHandler(db, nil)
	orderHandler := NewOrderHandler(db, nil, nil)
	txHandler := NewTransactionHandler(db, nil, nil)
	purchaseHandler := NewPurchaseHandler(db, nil, nil)
	settingHandler := NewSettingHandler(db, nil, nil, nil)
	analyticsHandler := NewAnalyticsHandler(db, nil)

	v1 := r.Group("/api/v1")
	auth := v1.Group("", middleware.AuthMiddleware(cfg.JWTSecret, db))
	storeScoped := auth.Group("", middleware.StoreContext(db, nil, cfg.StoreHeaderRequired))
	{
		storeScoped.GET("/categories", catHandler.ListCategories)
		storeScoped.GET("/products", prodHandler.ListProducts)
		storeScoped.GET("/products/:id", prodHandler.GetProductByID)
		storeScoped.GET("/toppings", topHandler.ListToppings)
		storeScoped.GET("/promotions/active", promoHandler.GetActivePromotions)
		storeScoped.GET("/funds", fundHandler.ListFunds)
		storeScoped.GET("/funds/:id/balance", fundHandler.GetFundBalance)
		storeScoped.GET("/orders", orderHandler.ListOrders)
		storeScoped.GET("/orders/:id", orderHandler.GetOrderByID)
		storeScoped.POST("/orders", orderHandler.CreateOrder)
		storeScoped.GET("/purchases/ingredients", purchaseHandler.ListIngredients)
		storeScoped.GET("/settings/store", settingHandler.GetStoreSettings)

		storeAdmin := storeScoped.Group("", middleware.RequireStoreRole(models.StoreRoleStoreAdmin))
		{
			storeAdmin.POST("/categories", catHandler.CreateCategory)
			storeAdmin.PUT("/categories/:id", catHandler.UpdateCategory)
			storeAdmin.DELETE("/categories/:id", catHandler.DeleteCategory)
			storeAdmin.POST("/products", prodHandler.CreateProduct)
			storeAdmin.PUT("/products/:id", prodHandler.UpdateProduct)
			storeAdmin.PUT("/variants/:id", varHandler.UpdateVariant)
			storeAdmin.PUT("/toppings/:id", topHandler.UpdateTopping)
			storeAdmin.PUT("/promotions/:id", promoHandler.UpdatePromotion)
			storeAdmin.POST("/funds/:id/reconcile", fundHandler.ReconcileFund)
			storeAdmin.GET("/transactions", txHandler.ListTransactions)
			storeAdmin.POST("/transactions", txHandler.CreateTransaction)
			storeAdmin.PUT("/purchases/ingredients/:id", purchaseHandler.UpdateIngredient)
			storeAdmin.GET("/analytics/dashboard", analyticsHandler.GetDashboardMetrics)
		}
	}
	return r
}

// TestTwoStoreIsolation verifies that Store A resources are completely inaccessible
// to Store B users across read, update, delete, cross-referencing, and analytics.
func TestTwoStoreIsolation(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	_ = testutils.CleanTables(db)

	cfg := &config.Config{
		AppEnv:              "test",
		JWTSecret:           "test-secret-key-for-tenant-isolation-must-be-long-enough-32-chars",
		StoreHeaderRequired: true,
		EnableMultiStore:    true,
	}

	router := setupIsolationRouter(cfg, db)

	// 1. Create two stores: Store A (id: A) and Store B (id: B)
	storeA := models.Store{Code: "store-alpha", Name: "Store Alpha", BusinessType: "cafe", IsActive: true}
	if err := db.Create(&storeA).Error; err != nil {
		t.Fatalf("failed to create store A: %v", err)
	}
	storeB := models.Store{Code: "store-beta", Name: "Store Beta", BusinessType: "retail", IsActive: true}
	if err := db.Create(&storeB).Error; err != nil {
		t.Fatalf("failed to create store B: %v", err)
	}

	// 2. Create users
	// Admin A: store_admin in Store A
	adminA := models.User{Username: "admin_a", Role: models.RoleStaff, PasswordHash: "x", IsActive: true}
	db.Create(&adminA)
	db.Create(&models.UserStore{UserID: adminA.ID, StoreID: storeA.ID, Role: models.StoreRoleStoreAdmin, IsDefault: true})

	// Staff A: staff in Store A
	staffA := models.User{Username: "staff_a", Role: models.RoleStaff, PasswordHash: "x", IsActive: true}
	db.Create(&staffA)
	db.Create(&models.UserStore{UserID: staffA.ID, StoreID: storeA.ID, Role: models.StoreRoleStaff, IsDefault: true})

	// Admin B: store_admin in Store B
	adminB := models.User{Username: "admin_b", Role: models.RoleStaff, PasswordHash: "x", IsActive: true}
	db.Create(&adminB)
	db.Create(&models.UserStore{UserID: adminB.ID, StoreID: storeB.ID, Role: models.StoreRoleStoreAdmin, IsDefault: true})

	tokenAdminA := generateIsolationToken(adminA.ID, adminA.Username, adminA.Role, cfg.JWTSecret)
	tokenStaffA := generateIsolationToken(staffA.ID, staffA.Username, staffA.Role, cfg.JWTSecret)
	tokenAdminB := generateIsolationToken(adminB.ID, adminB.Username, adminB.Role, cfg.JWTSecret)

	// 3. Populate entities belonging to Store A
	catA := models.Category{StoreID: storeA.ID, Name: "Drinks Alpha", IsActive: true}
	db.Create(&catA)

	prodA := models.Product{StoreID: storeA.ID, CategoryID: catA.ID, Name: "Matcha Latte Alpha", IsActive: true}
	db.Create(&prodA)

	varA := models.ProductVariant{ProductID: prodA.ID, VariantName: "Large Alpha", RetailPrice: 55000, IsActive: true}
	db.Create(&varA)

	topA := models.Topping{StoreID: storeA.ID, Name: "Boba Alpha", Price: 10000, IsActive: true}
	db.Create(&topA)

	nowMinus1h := time.Now().Add(-1 * time.Hour)
	nowPlus24h := time.Now().Add(24 * time.Hour)
	promoA := models.Promotion{
		StoreID: storeA.ID, Name: "Summer Sale Alpha", PromoType: models.PromoTypeDiscountPercent, DiscountValue: 20, Scope: models.PromoScopeAll,
		StartDate: &nowMinus1h, EndDate: &nowPlus24h, IsActive: true,
	}
	db.Create(&promoA)

	fundA := models.Fund{StoreID: storeA.ID, Name: "Cash Fund Alpha", FundType: models.FundTypeCash, CurrentBalance: 500000, IsActive: true}
	db.Create(&fundA)

	ingA := models.Ingredient{StoreID: storeA.ID, Name: "Matcha Powder Alpha", Unit: "g", BaseUnit: "g", LatestPurchasePrice: 200}
	db.Create(&ingA)

	txCatA := models.TransactionCategoryItem{StoreID: storeA.ID, Name: "Ice Alpha", Type: "outflow"}
	db.Create(&txCatA)

	orderA := models.Order{
		StoreID: storeA.ID, OrderCode: "ORD-ALPHA-001", TotalAmount: 45000, Status: models.OrderStatusCompleted,
		FundID: fundA.ID, CreatedAt: time.Now(),
	}
	db.Create(&orderA)

	txA := models.Transaction{
		StoreID: storeA.ID, FundID: fundA.ID, TransactionType: models.TransactionTypeInflow,
		Amount: 45000, Category: "sale", CreatedAt: time.Now(),
	}
	db.Create(&txA)

	db.Create(&models.StoreSetting{StoreID: storeA.ID, Key: "report_recipient_emails", Value: "alpha@example.com"})
	db.Create(&models.StoreSetting{StoreID: storeB.ID, Key: "report_recipient_emails", Value: "beta@example.com"})

	// =========================================================================
	// TEST CASE 1: Store Membership & Deactivated Store RBAC
	// =========================================================================
	t.Run("RBAC: Cross-store Access Denied", func(t *testing.T) {
		// User A (Store A) tries to access Store B endpoints -> 403 STORE_FORBIDDEN
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/categories", tokenAdminA, storeB.ID, nil)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 STORE_FORBIDDEN for cross-store access, got %d: %v", w.Code, resp)
		}

		// Staff A tries to call admin mutation in Store A -> 403 STORE_ROLE_INSUFFICIENT
		w, resp = doAuthRequest(router, http.MethodPost, "/api/v1/categories", tokenStaffA, storeA.ID, map[string]interface{}{
			"name": "Should Fail For Staff",
		})
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 STORE_ROLE_INSUFFICIENT for staff mutation, got %d: %v", w.Code, resp)
		}
	})

	// =========================================================================
	// TEST CASE 2: Category Isolation
	// =========================================================================
	t.Run("Category: Store B Cannot List, Update, or Delete Store A Category", func(t *testing.T) {
		// List: Store B categories should be empty
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/categories", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %v", w.Code, resp)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 categories in Store B, got %d", len(data))
		}

		// Update Store A category via Store B -> 404
		w, resp = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/categories/%d", catA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name": "Hacked Name",
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 updating cross-store category, got %d: %v", w.Code, resp)
		}

		// Delete Store A category via Store B -> 404
		w, resp = doAuthRequest(router, http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", catA.ID), tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 deleting cross-store category, got %d: %v", w.Code, resp)
		}
	})

	// =========================================================================
	// TEST CASE 3: Product & Variant Isolation
	// =========================================================================
	t.Run("Product & Variant: Store B Cannot List, View, or Mutate Store A Product", func(t *testing.T) {
		// List: Store B products should not include Product A
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/products", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 products in Store B, got %d", len(data))
		}

		// GetByID: Store A product via Store B -> 404
		w, _ = doAuthRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/products/%d", prodA.ID), tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 getting cross-store product, got %d", w.Code)
		}

		// Update Product A via Store B -> 404
		w, _ = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/products/%d", prodA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name": "Hacked Product",
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 updating cross-store product, got %d", w.Code)
		}

		// Variant Update via Store B -> 404
		w, _ = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/variants/%d", varA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name":  "Hacked Variant",
			"price": 99999,
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 updating cross-store variant, got %d", w.Code)
		}
	})

	// =========================================================================
	// TEST CASE 4: Topping Isolation
	// =========================================================================
	t.Run("Topping: Store B Cannot Access or Mutate Store A Topping", func(t *testing.T) {
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/toppings", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 toppings in Store B, got %d", len(data))
		}

		w, _ = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/toppings/%d", topA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name": "Hacked Topping",
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 mutating cross-store topping, got %d", w.Code)
		}
	})

	// =========================================================================
	// TEST CASE 5: Promotion Isolation
	// =========================================================================
	t.Run("Promotion: Store B Active Promotions Does Not Include Store A", func(t *testing.T) {
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/promotions/active", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 active promotions in Store B, got %d", len(data))
		}

		w, _ = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/promotions/%d", promoA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name": "Hacked Promo",
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 updating cross-store promo, got %d", w.Code)
		}
	})

	// =========================================================================
	// TEST CASE 6: Funds & Balance Isolation
	// =========================================================================
	t.Run("Fund: Store B Cannot View Balance or Reconcile Store A Fund", func(t *testing.T) {
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/funds", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 funds in Store B, got %d", len(data))
		}

		// Fund Balance
		w, _ = doAuthRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/funds/%d/balance", fundA.ID), tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 reading cross-store fund balance, got %d", w.Code)
		}

		// Reconcile
		w, _ = doAuthRequest(router, http.MethodPost, fmt.Sprintf("/api/v1/funds/%d/reconcile", fundA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"actual_balance": 1000000,
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 reconciling cross-store fund, got %d", w.Code)
		}
	})

	// =========================================================================
	// TEST CASE 7: Orders & IDOR / Cross-Referencing Protection
	// =========================================================================
	t.Run("Orders: Cross-Store Order Listing & Cross-Store Fund Reference Blocked", func(t *testing.T) {
		// List Orders: Store B sees 0 orders
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/orders", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 orders in Store B, got %d", len(data))
		}

		// GetByID: Order A via Store B -> 404
		w, _ = doAuthRequest(router, http.MethodGet, fmt.Sprintf("/api/v1/orders/%d", orderA.ID), tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 getting cross-store order, got %d", w.Code)
		}

		// Create Order in Store B referencing Fund A from Store A -> must FAIL (400 or 404)
		w, resp = doAuthRequest(router, http.MethodPost, "/api/v1/orders", tokenAdminB, storeB.ID, map[string]interface{}{
			"fund_id":        fundA.ID, // belongs to Store A!
			"payment_method": "cash",
			"items": []map[string]interface{}{
				{"name": "Tea", "price": 20000, "quantity": 1},
			},
		})
		if w.Code == http.StatusOK || w.Code == http.StatusCreated {
			t.Errorf("SECURITY RISK: Order creation in Store B succeeded referencing Fund A from Store A! status %d: %v", w.Code, resp)
		}
	})

	// =========================================================================
	// TEST CASE 8: Transactions & Ledger Isolation
	// =========================================================================
	t.Run("Transactions: Ledger Isolation & Cross-Store Fund Reference Blocked", func(t *testing.T) {
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/transactions", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 transactions in Store B, got %d", len(data))
		}

		// Create transaction in Store B referencing Fund A -> must FAIL
		w, resp = doAuthRequest(router, http.MethodPost, "/api/v1/transactions", tokenAdminB, storeB.ID, map[string]interface{}{
			"fund_id":          fundA.ID, // belongs to Store A!
			"transaction_type": "inflow",
			"amount":           50000,
			"category":         "other",
		})
		if w.Code == http.StatusOK || w.Code == http.StatusCreated {
			t.Errorf("SECURITY RISK: Transaction creation in Store B succeeded referencing Fund A! status %d: %v", w.Code, resp)
		}
	})

	// =========================================================================
	// TEST CASE 9: Ingredients Isolation
	// =========================================================================
	t.Run("Ingredients: Store B Cannot List or Update Store A Ingredient", func(t *testing.T) {
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/purchases/ingredients", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].([]interface{})
		if len(data) != 0 {
			t.Errorf("expected 0 ingredients in Store B, got %d", len(data))
		}

		w, _ = doAuthRequest(router, http.MethodPut, fmt.Sprintf("/api/v1/purchases/ingredients/%d", ingA.ID), tokenAdminB, storeB.ID, map[string]interface{}{
			"name":      "Hacked Ingredient",
			"base_unit": "g",
		})
		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 mutating cross-store ingredient, got %d", w.Code)
		}
	})

	// =========================================================================
	// TEST CASE 10: Settings & Analytics Isolation
	// =========================================================================
	t.Run("Settings & Analytics: Isolated Metrics Between Stores", func(t *testing.T) {
		// Store Settings
		w, resp := doAuthRequest(router, http.MethodGet, "/api/v1/settings/store", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		data, _ := resp["data"].(map[string]interface{})
		if data["store_name"] == "Store Alpha" {
			t.Errorf("expected Store Beta settings, got Store Alpha name: %v", data)
		}

		// Analytics: Dashboard revenue in Store B must be 0 (Store A has 45000 revenue)
		w, resp = doAuthRequest(router, http.MethodGet, "/api/v1/analytics/dashboard", tokenAdminB, storeB.ID, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %v", w.Code, resp)
		}
		dashData, _ := resp["data"].(map[string]interface{})
		totalRev, _ := dashData["total_revenue"].(float64)
		if totalRev != 0 {
			t.Errorf("expected Store B revenue = 0, got %v (leaked from Store A)", totalRev)
		}
	})
}
