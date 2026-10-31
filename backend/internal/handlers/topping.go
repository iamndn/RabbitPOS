package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ToppingHandler struct {
	db    *gorm.DB
	cache *cache.TTLCache
}

func NewToppingHandler(db *gorm.DB, c *cache.TTLCache) *ToppingHandler {
	return &ToppingHandler{db: db, cache: c}
}

func toppingCachePrefix(storeID uint) string {
	return fmt.Sprintf("s%d:toppings:", storeID)
}

// ListToppings returns active toppings with in-memory caching scoped to the active store.
// Supports ?category_id=X to return global toppings (category_id IS NULL) PLUS toppings scoped to that category.
func (h *ToppingHandler) ListToppings(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	catIDStr := c.Query("category_id")
	cacheKey := fmt.Sprintf("s%d:toppings:active:%s", storeID, catIDStr)

	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Toppings retrieved successfully")
			return
		}
	}

	toppings := make([]models.Topping, 0)
	query := h.db.Scopes(database.ScopeByStore(storeID)).Where("is_active = ?", true)

	if catIDStr != "" {
		catID, err := strconv.ParseUint(catIDStr, 10, 64)
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Invalid category_id parameter")
			return
		}
		query = database.ToppingAvailableForCategoryScope(query, uint(catID))
	}

	if err := query.Order("display_order asc, id asc").Find(&toppings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve toppings", err)
		return
	}
	if err := database.FillToppingCategoryIDs(h.db, toppings); err != nil {
		models.SendInternalErrorLogged(c, "Failed to load topping categories", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, toppings, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, toppings, "Toppings retrieved successfully")
}

// ListAllToppings returns all toppings (including inactive) for store admin management
func (h *ToppingHandler) ListAllToppings(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	cacheKey := fmt.Sprintf("s%d:toppings:all", storeID)
	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "All toppings retrieved successfully")
			return
		}
	}

	toppings := make([]models.Topping, 0)
	if err := h.db.Scopes(database.ScopeByStore(storeID)).Order("display_order asc, id asc").Find(&toppings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve toppings", err)
		return
	}
	if err := database.FillToppingCategoryIDs(h.db, toppings); err != nil {
		models.SendInternalErrorLogged(c, "Failed to load topping categories", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, toppings, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, toppings, "All toppings retrieved successfully")
}

// CreateTopping creates a new topping scoped to the active store
func (h *ToppingHandler) CreateTopping(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req models.CreateToppingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	categoryIDs := models.ResolveCategoryIDs(req.CategoryIDs, req.CategoryID)
	if len(categoryIDs) > 0 {
		if err := database.AssertOwnedIDs(h.db, &models.Category{}, categoryIDs, storeID); err != nil {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Category does not belong to active store")
			return
		}
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	topping := models.Topping{
		StoreID:      storeID,
		Name:         req.Name,
		Price:        req.Price,
		COGS:         req.COGS,
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&topping).Error; err != nil {
			return err
		}
		return database.SyncToppingCategories(tx, topping.ID, categoryIDs)
	})
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to create topping", err)
		return
	}
	topping.CategoryIDs = categoryIDs
	if len(categoryIDs) > 0 {
		first := categoryIDs[0]
		for _, id := range categoryIDs {
			if id < first {
				first = id
			}
		}
		topping.CategoryID = &first
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(toppingCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusCreated, topping, "Topping created successfully")
}

// UpdateTopping updates an existing topping scoped to the active store
func (h *ToppingHandler) UpdateTopping(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	var topping models.Topping
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&topping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Topping not found")
			return
		}
		models.SendInternalErrorLogged(c, "Database error finding topping", err)
		return
	}

	var req models.UpdateToppingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	categoryIDs := models.ResolveCategoryIDs(req.CategoryIDs, req.CategoryID)
	if len(categoryIDs) > 0 {
		if err := database.AssertOwnedIDs(h.db, &models.Category{}, categoryIDs, storeID); err != nil {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Category does not belong to active store")
			return
		}
	}

	if req.Name != "" {
		topping.Name = req.Name
	}
	topping.Price = req.Price
	topping.COGS = req.COGS
	if req.DisplayOrder != nil {
		topping.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		topping.IsActive = *req.IsActive
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit("CategoryID", "Category").Save(&topping).Error; err != nil {
			return err
		}
		return database.SyncToppingCategories(tx, topping.ID, categoryIDs)
	})
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to update topping", err)
		return
	}
	topping.CategoryIDs = categoryIDs
	topping.CategoryID = nil
	if len(categoryIDs) > 0 {
		first := categoryIDs[0]
		for _, id := range categoryIDs {
			if id < first {
				first = id
			}
		}
		topping.CategoryID = &first
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(toppingCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusOK, topping, "Topping updated successfully")
}

// DeleteTopping deletes a topping by ID scoped to the active store
func (h *ToppingHandler) DeleteTopping(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	var topping models.Topping
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&topping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Topping not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find topping", err)
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := database.DeleteToppingCategories(tx, topping.ID); err != nil {
			return err
		}
		return tx.Delete(&topping).Error
	})
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete topping", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(toppingCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusOK, nil, "Topping deleted successfully")
}

// ReorderToppings updates the display_order of multiple toppings based on the provided ordered IDs
func (h *ToppingHandler) ReorderToppings(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req struct {
		OrderedIDs []uint `json:"ordered_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: ordered_ids required")
		return
	}

	if err := database.AssertOwnedIDs(h.db, &models.Topping{}, req.OrderedIDs, storeID); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "All toppings must belong to the active store")
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for idx, id := range req.OrderedIDs {
			if err := tx.Model(&models.Topping{}).Scopes(database.ScopeByStore(storeID)).Where("id = ?", id).Update("display_order", idx+1).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to reorder toppings", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(toppingCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"count": len(req.OrderedIDs)}, "Toppings reordered successfully")
}
