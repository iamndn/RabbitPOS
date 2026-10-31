package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
)

func setupToppingTestRouter(h *ToppingHandler, storeID uint, role string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if storeID > 0 {
			c.Set("store_id", storeID)
		}
		if role != "" {
			c.Set("role", role)
		}
		c.Next()
	})
	router.GET("/toppings", h.ListToppings)
	router.GET("/toppings/all", h.ListAllToppings)
	router.POST("/toppings", h.CreateTopping)
	router.PUT("/toppings/:id", h.UpdateTopping)
	router.DELETE("/toppings/:id", h.DeleteTopping)
	return router
}

func TestTopping_MultiCategoryScoping(t *testing.T) {
	db := testutils.GetTestDB(t)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	storeID := fixtures.Category.StoreID

	// Create 2 extra categories for this store
	catB := models.Category{StoreID: storeID, Name: "Trà Trái Cây", IsActive: true}
	catC := models.Category{StoreID: storeID, Name: "Bánh Ngọt", IsActive: true}
	if err := db.Create(&catB).Error; err != nil {
		t.Fatalf("failed to create catB: %v", err)
	}
	if err := db.Create(&catC).Error; err != nil {
		t.Fatalf("failed to create catC: %v", err)
	}

	h := NewToppingHandler(db, nil)
	router := setupToppingTestRouter(h, storeID, "admin")

	// 1. Create a topping applicable to fixtures.Category and catB (multi-category)
	catIDs := []uint{fixtures.Category.ID, catB.ID}
	createReq := models.CreateToppingRequest{
		Name:        "Trân Châu Hoàng Kim Multi",
		Price:       10000,
		COGS:        3000,
		CategoryIDs: &catIDs,
	}
	reqBody, _ := json.Marshal(createReq)
	req, _ := http.NewRequest("POST", "/toppings", bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("CreateTopping failed, status: %d, body: %s", w.Code, w.Body.String())
	}

	var created models.ResponseEnvelope
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
	createdData, _ := json.Marshal(created.Data)
	var createdTopping models.Topping
	_ = json.Unmarshal(createdData, &createdTopping)

	if len(createdTopping.CategoryIDs) != 2 {
		t.Errorf("Expected 2 category_ids, got %v", createdTopping.CategoryIDs)
	}

	// 2. Query /toppings?category_id=fixtures.Category.ID -> should find it
	req, _ = http.NewRequest("GET", fmt.Sprintf("/toppings?category_id=%d", fixtures.Category.ID), nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListToppings catA status: %d", w.Code)
	}
	var resA models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &resA)
	bytesA, _ := json.Marshal(resA.Data)
	var listA []models.Topping
	_ = json.Unmarshal(bytesA, &listA)
	foundA := false
	for _, top := range listA {
		if top.ID == createdTopping.ID {
			foundA = true
			if len(top.CategoryIDs) != 2 {
				t.Errorf("Expected topping in list to have CategoryIDs populated, got %v", top.CategoryIDs)
			}
			break
		}
	}
	if !foundA {
		t.Errorf("Expected topping to appear in category A listing")
	}

	// 3. Query /toppings?category_id=catB.ID -> should find it
	req, _ = http.NewRequest("GET", fmt.Sprintf("/toppings?category_id=%d", catB.ID), nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListToppings catB status: %d", w.Code)
	}
	var resB models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &resB)
	bytesB, _ := json.Marshal(resB.Data)
	var listB []models.Topping
	_ = json.Unmarshal(bytesB, &listB)
	foundB := false
	for _, top := range listB {
		if top.ID == createdTopping.ID {
			foundB = true
			break
		}
	}
	if !foundB {
		t.Errorf("Expected topping to appear in category B listing")
	}

	// 4. Query /toppings?category_id=catC.ID -> should NOT find it
	req, _ = http.NewRequest("GET", fmt.Sprintf("/toppings?category_id=%d", catC.ID), nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListToppings catC status: %d", w.Code)
	}
	var resC models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &resC)
	bytesC, _ := json.Marshal(resC.Data)
	var listC []models.Topping
	_ = json.Unmarshal(bytesC, &listC)
	foundC := false
	for _, top := range listC {
		if top.ID == createdTopping.ID {
			foundC = true
			break
		}
	}
	if foundC {
		t.Errorf("Topping should NOT appear in category C listing")
	}

	// 5. Update topping to be global (empty category_ids)
	emptyIDs := []uint{}
	updateReq := models.UpdateToppingRequest{
		CategoryIDs: &emptyIDs,
	}
	upBody, _ := json.Marshal(updateReq)
	req, _ = http.NewRequest("PUT", fmt.Sprintf("/toppings/%d", createdTopping.ID), bytes.NewReader(upBody))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateTopping status: %d, body: %s", w.Code, w.Body.String())
	}

	// Now querying catC.ID should include the topping because it became global!
	req, _ = http.NewRequest("GET", fmt.Sprintf("/toppings?category_id=%d", catC.ID), nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	var resCGlobal models.ResponseEnvelope
	_ = json.Unmarshal(w.Body.Bytes(), &resCGlobal)
	bytesCGlobal, _ := json.Marshal(resCGlobal.Data)
	var listCGlobal []models.Topping
	_ = json.Unmarshal(bytesCGlobal, &listCGlobal)
	foundCGlobal := false
	for _, top := range listCGlobal {
		if top.ID == createdTopping.ID {
			foundCGlobal = true
			break
		}
	}
	if !foundCGlobal {
		t.Errorf("Global topping should appear in category C listing")
	}
}
