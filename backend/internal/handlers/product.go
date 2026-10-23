package handlers

import (
	"context"
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

type ProductHandler struct {
	db    *gorm.DB
	cache *cache.TTLCache
}

func NewProductHandler(db *gorm.DB, c *cache.TTLCache) *ProductHandler {
	return &ProductHandler{db: db, cache: c}
}

func productCachePrefix(storeID uint) string {
	return fmt.Sprintf("s%d:products:", storeID)
}

// ListProducts lists products for the active store with optional filters and caching
func (h *ProductHandler) ListProducts(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	categoryIDStr := c.Query("category_id")
	tag := c.Query("tag")
	isActiveStr := c.Query("is_active")

	cacheKey := fmt.Sprintf("s%d:products:list:%s:%s:%s", storeID, categoryIDStr, tag, isActiveStr)
	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Products retrieved successfully")
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := h.db.WithContext(ctx).Model(&models.Product{}).
		Scopes(database.ScopeByStore(storeID)).
		Preload("Category").
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("retail_price asc")
		}).
		Preload("VariantGroups")

	if categoryIDStr != "" {
		if categoryID, err := strconv.ParseUint(categoryIDStr, 10, 32); err == nil {
			query = query.Where("category_id = ?", categoryID)
		}
	}

	if tag != "" {
		query = query.Where("tag = ?", tag)
	}

	if isActiveStr != "" {
		if isActive, err := strconv.ParseBool(isActiveStr); err == nil {
			query = query.Where("is_active = ?", isActive)
		}
	}

	products := make([]models.Product, 0)
	if err := query.Order("name asc").Find(&products).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve products", err)
		return
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, products, 3*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, products, "Products retrieved successfully")
}

// GetProductByID returns single product with loaded relations scoped to active store
func (h *ProductHandler) GetProductByID(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var product models.Product
	if err := h.db.WithContext(ctx).
		Scopes(database.ScopeByStore(storeID)).
		Preload("Category").
		Preload("Variants", func(db *gorm.DB) *gorm.DB {
			return db.Where("is_active = ?", true).Order("retail_price asc")
		}).
		Preload("VariantGroups").
		First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalError(c, "Failed to find product")
		return
	}

	models.SendSuccess(c, http.StatusOK, product, "Product details retrieved successfully")
}

// CreateProduct creates a new product and initial variants in a single transaction scoped to active store
func (h *ProductHandler) CreateProduct(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req models.CreateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	// Verify Category belongs to this store
	if err := database.AssertOwned(h.db, &models.Category{}, req.CategoryID, storeID); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Category does not belong to the active store")
		return
	}

	tag := req.Tag
	if tag == "" {
		tag = models.TagNone
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	tagLocked := false
	if req.TagLocked != nil {
		tagLocked = *req.TagLocked
	}

	product := models.Product{
		StoreID:     storeID,
		CategoryID:  req.CategoryID,
		Name:        req.Name,
		Description: req.Description,
		ImageURL:    req.ImageURL,
		Tag:         tag,
		TagLocked:   tagLocked,
		IsActive:    isActive,
	}

	// Transaction to create Product and associated Variants
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&product).Error; err != nil {
			return err
		}

		if len(req.Variants) > 0 {
			var variants []models.ProductVariant
			for _, vReq := range req.Variants {
				vIsActive := true
				if vReq.IsActive != nil {
					vIsActive = *vReq.IsActive
				}
				variants = append(variants, models.ProductVariant{
					ProductID:   product.ID,
					VariantName: vReq.VariantName,
					CogsPrice:   vReq.CogsPrice,
					RetailPrice: vReq.RetailPrice,
					SKU:         vReq.SKU,
					IsActive:    vIsActive,
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
		models.SendInternalErrorLogged(c, "Failed to create product", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(productCachePrefix(storeID))
	}

	// Reload product with relations
	h.db.Scopes(database.ScopeByStore(storeID)).Preload("Category").Preload("Variants").First(&product, product.ID)

	models.SendSuccess(c, http.StatusCreated, product, "Product created successfully")
}

// UpdateProduct updates existing product fields scoped to active store
func (h *ProductHandler) UpdateProduct(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find product", err)
		return
	}

	var req models.UpdateProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.CategoryID != nil {
		if err := database.AssertOwned(h.db, &models.Category{}, *req.CategoryID, storeID); err != nil {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Category does not belong to the active store")
			return
		}
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
	if req.TagLocked != nil {
		product.TagLocked = *req.TagLocked
	}
	if req.IsActive != nil {
		product.IsActive = *req.IsActive
	}

	if err := h.db.Save(&product).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update product", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(productCachePrefix(storeID))
	}

	h.db.Scopes(database.ScopeByStore(storeID)).Preload("Category").Preload("Variants").Preload("VariantGroups").First(&product, product.ID)

	models.SendSuccess(c, http.StatusOK, product, "Product updated successfully")
}

// DeleteProduct deletes product record scoped to active store
func (h *ProductHandler) DeleteProduct(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid product ID")
		return
	}

	var product models.Product
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&product, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Product not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find product", err)
		return
	}

	if err := h.db.Delete(&product).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete product", err)
		return
	}

	if h.cache != nil {
		h.cache.InvalidatePrefix(productCachePrefix(storeID))
	}

	models.SendSuccess(c, http.StatusOK, nil, "Product deleted successfully")
}
