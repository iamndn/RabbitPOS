package handlers

import (
	"net/http"
	"strconv"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProductHandler struct {
	db *gorm.DB
}

func NewProductHandler(db *gorm.DB) *ProductHandler {
	return &ProductHandler{db: db}
}

// ListProducts lists products with optional filters (category_id, tag, is_active)
func (h *ProductHandler) ListProducts(c *gin.Context) {
	query := h.db.Model(&models.Product{}).Preload("Category").Preload("Variants").Preload("VariantGroups")

	if categoryIDStr := c.Query("category_id"); categoryIDStr != "" {
		if categoryID, err := strconv.ParseUint(categoryIDStr, 10, 32); err == nil {
			query = query.Where("category_id = ?", categoryID)
		}
	}

	if tag := c.Query("tag"); tag != "" {
		query = query.Where("tag = ?", tag)
	}

	if isActiveStr := c.Query("is_active"); isActiveStr != "" {
		if isActive, err := strconv.ParseBool(isActiveStr); err == nil {
			query = query.Where("is_active = ?", isActive)
		}
	}

	products := make([]models.Product, 0)
	if err := query.Order("name asc").Find(&products).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve products: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, products, "Products retrieved successfully")
}

// GetProductByID returns single product with loaded relations
func (h *ProductHandler) GetProductByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.Preload("Category").Preload("Variants").Preload("VariantGroups").First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalError(c, "Failed to find product")
		return
	}

	models.SendSuccess(c, http.StatusOK, product, "Product details retrieved successfully")
}

// CreateProduct creates a new product and initial variants in a single transaction
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	tag := req.Tag
	if tag == "" {
		tag = models.TagNone
	}

	product := models.Product{
		CategoryID:  req.CategoryID,
		Name:        req.Name,
		Description: req.Description,
		ImageURL:    req.ImageURL,
		Tag:         tag,
		IsActive:    true,
	}

	// Transaction to create Product and associated Variants
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		if len(req.Variants) > 0 {
			var variants []models.ProductVariant
			for _, vReq := range req.Variants {
				isActive := true
				if vReq.IsActive != nil {
					isActive = *vReq.IsActive
				}
				variants = append(variants, models.ProductVariant{
					ProductID:   product.ID,
					VariantName: vReq.VariantName,
					CogsPrice:   vReq.CogsPrice,
					RetailPrice: vReq.RetailPrice,
					SKU:         vReq.SKU,
					IsActive:    isActive,
				})
			}
			if err := tx.Create(&variants).Error; err != nil {
				return err
			}
			product.Variants = variants
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to create product: "+err.Error())
		return
	}

	// Reload product with relations
	h.db.Preload("Category").Preload("Variants").First(&product, product.ID)

	models.SendSuccess(c, http.StatusCreated, product, "Product created successfully")
}

// UpdateProduct updates existing product fields
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalError(c, "Failed to find product")
		return
	}

	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if req.CategoryID != nil {
		product.CategoryID = *req.CategoryID
	}
	if req.Name != nil {
		product.Name = *req.Name
	}
	if req.Description != nil {
		product.Description = *req.Description
	}
	if req.ImageURL != nil {
		product.ImageURL = *req.ImageURL
	}
	if req.Tag != nil {
		product.Tag = *req.Tag
	}
	if req.IsActive != nil {
		product.IsActive = *req.IsActive
	}

	if err := h.db.Save(&product).Error; err != nil {
		models.SendInternalError(c, "Failed to update product")
		return
	}

	h.db.Preload("Category").Preload("Variants").Preload("VariantGroups").First(&product, product.ID)

	models.SendSuccess(c, http.StatusOK, product, "Product updated successfully")
}

// DeleteProduct deletes product record
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalError(c, "Failed to find product")
		return
	}

	if err := h.db.Delete(&product).Error; err != nil {
		models.SendInternalError(c, "Failed to delete product")
		return
	}

	models.SendSuccess(c, http.StatusOK, nil, "Product deleted successfully")
}
