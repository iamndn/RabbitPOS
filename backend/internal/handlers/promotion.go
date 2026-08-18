package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PromotionHandler struct {
	db *gorm.DB
}

func NewPromotionHandler(db *gorm.DB) *PromotionHandler {
	return &PromotionHandler{db: db}
}

// GetActivePromotions returns all currently valid and active promotions for POS cart application
func (h *PromotionHandler) GetActivePromotions(c *gin.Context) {
	now := time.Now()
	var promotions []models.Promotion

	err := h.db.Where("is_active = ?", true).
		Where("start_date IS NULL OR start_date <= ?", now).
		Where("end_date IS NULL OR end_date >= ?", now).
		Where("usage_limit = 0 OR usage_count < usage_limit").
		Preload("GiftVariant").
		Order("created_at desc").
		Find(&promotions).Error

	if err != nil {
		models.SendInternalError(c, "Failed to retrieve active promotions: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, promotions, "Active promotions retrieved successfully")
}

// ListPromotions returns all promotions for management view (admin)
func (h *PromotionHandler) ListPromotions(c *gin.Context) {
	var promotions []models.Promotion

	if err := h.db.Preload("GiftVariant").Order("created_at desc").Find(&promotions).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve promotions: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, promotions, "All promotions retrieved successfully")
}

// CreatePromotion creates a new promotional rule (admin only)
func (h *PromotionHandler) CreatePromotion(c *gin.Context) {
	var req models.CreatePromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	targetIDsJSON := "[]"
	if len(req.TargetIDs) > 0 {
		if b, err := json.Marshal(req.TargetIDs); err == nil {
			targetIDsJSON = string(b)
		}
	}

	scope := models.PromoScopeAll
	if req.Scope != "" {
		scope = req.Scope
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	promotion := models.Promotion{
		Name:                 req.Name,
		PromoType:            req.PromoType,
		DiscountValue:        req.DiscountValue,
		MinOrderAmount:       req.MinOrderAmount,
		MinQuantity:          req.MinQuantity,
		Scope:                scope,
		TargetIDs:            targetIDsJSON,
		GiftProductVariantID: req.GiftProductVariantID,
		StartDate:            req.StartDate,
		EndDate:              req.EndDate,
		UsageLimit:           req.UsageLimit,
		UsageCount:           0,
		IsActive:             isActive,
	}

	if err := h.db.Create(&promotion).Error; err != nil {
		models.SendInternalError(c, "Failed to create promotion: "+err.Error())
		return
	}

	if promotion.GiftProductVariantID != nil {
		h.db.Preload("GiftVariant").First(&promotion, promotion.ID)
	}

	models.SendSuccess(c, http.StatusCreated, promotion, "Promotion created successfully")
}

// UpdatePromotion updates an existing promotion rule (admin only)
func (h *PromotionHandler) UpdatePromotion(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid promotion ID")
		return
	}

	var promo models.Promotion
	if err := h.db.First(&promo, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Promotion not found")
			return
		}
		models.SendInternalError(c, "Database error")
		return
	}

	var req models.UpdatePromotionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.PromoType != nil {
		updates["promo_type"] = *req.PromoType
	}
	if req.DiscountValue != nil {
		updates["discount_value"] = *req.DiscountValue
	}
	if req.MinOrderAmount != nil {
		updates["min_order_amount"] = *req.MinOrderAmount
	}
	if req.MinQuantity != nil {
		updates["min_quantity"] = *req.MinQuantity
	}
	if req.Scope != nil {
		updates["scope"] = *req.Scope
	}
	if req.TargetIDs != nil {
		if b, err := json.Marshal(*req.TargetIDs); err == nil {
			updates["target_ids"] = string(b)
		}
	}
	if req.GiftProductVariantID != nil {
		updates["gift_product_variant_id"] = req.GiftProductVariantID
	}
	if req.StartDate != nil {
		updates["start_date"] = req.StartDate
	}
	if req.EndDate != nil {
		updates["end_date"] = req.EndDate
	}
	if req.UsageLimit != nil {
		updates["usage_limit"] = *req.UsageLimit
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	updates["updated_at"] = time.Now()

	if err := h.db.Model(&promo).Updates(updates).Error; err != nil {
		models.SendInternalError(c, "Failed to update promotion: "+err.Error())
		return
	}

	h.db.Preload("GiftVariant").First(&promo, promo.ID)
	models.SendSuccess(c, http.StatusOK, promo, "Promotion updated successfully")
}

// DeletePromotion deletes a promotion rule (admin only)
func (h *PromotionHandler) DeletePromotion(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid promotion ID")
		return
	}

	var promo models.Promotion
	if err := h.db.First(&promo, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Promotion not found")
			return
		}
		models.SendInternalError(c, "Database error")
		return
	}

	tx := h.db.Begin()

	// Decouple any historical orders by setting promotion_id = NULL so orders retain all financial records
	if err := tx.Model(&models.Order{}).Where("promotion_id = ?", id).Update("promotion_id", nil).Error; err != nil {
		tx.Rollback()
		models.SendInternalError(c, "Failed to decouple promotion from orders: "+err.Error())
		return
	}

	if err := tx.Delete(&promo).Error; err != nil {
		tx.Rollback()
		models.SendInternalError(c, "Failed to delete promotion: "+err.Error())
		return
	}

	tx.Commit()
	models.SendSuccess(c, http.StatusOK, nil, "Promotion deleted successfully")
}
