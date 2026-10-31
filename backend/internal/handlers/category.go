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

type CategoryHandler struct {
	db    *gorm.DB
	cache *cache.TTLCache
}

func NewCategoryHandler(db *gorm.DB, c *cache.TTLCache) *CategoryHandler {
	return &CategoryHandler{db: db, cache: c}
}

func categoryCacheKey(storeID uint) string {
	return fmt.Sprintf("s%d:categories:list", storeID)
}

// ListCategories returns all categories for the active store ordered by display_order
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	ck := categoryCacheKey(storeID)
	if h.cache != nil {
		if cached, ok := h.cache.Get(ck); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Categories retrieved successfully")
			return
		}
	}

	categories := make([]models.Category, 0)
	if err := h.db.Scopes(database.ScopeByStore(storeID)).Order("display_order asc, id asc").Find(&categories).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve categories", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(ck, categories, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, categories, "Categories retrieved successfully")
}

// CreateCategory creates a new category record scoped to the active store
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	category := models.Category{
		StoreID:      storeID,
		Name:         req.Name,
		ImageURL:     req.ImageURL,
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
	}

	if err := h.db.Create(&category).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to create category", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(categoryCacheKey(storeID))
	}

	models.SendSuccess(c, http.StatusCreated, category, "Category created successfully")
}

// UpdateCategory updates an existing category belonging to the active store
func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.Category
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Category not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find category", err)
		return
	}

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Name != nil {
		category.Name = *req.Name
	}
	if req.ImageURL != nil {
		category.ImageURL = *req.ImageURL
	}
	if req.DisplayOrder != nil {
		category.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		category.IsActive = *req.IsActive
	}

	if err := h.db.Save(&category).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update category", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(categoryCacheKey(storeID))
	}

	models.SendSuccess(c, http.StatusOK, category, "Category updated successfully")
}

// DeleteCategory soft-deletes/deactivates a category belonging to the active store
func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.Category
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Category not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find category", err)
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := database.DetachCategoryFromToppings(tx, storeID, category.ID); err != nil {
			return err
		}
		return tx.Delete(&category).Error
	})
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete category", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(categoryCacheKey(storeID))
		h.cache.InvalidatePrefix(toppingCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusOK, nil, "Category deleted successfully")
}

// ReorderCategories updates the display_order of multiple categories based on the provided ordered IDs
func (h *CategoryHandler) ReorderCategories(c *gin.Context) {
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

	// Verify all ordered IDs belong to this store
	if err := database.AssertOwnedIDs(h.db, &models.Category{}, req.OrderedIDs, storeID); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "All categories must belong to the active store")
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for idx, id := range req.OrderedIDs {
			if err := tx.Model(&models.Category{}).Scopes(database.ScopeByStore(storeID)).Where("id = ?", id).Update("display_order", idx+1).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to reorder categories", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(categoryCacheKey(storeID))
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"count": len(req.OrderedIDs)}, "Categories reordered successfully")
}
