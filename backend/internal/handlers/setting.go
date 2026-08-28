package handlers

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const settingsCacheKey = "settings:all"
const storeSettingsCacheKey = "settings:store"

type SettingHandler struct {
	db       *gorm.DB
	emailSvc *services.EmailService
	cache    *cache.TTLCache
	auditSvc *services.AuditService
}

func NewSettingHandler(db *gorm.DB, emailSvc *services.EmailService, c *cache.TTLCache, auditSvc *services.AuditService) *SettingHandler {
	return &SettingHandler{
		db:       db,
		emailSvc: emailSvc,
		cache:    c,
		auditSvc: auditSvc,
	}
}

// GetStoreSettings retrieves safe public/store branding settings for POS clients and staff
// GET /api/v1/settings/store
func (h *SettingHandler) GetStoreSettings(c *gin.Context) {
	if h.cache != nil {
		if cached, ok := h.cache.Get(storeSettingsCacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Store settings retrieved successfully")
			return
		}
	}

	var settings []models.Setting
	if err := h.db.Find(&settings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve store settings", err)
		return
	}

	storeMap := make(map[string]string)
	for _, s := range settings {
		if models.StoreSettingsKeys[s.Key] {
			storeMap[s.Key] = s.Value
		}
	}

	if h.cache != nil {
		h.cache.SetWithTTL(storeSettingsCacheKey, storeMap, 10*time.Minute)
	}

	models.SendSuccess(c, http.StatusOK, storeMap, "Store settings retrieved successfully")
}

// GetSettings retrieves all system settings with sensitive secrets masked and configured flags (Admin only)
// GET /api/v1/settings
func (h *SettingHandler) GetSettings(c *gin.Context) {
	var settings []models.Setting
	if err := h.db.Find(&settings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve settings", err)
		return
	}

	settingsMap := make(map[string]string)
	for _, s := range settings {
		val := s.Value
		if models.SensitiveSettingKeys[s.Key] {
			hasValue := strings.TrimSpace(val) != ""
			settingsMap[s.Key+"_configured"] = fmt.Sprintf("%t", hasValue)
			settingsMap[s.Key] = models.MaskSecretValue(s.Key, val)
		} else {
			settingsMap[s.Key] = val
		}
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings retrieved successfully")
}

// UpdateSettings bulk updates system settings with encryption for secrets and preserves masked values (Admin only)
// PUT /api/v1/settings
func (h *SettingHandler) UpdateSettings(c *gin.Context) {
	ip := middleware.GetClientIP(c)
	userAgent := c.Request.UserAgent()

	var req models.UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid settings payload")
		return
	}

	if len(req) == 0 {
		models.SendErrorCode(c, http.StatusBadRequest, "EMPTY_PAYLOAD", "No settings provided to update")
		return
	}

	// Fetch existing settings map for preserving masked secrets
	var existingSettings []models.Setting
	h.db.Find(&existingSettings)
	existingMap := make(map[string]string)
	for _, s := range existingSettings {
		existingMap[s.Key] = s.Value
	}

	encKey := utils.GetSettingsEncryptionKey()
	now := time.Now()
	auditUpdatedKeys := []string{}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		for key, val := range req {
			// Skip metadata / configured virtual fields
			if strings.HasSuffix(key, "_configured") {
				continue
			}

			finalValue := val
			if models.SensitiveSettingKeys[key] {
				// If incoming value is masked or empty and existing value exists, preserve existing encrypted secret
				if models.IsSecretMasked(val) || (strings.TrimSpace(val) == "" && existingMap[key] != "") {
					finalValue = existingMap[key]
				} else if strings.TrimSpace(val) != "" {
					// Encrypt new secret with AES-256-GCM
					encrypted, err := utils.EncryptSettingSecret(val, encKey)
					if err != nil {
						return fmt.Errorf("failed to encrypt secret for '%s': %w", key, err)
					}
					finalValue = encrypted
				}
			}

			setting := models.Setting{
				Key:       key,
				Value:     finalValue,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
			}).Create(&setting).Error; err != nil {
				return err
			}
			auditUpdatedKeys = append(auditUpdatedKeys, key)
		}
		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to update settings", err)
		return
	}

	if h.cache != nil {
		h.cache.Invalidate(settingsCacheKey)
		h.cache.Invalidate(storeSettingsCacheKey)
	}

	// Record audit log
	if h.auditSvc != nil {
		var actorID *uint
		if uidVal, exists := c.Get("user_id"); exists {
			if uid, ok := uidVal.(uint); ok {
				actorID = &uid
			}
		}
		actorUsername, _ := c.Get("username")
		role, _ := c.Get("role")
		h.auditSvc.RecordLog(
			actorID,
			fmt.Sprintf("%v", actorUsername),
			fmt.Sprintf("%v", role),
			"settings.update",
			"settings",
			nil,
			"success",
			ip,
			userAgent,
			map[string]interface{}{"updated_keys": auditUpdatedKeys},
		)
	}

	// Return masked settings response
	var updatedSettings []models.Setting
	h.db.Find(&updatedSettings)

	responseMap := make(map[string]string)
	for _, s := range updatedSettings {
		if models.SensitiveSettingKeys[s.Key] {
			hasValue := strings.TrimSpace(s.Value) != ""
			responseMap[s.Key+"_configured"] = fmt.Sprintf("%t", hasValue)
			responseMap[s.Key] = models.MaskSecretValue(s.Key, s.Value)
		} else {
			responseMap[s.Key] = s.Value
		}
	}

	models.SendSuccess(c, http.StatusOK, responseMap, "Settings updated successfully")
}

// TestSMTP sends a test email to verify SMTP credentials configured in system settings
// POST /api/v1/settings/test-smtp
func (h *SettingHandler) TestSMTP(c *gin.Context) {
	var req struct {
		To string `json:"to"`
	}
	_ = c.ShouldBindJSON(&req)

	if req.To == "" {
		recipients := h.emailSvc.GetDefaultRecipients()
		if len(recipients) > 0 {
			req.To = recipients[0]
		}
	}
	if req.To == "" {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_RECIPIENT", "No recipient email specified and no configured recipients found")
		return
	}

	if err := h.emailSvc.SendTestEmail(req.To); err != nil {
		models.SendErrorCode(c, http.StatusInternalServerError, "SMTP_FAILED", "SMTP test failed: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"to": req.To}, "Test email sent successfully to "+req.To)
}
