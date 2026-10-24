package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

// TestRequireRole_Hierarchy verifies that:
// 1. Master inherits Owner and Staff permissions.
// 2. Owner inherits Staff permissions, but cannot access Master endpoints.
// 3. Staff cannot access Owner or Master endpoints.
func TestRequireRole_Hierarchy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		callerRole   models.UserRole
		requiredRole models.UserRole
		expectCode   int
	}{
		{"Master accessing Master route", models.RoleMaster, models.RoleMaster, http.StatusOK},
		{"Master accessing Owner route", models.RoleMaster, models.RoleOwner, http.StatusOK},
		{"Master accessing Staff route", models.RoleMaster, models.RoleStaff, http.StatusOK},
		{"Owner accessing Owner route", models.RoleOwner, models.RoleOwner, http.StatusOK},
		{"Owner accessing Staff route", models.RoleOwner, models.RoleStaff, http.StatusOK},
		{"Owner accessing Master route", models.RoleOwner, models.RoleMaster, http.StatusForbidden},
		{"Staff accessing Staff route", models.RoleStaff, models.RoleStaff, http.StatusOK},
		{"Staff accessing Owner route", models.RoleStaff, models.RoleOwner, http.StatusForbidden},
		{"Staff accessing Master route", models.RoleStaff, models.RoleMaster, http.StatusForbidden},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set("user_id", uint(1))
				c.Set("username", "testuser")
				c.Set("user_role", tc.callerRole)
				c.Next()
			})
			router.GET("/test", middleware.RequireRole(tc.requiredRole), func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tc.expectCode {
				t.Errorf("[%s] Expected HTTP %d, got %d. Body: %s", tc.name, tc.expectCode, w.Code, w.Body.String())
			}
		})
	}
}

// TestRequireOwnershipOrMaster verifies that:
// 1. Master can modify any account.
// 2. Owner can modify a staff account.
// 3. Owner CANNOT modify a master account.
// 4. Owner CANNOT modify another owner's account.
func TestRequireOwnershipOrMaster(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutils.GetTestDB(t)

	// Clean users table
	db.Exec("DELETE FROM users")

	// Create test users
	passHash, _ := utils.HashPassword("password123")
	masterUser := models.User{
		Username:     "master_admin",
		Role:         models.RoleMaster,
		PasswordHash: passHash,
		IsActive:     true,
	}
	db.Create(&masterUser)

	ownerUser1 := models.User{
		Username:     "owner_one",
		Role:         models.RoleOwner,
		PasswordHash: passHash,
		IsActive:     true,
	}
	db.Create(&ownerUser1)

	ownerUser2 := models.User{
		Username:     "owner_two",
		Role:         models.RoleOwner,
		PasswordHash: passHash,
		IsActive:     true,
	}
	db.Create(&ownerUser2)

	staffUser := models.User{
		Username:     "staff_bob",
		Role:         models.RoleStaff,
		PasswordHash: passHash,
		IsActive:     true,
	}
	db.Create(&staffUser)

	setupRouter := func(callerID uint, callerRole models.UserRole) *gin.Engine {
		r := gin.New()
		r.Use(func(c *gin.Context) {
			c.Set("user_id", callerID)
			c.Set("user_role", callerRole)
			c.Next()
		})
		r.PUT("/users/:id", middleware.RequireOwnershipOrMaster(db), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})
		return r
	}

	// 1. Master modifying staff -> OK
	rMaster := setupRouter(masterUser.ID, models.RoleMaster)
	req1, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d", staffUser.ID), nil)
	w1 := httptest.NewRecorder()
	rMaster.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("Master modifying staff expected 200, got %d", w1.Code)
	}

	// 2. Master modifying another owner -> OK
	req2, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d", ownerUser1.ID), nil)
	w2 := httptest.NewRecorder()
	rMaster.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Errorf("Master modifying owner expected 200, got %d", w2.Code)
	}

	// 3. Owner1 modifying staff -> OK
	rOwner1 := setupRouter(ownerUser1.ID, models.RoleOwner)
	req3, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d", staffUser.ID), nil)
	w3 := httptest.NewRecorder()
	rOwner1.ServeHTTP(w3, req3)
	if w3.Code != http.StatusOK {
		t.Errorf("Owner modifying staff expected 200, got %d", w3.Code)
	}

	// 4. Owner1 modifying master -> Forbidden 403
	req4, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d", masterUser.ID), nil)
	w4 := httptest.NewRecorder()
	rOwner1.ServeHTTP(w4, req4)
	if w4.Code != http.StatusForbidden {
		t.Errorf("Owner modifying master expected 403, got %d", w4.Code)
	}

	// 5. Owner1 modifying Owner2 -> Forbidden 403
	req5, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d", ownerUser2.ID), nil)
	w5 := httptest.NewRecorder()
	rOwner1.ServeHTTP(w5, req5)
	if w5.Code != http.StatusForbidden {
		t.Errorf("Owner modifying another owner expected 403, got %d", w5.Code)
	}
}

// TestUserHandler_CreateAndSanitize verifies that:
// 1. Passwords and PIN codes are hashed and never leaked in responses.
// 2. Owner cannot create Master or Owner accounts.
func TestUserHandler_CreateAndSanitize(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutils.GetTestDB(t)

	handler := NewUserHandler(db, nil)

	// Owner caller attempting to create Master account -> Forbidden
	routerOwner := gin.New()
	routerOwner.Use(func(c *gin.Context) {
		c.Set("user_id", uint(10))
		c.Set("username", "owner_alice")
		c.Set("user_role", models.RoleOwner)
		c.Next()
	})
	routerOwner.POST("/api/v1/users", handler.CreateUser)

	badPayload := models.CreateUserDTO{
		Username: "malicious_master",
		Password: "password123",
		Role:     models.RoleMaster,
	}
	body, _ := json.Marshal(badPayload)
	req, _ := http.NewRequest("POST", "/api/v1/users", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	routerOwner.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Owner creating master expected 403, got %d. Body: %s", w.Code, w.Body.String())
	}

	// Master caller creating Staff account with PIN -> OK and no leaks
	routerMaster := gin.New()
	routerMaster.Use(func(c *gin.Context) {
		c.Set("user_id", uint(1))
		c.Set("username", "master")
		c.Set("user_role", models.RoleMaster)
		c.Next()
	})
	routerMaster.POST("/api/v1/users", handler.CreateUser)

	uniqueUser := fmt.Sprintf("staff_new_%d", time.Now().UnixNano())
	goodPayload := models.CreateUserDTO{
		Username: uniqueUser,
		FullName: "Staff Cashier",
		Phone:    "0987654321",
		Password: "secretpassword",
		PinCode:  "1234",
		Role:     models.RoleStaff,
	}
	bodyGood, _ := json.Marshal(goodPayload)
	reqGood, _ := http.NewRequest("POST", "/api/v1/users", bytes.NewBuffer(bodyGood))
	reqGood.Header.Set("Content-Type", "application/json")
	wGood := httptest.NewRecorder()
	routerMaster.ServeHTTP(wGood, reqGood)

	if wGood.Code != http.StatusCreated {
		t.Fatalf("Master creating staff expected 201, got %d. Body: %s", wGood.Code, wGood.Body.String())
	}

	var resp struct {
		Status string              `json:"status"`
		Data   models.UserResponse `json:"data"`
	}
	if err := json.Unmarshal(wGood.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if !resp.Data.HasPin {
		t.Errorf("Expected HasPin = true, got false")
	}

	// Raw JSON must never leak secret strings
	rawBody := wGood.Body.String()
	if bytes.Contains([]byte(rawBody), []byte("secretpassword")) {
		t.Errorf("CRITICAL SECURITY LEAK: Response contains plaintext password!")
	}
	if bytes.Contains([]byte(rawBody), []byte("1234")) {
		t.Errorf("CRITICAL SECURITY LEAK: Response contains plaintext PIN code!")
	}
}

// TestUserHandler_CannotDeactivateLastMaster verifies that deactivating the last active master is prevented
func TestUserHandler_CannotDeactivateLastMaster(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutils.GetTestDB(t)

	db.Exec("DELETE FROM users WHERE role IN ('master', 'super_admin', 'admin')")

	passHash, _ := utils.HashPassword("password123")
	soleMaster := models.User{
		Username:     "sole_master",
		Role:         models.RoleMaster,
		PasswordHash: passHash,
		IsActive:     true,
	}
	db.Create(&soleMaster)

	handler := NewUserHandler(db, nil)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		// Another admin or caller trying to deactivate
		c.Set("user_id", uint(999))
		c.Set("user_role", models.RoleMaster)
		c.Next()
	})
	router.PUT("/users/:id/toggle-status", handler.ToggleUserStatus)

	activeFalse := false
	body, _ := json.Marshal(models.ToggleStatusDTO{IsActive: &activeFalse})
	req, _ := http.NewRequest("PUT", fmt.Sprintf("/users/%d/toggle-status", soleMaster.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Deactivating last master expected 400, got %d. Body: %s", w.Code, w.Body.String())
	}
}
