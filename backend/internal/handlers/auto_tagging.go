package handlers

import (
	"net/http"

	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type AutoTaggingHandler struct {
	svc *services.AutoTaggingService
}

func NewAutoTaggingHandler(svc *services.AutoTaggingService) *AutoTaggingHandler {
	return &AutoTaggingHandler{svc: svc}
}

// GetConfig returns current auto-tagging configuration for active store
// GET /api/v1/products/auto-tag/config
func (h *AutoTaggingHandler) GetConfig(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	cfg, err := h.svc.GetConfigForStore(storeID)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve auto-tagging config", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, cfg, "Auto-tagging configuration retrieved")
}

// SaveConfig updates auto-tagging configuration for active store
// PUT /api/v1/products/auto-tag/config
func (h *AutoTaggingHandler) SaveConfig(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req services.AutoTaggingConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.svc.SaveConfigForStore(storeID, req); err != nil {
		models.SendInternalErrorLogged(c, "Failed to save auto-tagging config", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, req, "Auto-tagging configuration saved successfully")
}

// Preview runs a dry-run evaluation without updating the database
// POST /api/v1/products/auto-tag/preview
func (h *AutoTaggingHandler) Preview(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req *services.AutoTaggingConfig
	// Optional custom config in body to simulate different thresholds
	if c.Request.ContentLength > 0 {
		var customCfg services.AutoTaggingConfig
		if err := c.ShouldBindJSON(&customCfg); err == nil {
			req = &customCfg
		}
	}

	result, err := h.svc.EvaluateForStore(c.Request.Context(), storeID, req)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to simulate auto-tagging", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, result, "Auto-tagging evaluation preview generated")
}

// Apply executes tag updates for changed products in active store
// POST /api/v1/products/auto-tag/apply
func (h *AutoTaggingHandler) Apply(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req struct {
		ProductIDs []uint `json:"product_ids"`
	}
	_ = c.ShouldBindJSON(&req)

	result, err := h.svc.ApplyForStore(c.Request.Context(), storeID, req.ProductIDs)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to apply auto-tagging", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, result, "Product tags updated successfully")
}

// ToggleLock sets or unsets tag_locked for a single product inside active store
// POST /api/v1/products/auto-tag/toggle-lock
func (h *AutoTaggingHandler) ToggleLock(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req struct {
		ProductID uint `json:"product_id" binding:"required"`
		Locked    bool `json:"locked"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.svc.ToggleLockForStore(c.Request.Context(), storeID, req.ProductID, req.Locked); err != nil {
		models.SendInternalErrorLogged(c, "Failed to toggle product tag lock", err)
		return
	}

	statusMsg := "Đã mở khóa nhãn tự động"
	if req.Locked {
		statusMsg = "Đã khóa nhãn thủ công cho sản phẩm"
	}

	models.SendSuccess(c, http.StatusOK, gin.H{
		"product_id": req.ProductID,
		"locked":     req.Locked,
	}, statusMsg)
}
