package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func setupMultiTenantTestRouter(cfg *config.Config, db *gorm.DB, storeCache *cache.TTLCache) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()

	authHandler := NewAuthHandler(db, cfg, nil, nil)
	storeHandler := NewStoreHandler(db, cfg, nil, storeCache)
	userHandler := NewUserHandler(db, nil)

	v1 := r.Group("/api/v1")
	{
		v1.POST("/auth/register", authHandler.Register)

		auth := v1.Group("", middleware.AuthMiddleware(cfg.JWTSecret, db))
		{
			// User management
			userGroup := auth.Group("/users")
			userGroup.Use(middleware.RequireRole(models.RoleMaster, models.RoleOwner))
			{
				userGroup.GET("", userHandler.ListUsers)
				userGroup.POST("", userHandler.CreateUser)
				userGroup.GET("/:id", userHandler.GetUserByID)
				userGroup.PUT("/:id", middleware.RequireOwnershipOrMaster(db), userHandler.UpdateUser)
				userGroup.PUT("/:id/toggle-status", middleware.RequireOwnershipOrMaster(db), userHandler.ToggleUserStatus)
				userGroup.DELETE("/:id", middleware.RequireOwnershipOrMaster(db), userHandler.DeleteUser)
			}

			// Store management
			auth.GET("/stores", storeHandler.ListStores)

			storeMgmt := auth.Group("")
			storeMgmt.Use(middleware.RequireRole(models.RoleMaster, models.RoleOwner))
			{
				storeMgmt.POST("/stores", storeHandler.CreateStore)
				storeMgmt.PUT("/stores/:id", storeHandler.UpdateStore)
				storeMgmt.GET("/stores/:id/members", storeHandler.ListMembers)
				storeMgmt.PUT("/stores/:id/members", storeHandler.UpsertMember)
				storeMgmt.DELETE("/stores/:id/members/:user_id", storeHandler.RemoveMember)
			}

			masterAdmin := auth.Group("")
			masterAdmin.Use(middleware.RequireRole(models.RoleMaster))
			{
				masterAdmin.DELETE("/stores/:id", storeHandler.DeleteStore)
			}
		}
	}

	return r
}

func doJSONReq(router *gin.Engine, method, path, token string, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	return w, resp
}

// TestOwnerTenantIsolation_UsersAndStores verifies:
// 1. Newly registered users always get RoleOwner (never RoleMaster).
// 2. Owner A cannot see Store B or Store #1 in GET /api/v1/stores.
// 3. Owner A cannot see Owner B or Staff B in GET /api/v1/users.
// 4. Owner A cannot clone Store B's menu (403 STORE_FORBIDDEN).
// 5. Owner A cannot edit, toggle-status, or delete Staff B (403 AUTH_FORBIDDEN).
// 6. Master (NDN, NHUNG) has full platform-wide visibility across all stores and users.
func TestOwnerTenantIsolation_UsersAndStores(t *testing.T) {
	db := testutils.GetTestDB(t)
	_ = testutils.CleanTables(db)

	cfg := &config.Config{
		JWTSecret:        "test-secret-1234567890123456789012",
		JWTExpiryHours:   24,
		EnableMultiStore: true,
	}
	storeCache := cache.NewTTLCache(1 * time.Minute)
	router := setupMultiTenantTestRouter(cfg, db, storeCache)

	passHash, _ := utils.HashPassword("password123")

	// 1. Seed Master User (NDN)
	masterUser := models.User{
		Username:     "NDN",
		FullName:     "Super Admin NDN",
		Email:        "ndn@rabbitpos.local",
		PasswordHash: passHash,
		Role:         models.RoleMaster,
		IsActive:     true,
	}
	db.Create(&masterUser)
	db.Create(&models.UserStore{
		UserID:    masterUser.ID,
		StoreID:   1, // Store #1
		Role:      models.StoreRoleStoreAdmin,
		IsDefault: true,
	})
	masterToken, _, _ := utils.GenerateJWT(masterUser.ID, masterUser.Username, masterUser.Role, 0, cfg.JWTSecret, 24)

	// 2. Register Owner A via public register endpoint
	regA := models.RegisterRequest{
		Username:  "owner_a",
		FullName:  "Store Owner A",
		Password:  "password123",
		StoreName: "Tiệm Cà Phê A",
	}
	w, respA := doJSONReq(router, "POST", "/api/v1/auth/register", "", regA)
	if w.Code != http.StatusOK {
		t.Fatalf("Register Owner A failed (%d): %v", w.Code, respA)
	}
	dataA := respA["data"].(map[string]interface{})
	tokenA := dataA["token"].(string)

	var userA models.User
	db.Where("username = ?", "owner_a").First(&userA)
	if userA.Role != models.RoleOwner {
		t.Fatalf("Expected Owner A role to be 'owner', got '%s'", userA.Role)
	}

	var storeA models.Store
	db.Where("name = ?", "Tiệm Cà Phê A").First(&storeA)
	if storeA.ID == 0 {
		t.Fatalf("Store A was not created")
	}

	// 3. Register Owner B via public register endpoint
	regB := models.RegisterRequest{
		Username:  "owner_b",
		FullName:  "Store Owner B",
		Password:  "password123",
		StoreName: "Tiệm Trà Sữa B",
	}
	w, respB := doJSONReq(router, "POST", "/api/v1/auth/register", "", regB)
	if w.Code != http.StatusOK {
		t.Fatalf("Register Owner B failed (%d): %v", w.Code, respB)
	}
	dataB := respB["data"].(map[string]interface{})
	tokenB := dataB["token"].(string)

	var userB models.User
	db.Where("username = ?", "owner_b").First(&userB)
	if userB.Role != models.RoleOwner {
		t.Fatalf("Expected Owner B role to be 'owner', got '%s'", userB.Role)
	}

	var storeB models.Store
	db.Where("name = ?", "Tiệm Trà Sữa B").First(&storeB)
	if storeB.ID == 0 {
		t.Fatalf("Store B was not created")
	}

	// 4. Owner A creates Staff A
	staffADTO := models.CreateUserDTO{
		Username: "staff_a",
		FullName: "Nhân viên quán A",
		Password: "password123",
		Role:     models.RoleStaff,
		Memberships: []models.UserMembership{
			{StoreID: storeA.ID, Role: models.StoreRoleStaff, IsDefault: true},
		},
	}
	w, respStaffA := doJSONReq(router, "POST", "/api/v1/users", tokenA, staffADTO)
	if w.Code != http.StatusCreated {
		t.Fatalf("Owner A creating Staff A failed (%d): %v", w.Code, respStaffA)
	}

	// 5. Owner B creates Staff B
	staffBDTO := models.CreateUserDTO{
		Username: "staff_b",
		FullName: "Nhân viên quán B",
		Password: "password123",
		Role:     models.RoleStaff,
		Memberships: []models.UserMembership{
			{StoreID: storeB.ID, Role: models.StoreRoleStaff, IsDefault: true},
		},
	}
	w, respStaffB := doJSONReq(router, "POST", "/api/v1/users", tokenB, staffBDTO)
	if w.Code != http.StatusCreated {
		t.Fatalf("Owner B creating Staff B failed (%d): %v", w.Code, respStaffB)
	}
	var userStaffB models.User
	db.Where("username = ?", "staff_b").First(&userStaffB)

	// --- CHECK 1: Store Visibility for Owner A ---
	// Owner A calling GET /api/v1/stores MUST ONLY return Store A.
	// Store #1 and Store B MUST NOT appear!
	w, storeListA := doJSONReq(router, "GET", "/api/v1/stores", tokenA, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("Owner A GET /stores failed (%d)", w.Code)
	}
	storesAData := storeListA["data"].([]interface{})
	if len(storesAData) != 1 {
		t.Fatalf("Expected Owner A to see exactly 1 store (Store A), got %d stores: %v", len(storesAData), storesAData)
	}
	firstStore := storesAData[0].(map[string]interface{})
	if uint(firstStore["id"].(float64)) != storeA.ID {
		t.Fatalf("Expected Owner A to see store ID %d, got %v", storeA.ID, firstStore["id"])
	}

	// --- CHECK 2: User / Staff Visibility for Owner A ---
	// Owner A calling GET /api/v1/users MUST ONLY see Owner A and Staff A.
	// Master, Owner B, and Staff B MUST NOT appear!
	w, userListA := doJSONReq(router, "GET", "/api/v1/users", tokenA, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("Owner A GET /users failed (%d)", w.Code)
	}
	usersAData := userListA["data"].([]interface{})
	if len(usersAData) != 2 {
		t.Fatalf("Expected Owner A to see exactly 2 users (Owner A, Staff A), got %d: %v", len(usersAData), usersAData)
	}
	for _, uRaw := range usersAData {
		u := uRaw.(map[string]interface{})
		uname := u["username"].(string)
		if uname != "owner_a" && uname != "staff_a" {
			t.Fatalf("Cross-tenant user leakage! Owner A saw user '%s'", uname)
		}
	}

	// --- CHECK 3: Cross-Tenant Menu Cloning Block ---
	// Owner A attempts to create a new branch cloning from Store B: MUST RETURN 403 STORE_FORBIDDEN!
	cloneReq := models.CreateStoreRequest{
		Code:             "branch-a2",
		Name:             "Chi nhánh A2",
		BusinessType:     "cafe",
		CloneFromStoreID: &storeB.ID,
	}
	w, cloneResp := doJSONReq(router, "POST", "/api/v1/stores", tokenA, cloneReq)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden when Owner A clones Store B, got %d: %v", w.Code, cloneResp)
	}

	// --- CHECK 4: Cross-Tenant Staff Modification Block ---
	// Owner A attempts to edit Staff B: MUST RETURN 403 FORBIDDEN!
	newPhone := "0999888777"
	w, editResp := doJSONReq(router, "PUT", fmt.Sprintf("/api/v1/users/%d", userStaffB.ID), tokenA, models.UpdateUserDTO{
		Phone: &newPhone,
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden when Owner A edits Staff B, got %d: %v", w.Code, editResp)
	}

	// Owner A attempts to toggle status of Staff B: MUST RETURN 403 FORBIDDEN!
	inactive := false
	w, toggleResp := doJSONReq(router, "PUT", fmt.Sprintf("/api/v1/users/%d/toggle-status", userStaffB.ID), tokenA, models.ToggleStatusDTO{
		IsActive: &inactive,
	})
	if w.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden when Owner A toggles Staff B, got %d: %v", w.Code, toggleResp)
	}

	// Owner A attempts to delete Staff B: MUST RETURN 403 FORBIDDEN!
	w, delResp := doJSONReq(router, "DELETE", fmt.Sprintf("/api/v1/users/%d", userStaffB.ID), tokenA, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden when Owner A deletes Staff B, got %d: %v", w.Code, delResp)
	}

	// --- CHECK 5: Master (NDN) Platform-Wide Visibility ---
	// Master sees all stores (Store #1, Store A, Store B)
	w, masterStores := doJSONReq(router, "GET", "/api/v1/stores", masterToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("Master GET /stores failed (%d)", w.Code)
	}
	masterStoresData := masterStores["data"].([]interface{})
	if len(masterStoresData) < 3 {
		t.Fatalf("Expected Master to see at least 3 stores, got %d", len(masterStoresData))
	}

	// Master sees all users across the platform
	w, masterUsers := doJSONReq(router, "GET", "/api/v1/users", masterToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("Master GET /users failed (%d)", w.Code)
	}
	masterUsersData := masterUsers["data"].([]interface{})
	if len(masterUsersData) < 5 {
		t.Fatalf("Expected Master to see at least 5 users (NDN, Owner A, Staff A, Owner B, Staff B), got %d", len(masterUsersData))
	}
}

// TestSuperAdmin_DeleteStore verifies:
// 1. Non-master cannot delete a store (403 STORE_ROLE_INSUFFICIENT).
// 2. Master cannot delete Store #1 (400 CANNOT_DELETE_PRIMARY_STORE).
// 3. Master cannot delete without valid confirm_code (400 CONFIRMATION_REQUIRED).
// 4. Master successfully deletes a populated store (with categories, products, variants,
//    orders, transactions, funds, recipes, etc.) with 0 FK constraint errors.
func TestSuperAdmin_DeleteStore(t *testing.T) {
	db := testutils.GetTestDB(t)
	_ = testutils.CleanTables(db)

	cfg := &config.Config{
		JWTSecret:        "test-secret-1234567890123456789012",
		JWTExpiryHours:   24,
		EnableMultiStore: true,
	}
	storeCache := cache.NewTTLCache(1 * time.Minute)
	router := setupMultiTenantTestRouter(cfg, db, storeCache)

	passHash, _ := utils.HashPassword("password123")

	// 1. Create Master
	master := models.User{
		Username:     "NHUNG",
		FullName:     "Super Admin Nhung",
		Email:        "nhung@rabbitpos.local",
		PasswordHash: passHash,
		Role:         models.RoleMaster,
		IsActive:     true,
	}
	db.Create(&master)
	masterToken, _, _ := utils.GenerateJWT(master.ID, master.Username, master.Role, 0, cfg.JWTSecret, 24)

	// 2. Create Owner
	owner := models.User{
		Username:     "owner_x",
		FullName:     "Store Owner X",
		PasswordHash: passHash,
		Role:         models.RoleOwner,
		IsActive:     true,
	}
	db.Create(&owner)
	ownerToken, _, _ := utils.GenerateJWT(owner.ID, owner.Username, owner.Role, 0, cfg.JWTSecret, 24)

	// 3. Create Store #2 to be populated and then deleted
	store2 := models.Store{
		ID:               2,
		Code:             "store-to-delete",
		Name:             "Cửa hàng thử nghiệm xóa",
		BusinessType:     "cafe",
		CurrencyCode:     "VND",
		CurrencySymbol:   "đ",
		CurrencyPosition: "suffix",
		Timezone:         "Asia/Ho_Chi_Minh",
		IsActive:         true,
	}
	db.Create(&store2)
	db.Create(&models.UserStore{
		UserID:    owner.ID,
		StoreID:   store2.ID,
		Role:      models.StoreRoleStoreAdmin,
		IsDefault: true,
	})

	// 4. Populate Store #2 with relational data
	// Categories & Products
	cat := models.Category{
		StoreID: store2.ID,
		Name:    "Cà phê Test",
	}
	db.Create(&cat)

	prod := models.Product{
		StoreID:    store2.ID,
		CategoryID: cat.ID,
		Name:       "Bạc Xỉu",
	}
	db.Create(&prod)

	variant := models.ProductVariant{
		ProductID:   prod.ID,
		VariantName: "Ly Lớn",
		RetailPrice: 35000,
	}
	db.Create(&variant)

	topping := models.Topping{
		StoreID: store2.ID,
		Name:    "Trân châu đen",
		Price:   5000,
	}
	db.Create(&topping)

	// Ingredients & Recipe items
	ing := models.Ingredient{
		StoreID:  store2.ID,
		Name:     "Sữa đặc Test",
		BaseUnit: "ml",
	}
	db.Create(&ing)

	recipe := models.RecipeItem{
		IngredientID:     ing.ID,
		ProductVariantID: &variant.ID,
		UsageQuantity:    30,
	}
	db.Create(&recipe)

	// Funds
	fund := models.Fund{
		StoreID:        store2.ID,
		Name:           "Két tiền mặt",
		CurrentBalance: 1000000,
		IsActive:       true,
	}
	db.Create(&fund)

	recon := models.FundReconciliation{
		FundID:             fund.ID,
		TheoreticalBalance: 1000000,
		ActualBalance:      1000000,
		Variance:           0,
		Status:             models.ReconciliationStatusActive,
	}
	db.Create(&recon)

	// Orders & Order Items
	order := models.Order{
		StoreID:     store2.ID,
		OrderCode:   "ORD-TEST-0001",
		TotalAmount: 35000,
		Subtotal:    35000,
		FundID:      fund.ID,
		Status:      models.OrderStatusCompleted,
	}
	db.Create(&order)

	item := models.OrderItem{
		OrderID:          order.ID,
		ProductVariantID: variant.ID,
		Quantity:         1,
		UnitPrice:        35000,
	}
	db.Create(&item)

	// Transactions & Purchase Items
	txCat := models.TransactionCategoryItem{
		StoreID: store2.ID,
		Name:    "Mua nguyên liệu",
		Type:    "outflow",
	}
	db.Create(&txCat)

	txRecord := models.Transaction{
		StoreID:         store2.ID,
		FundID:          fund.ID,
		Category:        models.CategoryOther,
		Amount:          200000,
		TransactionType: models.TransactionTypeOutflow,
	}
	db.Create(&txRecord)

	purchItem := models.PurchaseItem{
		TransactionID: txRecord.ID,
		IngredientID:  ing.ID,
		Quantity:      10,
		UnitPrice:     20000,
	}
	db.Create(&purchItem)

	// Store Setting
	setting := models.StoreSetting{
		StoreID: store2.ID,
		Key:     "daily_report_time",
		Value:   "22:00",
	}
	db.Create(&setting)

	// --- CHECK 1: Non-Master cannot delete a store ---
	w, resp := doJSONReq(router, "DELETE", fmt.Sprintf("/api/v1/stores/%d?confirm_code=%s", store2.ID, store2.Code), ownerToken, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("Expected 403 Forbidden when Owner tries to delete store, got %d: %v", w.Code, resp)
	}

	// --- CHECK 2: Cannot delete Store #1 ---
	w, resp = doJSONReq(router, "DELETE", "/api/v1/stores/1?confirm_code=main", masterToken, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request when deleting Store #1, got %d: %v", w.Code, resp)
	}
	if resp["error_code"] != "CANNOT_DELETE_PRIMARY_STORE" {
		t.Fatalf("Expected error code CANNOT_DELETE_PRIMARY_STORE, got %v", resp["error_code"])
	}

	// --- CHECK 3: Confirmation code missing or wrong ---
	w, resp = doJSONReq(router, "DELETE", fmt.Sprintf("/api/v1/stores/%d", store2.ID), masterToken, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("Expected 400 Bad Request when confirm_code missing, got %d: %v", w.Code, resp)
	}
	if resp["error_code"] != "CONFIRMATION_REQUIRED" {
		t.Fatalf("Expected error code CONFIRMATION_REQUIRED, got %v", resp["error_code"])
	}

	w, resp = doJSONReq(router, "DELETE", fmt.Sprintf("/api/v1/stores/%d?confirm_code=wrong-code", store2.ID), masterToken, nil)
	if w.Code != http.StatusBadRequest || resp["error_code"] != "CONFIRMATION_REQUIRED" {
		t.Fatalf("Expected 400 CONFIRMATION_REQUIRED on wrong code, got %d: %v", w.Code, resp)
	}

	// --- CHECK 4: Master executes full store deletion with 0 FK errors ---
	w, resp = doJSONReq(router, "DELETE", fmt.Sprintf("/api/v1/stores/%d?confirm_code=%s", store2.ID, store2.Code), masterToken, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK on successful store deletion, got %d: %v", w.Code, resp)
	}

	// Verify database state: store2 must be completely gone
	var storeCount int64
	db.Model(&models.Store{}).Where("id = ?", store2.ID).Count(&storeCount)
	if storeCount != 0 {
		t.Fatalf("Store %d was not deleted from database", store2.ID)
	}

	// Verify cascade deletion of children
	var catCount, prodCount, ordCount, txCount, fundCount int64
	db.Model(&models.Category{}).Where("store_id = ?", store2.ID).Count(&catCount)
	db.Model(&models.Product{}).Where("store_id = ?", store2.ID).Count(&prodCount)
	db.Model(&models.Order{}).Where("store_id = ?", store2.ID).Count(&ordCount)
	db.Model(&models.Transaction{}).Where("store_id = ?", store2.ID).Count(&txCount)
	db.Model(&models.Fund{}).Where("store_id = ?", store2.ID).Count(&fundCount)

	if catCount+prodCount+ordCount+txCount+fundCount != 0 {
		t.Fatalf("Store-scoped records still exist after delete: cat=%d, prod=%d, ord=%d, tx=%d, fund=%d",
			catCount, prodCount, ordCount, txCount, fundCount)
	}

	// Verify recipe and purchase items are cleared
	var recipeCount, purchCount int64
	db.Model(&models.RecipeItem{}).Where("id = ?", recipe.ID).Count(&recipeCount)
	db.Model(&models.PurchaseItem{}).Where("id = ?", purchItem.ID).Count(&purchCount)
	if recipeCount != 0 || purchCount != 0 {
		t.Fatalf("Child items not deleted: recipes=%d, purchases=%d", recipeCount, purchCount)
	}
}
