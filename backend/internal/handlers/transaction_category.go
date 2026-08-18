package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TransactionCategoryHandler struct {
	db *gorm.DB
}

func NewTransactionCategoryHandler(db *gorm.DB) *TransactionCategoryHandler {
	return &TransactionCategoryHandler{db: db}
}

// ListCategories returns a list of transaction categories, optionally filtered by type (outflow/inflow)
func (h *TransactionCategoryHandler) ListCategories(c *gin.Context) {
	txType := strings.TrimSpace(c.Query("type"))

	query := h.db.Model(&models.TransactionCategoryItem{})
	if txType != "" && txType != "all" {
		query = query.Where("type = ? OR type = 'both'", txType)
	}

	categories := make([]models.TransactionCategoryItem, 0)
	if err := query.Order("is_system desc, id asc").Find(&categories).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve transaction categories: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, categories, "Transaction categories retrieved successfully")
}

// CreateCategory creates a new custom transaction category
func (h *TransactionCategoryHandler) CreateCategory(c *gin.Context) {
	var req models.CreateTransactionCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		models.SendError(c, http.StatusBadRequest, "Category name cannot be empty")
		return
	}

	// Check for duplicate name within the same type scope
	var existing models.TransactionCategoryItem
	err := h.db.Where("LOWER(name) = ? AND (type = ? OR type = 'both' OR ? = 'both')",
		strings.ToLower(trimmedName), req.Type, req.Type).First(&existing).Error
	if err == nil {
		models.SendError(c, http.StatusConflict, "A category with this name already exists for this transaction type")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	category := models.TransactionCategoryItem{
		Name:     trimmedName,
		Type:     req.Type,
		Code:     req.Code,
		IsSystem: false,
	}

	if err := h.db.Create(&category).Error; err != nil {
		models.SendInternalError(c, "Failed to create transaction category: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusCreated, category, "Transaction category created successfully")
}

// UpdateCategory updates an existing transaction category
func (h *TransactionCategoryHandler) UpdateCategory(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.TransactionCategoryItem
	if err := h.db.First(&category, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "Transaction category not found")
			return
		}
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	var req models.UpdateTransactionCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		models.SendError(c, http.StatusBadRequest, "Category name cannot be empty")
		return
	}

	// Check if another category already has this name
	var existing models.TransactionCategoryItem
	err = h.db.Where("id != ? AND LOWER(name) = ? AND (type = ? OR type = 'both' OR ? = 'both')",
		id, strings.ToLower(trimmedName), req.Type, req.Type).First(&existing).Error
	if err == nil {
		models.SendError(c, http.StatusConflict, "Another category with this name already exists")
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	category.Name = trimmedName
	category.Type = req.Type

	if err := h.db.Save(&category).Error; err != nil {
		models.SendInternalError(c, "Failed to update transaction category: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, category, "Transaction category updated successfully")
}

// DeleteCategory deletes a custom transaction category (system categories cannot be deleted)
func (h *TransactionCategoryHandler) DeleteCategory(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid category ID")
		return
	}

	var category models.TransactionCategoryItem
	if err := h.db.First(&category, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "Transaction category not found")
			return
		}
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	if category.IsSystem {
		models.SendError(c, http.StatusForbidden, "Cannot delete default system transaction category")
		return
	}

	if err := h.db.Delete(&category).Error; err != nil {
		models.SendInternalError(c, "Failed to delete transaction category: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"id": id}, "Transaction category deleted successfully")
}
