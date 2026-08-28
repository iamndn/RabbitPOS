package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupTestDB(t *testing.T) *gorm.DB {
	// Attempt to connect to test postgres DB with 2s timeout or skip if not available
	dsn := "host=localhost user=admin password=password123 dbname=rabbitpos port=5432 sslmode=disable connect_timeout=2"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skip("PostgreSQL test database not available, skipping integration test:", err)
	}

	_ = db.AutoMigrate(&models.Category{}, &models.Product{}, &models.ProductVariant{}, &models.VariantGroup{})
	return db
}

func TestCategoryHandler_ListCategories(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)

	handler := NewCategoryHandler(db, nil)
	router := gin.New()
	router.GET("/api/v1/categories", handler.ListCategories)

	req, _ := http.NewRequest("GET", "/api/v1/categories", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp models.ResponseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if resp.Status != "success" {
		t.Errorf("Expected status 'success', got '%s'", resp.Status)
	}
}

func TestCategoryHandler_CreateCategory(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupTestDB(t)

	handler := NewCategoryHandler(db, nil)
	router := gin.New()
	router.POST("/api/v1/categories", handler.CreateCategory)

	payload := models.CreateCategoryRequest{
		Name:         "Test Category",
		DisplayOrder: 10,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "/api/v1/categories", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Expected status code %d, got %d", http.StatusCreated, w.Code)
	}
}
