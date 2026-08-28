package handlers

import (
	"bytes"
	"encoding/json"
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
)

func TestAuth_RevokedToken_Rejected(t *testing.T) {
	jwtSecret := "test-jwt-secret-key-123456"
	gin.SetMode(gin.TestMode)

	// Create test token with JTI
	tokenStr, jti, err := utils.GenerateJWT(1, "testuser", models.RoleStaff, 1, jwtSecret, 2)
	if err != nil {
		t.Fatalf("GenerateJWT failed: %v", err)
	}

	db := testutils.GetTestDB(t)

	// Insert revoked token record into DB
	revoked := models.RevokedToken{
		JTI:       jti,
		UserID:    1,
		ExpiresAt: time.Now().Add(2 * time.Hour),
		Reason:    "logout_test",
		CreatedAt: time.Now(),
	}
	db.Create(&revoked)

	router := gin.New()
	router.Use(middleware.AuthMiddleware(jwtSecret, db))
	router.GET("/api/v1/protected", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest("GET", "/api/v1/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tokenStr)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized for revoked JTI, got %d. Body: %s", w.Code, w.Body.String())
	}

	var errResp models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp.ErrorCode != "AUTH_TOKEN_REVOKED" {
		t.Errorf("Expected error code AUTH_TOKEN_REVOKED, got %s", errResp.ErrorCode)
	}
}

func TestSettings_StoreSettings_StaffSafe(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Seed fixtures failed: %v", err)
	}
	_ = fixtures

	// Seed public and sensitive settings
	db.Create(&models.Setting{Key: "store_name", Value: "Thỏ Juice Test"})
	db.Create(&models.Setting{Key: "smtp_password", Value: "enc:v1:fake_nonce:fake_ciphertext"})
	db.Create(&models.Setting{Key: "google_sheets_service_account_json", Value: "enc:v1:fake_nonce2:fake_ciphertext2"})

	handler := NewSettingHandler(db, nil, nil, nil)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/settings/store", handler.GetStoreSettings)

	req, _ := http.NewRequest("GET", "/api/v1/settings/store", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Status string            `json:"status"`
		Data   map[string]string `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	// Safe store settings should be present
	if resp.Data["store_name"] != "Thỏ Juice Test" {
		t.Errorf("Expected store_name 'Thỏ Juice Test', got '%s'", resp.Data["store_name"])
	}

	// Sensitive secrets MUST NOT be present in store settings
	if _, exists := resp.Data["smtp_password"]; exists {
		t.Errorf("Store settings MUST NOT leak smtp_password")
	}
	if _, exists := resp.Data["google_sheets_service_account_json"]; exists {
		t.Errorf("Store settings MUST NOT leak google_sheets_service_account_json")
	}
}

func TestSettings_Admin_SecretMasking(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Seed fixtures failed: %v", err)
	}
	_ = fixtures

	encKey := utils.GetSettingsEncryptionKey()
	encryptedSMTP, _ := utils.EncryptSettingSecret("actual_raw_smtp_password_xyz", encKey)

	db.Create(&models.Setting{Key: "smtp_password", Value: encryptedSMTP})

	handler := NewSettingHandler(db, nil, nil, nil)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/settings", handler.GetSettings)

	req, _ := http.NewRequest("GET", "/api/v1/settings", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Status string            `json:"status"`
		Data   map[string]string `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	// Admin response should mask the password and set configured flag
	if resp.Data["smtp_password_configured"] != "true" {
		t.Errorf("Expected smtp_password_configured to be 'true', got '%s'", resp.Data["smtp_password_configured"])
	}
	if resp.Data["smtp_password"] != models.SecretMaskShort {
		t.Errorf("Expected masked password '%s', got '%s'", models.SecretMaskShort, resp.Data["smtp_password"])
	}
	if resp.Data["smtp_password"] == "actual_raw_smtp_password_xyz" {
		t.Errorf("Admin settings leaked raw plain text password!")
	}
}

func TestRBAC_OrderCancellation_StaffForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Setup route protected by RequireRole(models.RoleAdmin)
	router.Use(func(c *gin.Context) {
		// Mock Staff Role
		c.Set("user_id", uint(2))
		c.Set("username", "staff_bob")
		c.Set("user_role", models.RoleStaff)
		c.Next()
	})
	router.POST("/api/v1/orders/:id/cancel", middleware.RequireRole(models.RoleAdmin), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest("POST", "/api/v1/orders/123/cancel", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden when staff tries to cancel order, got %d", w.Code)
	}

	var errResp models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &errResp)
	if errResp.ErrorCode != "AUTH_FORBIDDEN_ROLE" {
		t.Errorf("Expected error_code AUTH_FORBIDDEN_ROLE, got %s", errResp.ErrorCode)
	}
}

func TestAuth_LoginRateLimiter_Integration(t *testing.T) {
	limiter := middleware.NewMemoryRateLimiter(2, 1*time.Minute)
	cfg := &config.Config{
		JWTSecret:      "test-secret",
		JWTExpiryHours: 24,
	}

	handler := NewAuthHandler(nil, cfg, limiter, nil)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/v1/auth/login", middleware.LoginRateLimiterMiddleware(limiter), handler.Login)

	loginBody := []byte(`{"username":"nonexistent_user","password":"wrongpassword"}`)

	// Attempt 1
	req1, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	// Attempt 2
	req2, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	// Exceed limit
	limiter.RecordFailure("ip:")
	limiter.RecordFailure("ip:")

	// Attempt 3 -> Should be rate limited (429)
	req3, _ := http.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginBody))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusTooManyRequests {
		t.Errorf("Expected 429 Too Many Requests after exceeding rate limit, got %d. Body: %s", w3.Code, w3.Body.String())
	}
}
