package handlers

import (
	"net/http"

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
		DisplayOrder: req.DisplayOrder,
		IsActive:     isActive,
	}

	if err := h.db.Create(&category).Error; err != nil {
		models.SendInternalError(c, "Failed to create category: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusCreated, category, "Category created successfully")
}
