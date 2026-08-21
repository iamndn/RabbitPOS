package handlers

import (
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const settingsCacheKey = "settings:all"

type SettingHandler struct {
	db       *gorm.DB
	emailSvc *services.EmailService
	cache    *cache.TTLCache
}

func NewSettingHandler(db *gorm.DB, emailSvc *services.EmailService, c *cache.TTLCache) *SettingHandler {
	return &SettingHandler{db: db, emailSvc: emailSvc, cache: c}
}

// GetSettings retrieves all system settings as a JSON key-value object map with in-memory caching
func (h *SettingHandler) GetSettings(c *gin.Context) {
	if h.cache != nil {
		if cached, ok := h.cache.Get(settingsCacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Settings retrieved successfully")
			return
		}
	}

	var settings []models.Setting
	if err := h.db.Find(&settings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve settings", err)
		return
	}

	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	if h.cache != nil {
		h.cache.SetWithTTL(settingsCacheKey, settingsMap, 10*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings retrieved successfully")
}

// UpdateSettings bulk updates system setting key-value pairs (Admin only)
func (h *SettingHandler) UpdateSettings(c *gin.Context) {
	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid settings payload")
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
		models.SendInternalErrorLogged(c, "Failed to update settings", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(settingsCacheKey)
	}

	// Fetch updated settings map
	var settings []models.Setting
	h.db.Find(&settings)

	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	if h.cache != nil {
		h.cache.SetWithTTL(settingsCacheKey, settingsMap, 10*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings updated successfully")
}

// TestSMTP sends a test email to verify SMTP credentials configured in system settings
// POST /api/v1/settings/test-smtp
// Body (optional): { "to": "email@example.com" }
func (h *SettingHandler) TestSMTP(c *gin.Context) {
	var req struct {
		To string `json:"to"`
	}
	_ = c.ShouldBindJSON(&req)

	// If no target specified, use the first configured recipient email
	if req.To == "" {
		recipients := h.emailSvc.GetDefaultRecipients()
		if len(recipients) > 0 {
			req.To = recipients[0]
		}
	}
	if req.To == "" {
		models.SendError(c, http.StatusBadRequest, "No recipient email specified and no configured recipients found")
		return
	}

	if err := h.emailSvc.SendTestEmail(req.To); err != nil {
		models.SendError(c, http.StatusInternalServerError, "SMTP test failed: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"to": req.To}, "Test email sent successfully to "+req.To)
}
