package handlers

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
)

type ImporterHandler struct {
	importerSvc *services.ImporterService
}

func NewImporterHandler(importerSvc *services.ImporterService) *ImporterHandler {
	return &ImporterHandler{importerSvc: importerSvc}
}

// DownloadTemplate streams the standardized Excel template with sample data and guidelines
// GET /api/v1/import/template
func (h *ImporterHandler) DownloadTemplate(c *gin.Context) {
	data, err := h.importerSvc.GenerateExcelTemplate()
	if err != nil {
		models.SendInternalError(c, "Failed to generate Excel template: "+err.Error())
		return
	}

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", "attachment; filename=Mau_Nhap_Du_Lieu_RabbitPOS.xlsx")
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Expires", "0")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")

	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

// ImportData parses an uploaded Excel (.xlsx) or CSV file and executes bulk data ingestion
// POST /api/v1/import/excel
func (h *ImporterHandler) ImportData(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Vui lòng chọn file Excel (.xlsx) hoặc CSV để tải lên")
		return
	}

	// Extract options
	target := c.DefaultPostForm("target", c.DefaultQuery("target", "all"))
	upsertProducts := c.DefaultPostForm("upsert_products", "true") == "true"
	updateFunds := c.DefaultPostForm("update_funds", "true") == "true"

	opts := models.ImportOptions{
		Target:         target,
		UpsertProducts: upsertProducts,
		UpdateFunds:    updateFunds,
	}

	// Extract authenticated user
	var currentUserID *uint
	if uid, exists := c.Get("user_id"); exists {
		if id, ok := uid.(uint); ok {
			currentUserID = &id
		}
	}
	currentUsername := "admin"
	if uName, exists := c.Get("username"); exists {
		if name, ok := uName.(string); ok && name != "" {
			currentUsername = name
		}
	}

	file, err := fileHeader.Open()
	if err != nil {
		models.SendInternalError(c, "Không thể đọc file: "+err.Error())
		return
	}
	defer file.Close()

	fileName := strings.ToLower(fileHeader.Filename)
	var response *models.ImportResponse

	if strings.HasSuffix(fileName, ".xlsx") || strings.HasSuffix(fileName, ".xls") {
		// Read into buffer for io.ReaderAt
		buf := new(bytes.Buffer)
		if _, err := io.Copy(buf, file); err != nil {
			models.SendInternalError(c, "Lỗi đọc dữ liệu file: "+err.Error())
			return
		}
		reader := bytes.NewReader(buf.Bytes())
		response, err = h.importerSvc.ImportExcel(reader, int64(buf.Len()), opts, currentUserID, currentUsername)
	} else if strings.HasSuffix(fileName, ".csv") {
		response, err = h.importerSvc.ImportCSV(file, opts, currentUserID, currentUsername)
	} else {
		models.SendError(c, http.StatusBadRequest, "Định dạng file không được hỗ trợ. Vui lòng sử dụng file .xlsx hoặc .csv")
		return
	}

	if err != nil {
		models.SendInternalError(c, "Nhập dữ liệu thất bại: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, response, response.Message)
}
