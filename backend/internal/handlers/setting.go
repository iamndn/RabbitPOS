package handlers

import (
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SettingHandler struct {
	db *gorm.DB
}

func NewSettingHandler(db *gorm.DB) *SettingHandler {
	return &SettingHandler{db: db}
}

// GetSettings retrieves all system settings as a JSON key-value object map
func (h *SettingHandler) GetSettings(c *gin.Context) {
	var settings []models.Setting
	if err := h.db.Find(&settings).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve settings: "+err.Error())
		return
	}

	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings retrieved successfully")
}

// UpdateSettings bulk updates system setting key-value pairs (Admin only)
func (h *SettingHandler) UpdateSettings(c *gin.Context) {
	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ResponseEnvelope{
			Status:  "error",
			Message: "Invalid settings payload: " + err.Error(),
		})
		return
	}

	if len(req) == 0 {
		models.SendError(c, http.StatusBadRequest, "No settings provided to update")
		return
	}

	now := time.Now()
	err := h.db.Transaction(func(tx *gorm.DB) error {
		for key, val := range req {
			setting := models.Setting{
				Key:       key,
				Value:     val,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
			}).Create(&setting).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to update settings: "+err.Error())
		return
	}

	// Fetch updated settings map
	var settings []models.Setting
	h.db.Find(&settings)

	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings updated successfully")
}
