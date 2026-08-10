package handlers

import (
	"net/http"
	"strconv"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type VariantHandler struct {
	db *gorm.DB
}

func NewVariantHandler(db *gorm.DB) *VariantHandler {
	return &VariantHandler{db: db}
}

// AddVariantToProduct creates a new variant for a target product ID
func (h *VariantHandler) AddVariantToProduct(c *gin.Context) {
	productIDStr := c.Param("id")
	productID, err := strconv.ParseUint(productIDStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.First(&product, productID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalError(c, "Failed to verify product existence")
		return
	}

	var req models.CreateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	variant := models.ProductVariant{
		ProductID:   uint(productID),
		VariantName: req.VariantName,
		CogsPrice:   req.CogsPrice,
		RetailPrice: req.RetailPrice,
		SKU:         req.SKU,
		IsActive:    isActive,
	}

	if err := h.db.Create(&variant).Error; err != nil {
		models.SendInternalError(c, "Failed to create variant: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusCreated, variant, "Variant added successfully")
}

// UpdateVariant updates price, COGS, name or status of a variant
func (h *VariantHandler) UpdateVariant(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid variant ID")
		return
	}

	var variant models.ProductVariant
	if err := h.db.First(&variant, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Variant not found")
			return
		}
		models.SendInternalError(c, "Failed to find variant")
		return
	}

	var req models.UpdateVariantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if req.VariantName != nil {
		variant.VariantName = *req.VariantName
	}
	if req.CogsPrice != nil {
		variant.CogsPrice = *req.CogsPrice
	}
	if req.RetailPrice != nil {
		variant.RetailPrice = *req.RetailPrice
	}
	if req.SKU != nil {
		variant.SKU = *req.SKU
	}
	if req.IsActive != nil {
		variant.IsActive = *req.IsActive
	}

	if err := h.db.Save(&variant).Error; err != nil {
		models.SendInternalError(c, "Failed to update variant")
		return
	}

	models.SendSuccess(c, http.StatusOK, variant, "Variant updated successfully")
}

// DeleteVariant deletes a variant record
func (h *VariantHandler) DeleteVariant(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid variant ID")
		return
	}

	var variant models.ProductVariant
	if err := h.db.First(&variant, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Variant not found")
			return
		}
		models.SendInternalError(c, "Failed to find variant")
		return
	}

	if err := h.db.Delete(&variant).Error; err != nil {
		models.SendInternalError(c, "Failed to delete variant")
		return
	}

	models.SendSuccess(c, http.StatusOK, nil, "Variant deleted successfully")
}
