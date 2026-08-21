package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const categoriesCacheKey = "categories:list"

type CategoryHandler struct {
	db    *gorm.DB
	cache *cache.TTLCache
}

func NewCategoryHandler(db *gorm.DB, c *cache.TTLCache) *CategoryHandler {
	return &CategoryHandler{db: db, cache: c}
}

// ListCategories returns all categories ordered by display_order with in-memory caching
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	if h.cache != nil {
		if cached, ok := h.cache.Get(categoriesCacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Categories retrieved successfully")
			return
		}
	}

	categories := make([]models.Category, 0)
	if err := h.db.Order("display_order asc, name asc").Find(&categories).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve categories", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(categoriesCacheKey, categories, 5*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, categories, "Categories retrieved successfully")
}

// CreateCategory creates a new category record
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
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
		h.cache.Invalidate(categoriesCacheKey)
	}

	models.SendSuccess(c, http.StatusCreated, category, "Category created successfully")
}

// UpdateCategory updates an existing category
func (h *CategoryHandler) UpdateCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.Category
	if err := h.db.First(&category, id).Error; err != nil {
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
		h.cache.Invalidate(categoriesCacheKey)
	}

	models.SendSuccess(c, http.StatusOK, category, "Category updated successfully")
}

// DeleteCategory soft-deletes/deactivates a category
func (h *CategoryHandler) DeleteCategory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.Category
	if err := h.db.First(&category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Category not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find category", err)
		return
	}

	if err := h.db.Delete(&category).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete category", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(categoriesCacheKey)
	}

	models.SendSuccess(c, http.StatusOK, nil, "Category deleted successfully")
}
