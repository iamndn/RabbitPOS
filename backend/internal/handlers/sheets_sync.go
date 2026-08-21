package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type SheetsSyncHandler struct {
	sheetsSyncSvc *services.SheetsSyncService
}

func NewSheetsSyncHandler(sheetsSyncSvc *services.SheetsSyncService) *SheetsSyncHandler {
	return &SheetsSyncHandler{sheetsSyncSvc: sheetsSyncSvc}
}

// TestConnection tests read and write permissions to the configured or provided Google Spreadsheet
// POST /api/v1/settings/sheets/test-connection
func (h *SheetsSyncHandler) TestConnection(c *gin.Context) {
	var req struct {
		SpreadsheetID      string `json:"spreadsheet_id"`
		ServiceAccountJSON string `json:"service_account_json"`
	}
	_ = c.ShouldBindJSON(&req)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	result, err := h.sheetsSyncSvc.TestConnection(ctx, req.ServiceAccountJSON, req.SpreadsheetID)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Kiểm tra kết nối thất bại: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, result, result.Message)
}

// SyncNow triggers immediate full batch synchronization across all 5 Google Sheet tabs
// POST /api/v1/settings/sheets/sync-now
func (h *SheetsSyncHandler) SyncNow(c *gin.Context) {
	if err := h.sheetsSyncSvc.SyncAllToGoogleSheets(); err != nil {
		models.SendError(c, http.StatusInternalServerError, "Đồng bộ thất bại: "+err.Error())
		return
	}

	status, err := h.sheetsSyncSvc.GetStatus()
	if err != nil {
		models.SendSuccess(c, http.StatusOK, gin.H{"status": "success"}, "Đồng bộ toàn bộ dữ liệu lên Google Sheets thành công")
		return
	}

	models.SendSuccess(c, http.StatusOK, status, "Đồng bộ toàn bộ dữ liệu lên Google Sheets thành công")
}

// GetStatus returns the current Google Sheets synchronization status, last synced time, and errors
// GET /api/v1/settings/sheets/status
func (h *SheetsSyncHandler) GetStatus(c *gin.Context) {
	status, err := h.sheetsSyncSvc.GetStatus()
	if err != nil {
		models.SendInternalError(c, "Không thể lấy thông tin trạng thái đồng bộ: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, status, "Lấy trạng thái đồng bộ thành công")
}
