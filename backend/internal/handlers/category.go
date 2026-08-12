package handlers

import (
	"net/http"
	"strconv"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CategoryHandler struct {
	db *gorm.DB
}

func NewCategoryHandler(db *gorm.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

// ListCategories returns all categories ordered by display_order
func (h *CategoryHandler) ListCategories(c *gin.Context) {
	var categories []models.Category
	if err := h.db.Order("display_order asc, name asc").Find(&categories).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve categories")
		return
	}

	models.SendSuccess(c, http.StatusOK, categories, "Categories retrieved successfully")
}

// CreateCategory creates a new category record
func (h *CategoryHandler) CreateCategory(c *gin.Context) {
	var req models.CreateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
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
		models.SendInternalError(c, "Failed to create category: "+err.Error())
		return
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
		models.SendInternalError(c, "Failed to find category")
		return
	}

	var req models.UpdateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
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
		models.SendInternalError(c, "Failed to update category")
		return
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
		models.SendInternalError(c, "Failed to find category")
		return
	}

	if err := h.db.Delete(&category).Error; err != nil {
		models.SendInternalError(c, "Failed to delete category")
		return
	}

	models.SendSuccess(c, http.StatusOK, nil, "Category deleted successfully")
}
