package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
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

// ListToppings returns active toppings with in-memory caching.
// Supports ?category_id=X to return global toppings (category_id IS NULL) PLUS toppings scoped to that category.
func (h *ToppingHandler) ListToppings(c *gin.Context) {
	catIDStr := c.Query("category_id")
	cacheKey := fmt.Sprintf("toppings:active:%s", catIDStr)

	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Toppings retrieved successfully")
			return
		}
	}

	toppings := make([]models.Topping, 0)
	query := h.db.Where("is_active = ?", true)

	if catIDStr != "" {
		catID, err := strconv.ParseUint(catIDStr, 10, 64)
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Invalid category_id parameter")
			return
		}
		query = query.Where("category_id IS NULL OR category_id = ?", catID)
	}

	if err := query.Order("display_order asc, id asc").Find(&toppings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve toppings", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, toppings, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, toppings, "Toppings retrieved successfully")
}

// ListAllToppings returns all toppings (including inactive) for admin management
func (h *ToppingHandler) ListAllToppings(c *gin.Context) {
	cacheKey := "toppings:all"
	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "All toppings retrieved successfully")
			return
		}
	}

	toppings := make([]models.Topping, 0)
	if err := h.db.Order("display_order asc, id asc").Find(&toppings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve toppings", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, toppings, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, toppings, "All toppings retrieved successfully")
}

// CreateTopping creates a new topping (admin only)
func (h *ToppingHandler) CreateTopping(c *gin.Context) {
	var req models.CreateToppingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	topping := models.Topping{
		Name:         req.Name,
		Price:        req.Price,
		COGS:         req.COGS,
		CategoryID:   req.CategoryID,
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
	}

	if err := h.db.Create(&topping).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to create topping", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix("toppings:")
	}

	models.SendSuccess(c, http.StatusCreated, topping, "Topping created successfully")
}

// UpdateTopping updates an existing topping (admin only)
func (h *ToppingHandler) UpdateTopping(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	var topping models.Topping
	if err := h.db.First(&topping, id).Error; err != nil {
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

	if req.Name != "" {
		topping.Name = req.Name
	}
	topping.Price = req.Price
	topping.COGS = req.COGS
	topping.CategoryID = req.CategoryID
	if req.DisplayOrder != nil {
		topping.DisplayOrder = *req.DisplayOrder
	}
	if req.IsActive != nil {
		topping.IsActive = *req.IsActive
	}

	if err := h.db.Save(&topping).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update topping", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix("toppings:")
	}

	models.SendSuccess(c, http.StatusOK, topping, "Topping updated successfully")
}

// DeleteTopping deletes a topping by ID (admin only)
func (h *ToppingHandler) DeleteTopping(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	if err := h.db.Delete(&models.Topping{}, id).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete topping", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix("toppings:")
	}

	models.SendSuccess(c, http.StatusOK, nil, "Topping deleted successfully")
}

// ReorderToppings updates the display_order of multiple toppings based on the provided ordered IDs
func (h *ToppingHandler) ReorderToppings(c *gin.Context) {
	var req struct {
		OrderedIDs []uint `json:"ordered_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: ordered_ids required")
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for idx, id := range req.OrderedIDs {
			if err := tx.Model(&models.Topping{}).Where("id = ?", id).Update("display_order", idx+1).Error; err != nil {
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
		h.cache.InvalidatePrefix("toppings:")
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"count": len(req.OrderedIDs)}, "Toppings reordered successfully")
}
