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
	storeID := middleware.GetStoreID(c)
	if storeID == 0 {
		storeID = 1
	}

	cacheKey := fmt.Sprintf("s%d:settings:store", storeID)
	if h.cache != nil {
		if cached, ok := h.cache.Get(cacheKey); ok {
			models.SendSuccess(c, http.StatusOK, cached, "Store settings retrieved successfully")
			return
		}
	}

	storeMap := make(map[string]string)

	// 1. Fetch store entity
	var store models.Store
	if err := h.db.First(&store, storeID).Error; err == nil {
		if store.Name != "" {
			storeMap["store_name"] = store.Name
		}
		if store.Address != "" {
			storeMap["store_address"] = store.Address
		}
		if store.Phone != "" {
			storeMap["store_phone"] = store.Phone
		}
		if store.LogoURL != "" {
			storeMap["store_logo_url"] = store.LogoURL
		}
		if store.CurrencyCode != "" {
			storeMap["currency"] = store.CurrencyCode
		}
		if store.CurrencySymbol != "" {
			storeMap["currency_symbol"] = store.CurrencySymbol
		}
		if store.VietQRBankID != "" {
			storeMap["vietqr_bank_id"] = store.VietQRBankID
		}
		if store.VietQRAccountNo != "" {
			storeMap["vietqr_account_no"] = store.VietQRAccountNo
		}
		if store.VietQRAccountName != "" {
			storeMap["vietqr_account_name"] = store.VietQRAccountName
		}
	}

	// 2. Fetch global settings for fallbacks
	var globalSettings []models.Setting
	h.db.Find(&globalSettings)
	for _, s := range globalSettings {
		if models.StoreSettingsKeys[s.Key] {
			if _, exists := storeMap[s.Key]; !exists || storeMap[s.Key] == "" {
				storeMap[s.Key] = s.Value
			}
		}
	}

	// 3. Fetch store-specific settings
	var storeSettings []models.StoreSetting
	h.db.Where("store_id = ?", storeID).Find(&storeSettings)
	for _, s := range storeSettings {
		if models.StoreSettingsKeys[s.Key] {
			storeMap[s.Key] = s.Value
		}
	}

	if h.cache != nil {
		h.cache.SetWithTTL(cacheKey, storeMap, 10*time.Minute)
		if storeID == 1 {
			h.cache.SetWithTTL("settings:store", storeMap, 10*time.Minute)
		}
	}

	models.SendSuccess(c, http.StatusOK, storeMap, "Store settings retrieved successfully")
}

// GetSettings retrieves all system settings with sensitive secrets masked and configured flags (Admin only)
// GET /api/v1/settings
func (h *SettingHandler) GetSettings(c *gin.Context) {
	storeID := middleware.GetStoreID(c)
	if storeID == 0 {
		storeID = 1
	}

	settingsMap := make(map[string]string)

	// 1. Fetch global settings (SMTP, etc.)
	var globalSettings []models.Setting
	if err := h.db.Find(&globalSettings).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve settings", err)
		return
	}
	for _, s := range globalSettings {
		val := s.Value
		if models.SensitiveSettingKeys[s.Key] {
			hasValue := strings.TrimSpace(val) != ""
			settingsMap[s.Key+"_configured"] = fmt.Sprintf("%t", hasValue)
			settingsMap[s.Key] = models.MaskSecretValue(s.Key, val)
		} else {
			settingsMap[s.Key] = val
		}
	}

	// 2. Fetch store-specific settings
	var storeSettings []models.StoreSetting
	h.db.Where("store_id = ?", storeID).Find(&storeSettings)
	for _, s := range storeSettings {
		val := s.Value
		if models.SensitiveSettingKeys[s.Key] {
			hasValue := strings.TrimSpace(val) != ""
			settingsMap[s.Key+"_configured"] = fmt.Sprintf("%t", hasValue)
			settingsMap[s.Key] = models.MaskSecretValue(s.Key, val)
		} else {
			settingsMap[s.Key] = val
		}
	}

	// 3. Overlay store identity columns
	var store models.Store
	if err := h.db.First(&store, storeID).Error; err == nil {
		if store.Name != "" {
			settingsMap["store_name"] = store.Name
		}
		if store.Address != "" {
			settingsMap["store_address"] = store.Address
		}
		if store.Phone != "" {
			settingsMap["store_phone"] = store.Phone
		}
		if store.LogoURL != "" {
			settingsMap["store_logo_url"] = store.LogoURL
		}
		if store.CurrencyCode != "" {
			settingsMap["currency"] = store.CurrencyCode
		}
		if store.CurrencySymbol != "" {
			settingsMap["currency_symbol"] = store.CurrencySymbol
		}
		if store.VietQRBankID != "" {
			settingsMap["vietqr_bank_id"] = store.VietQRBankID
		}
		if store.VietQRAccountNo != "" {
			settingsMap["vietqr_account_no"] = store.VietQRAccountNo
		}
		if store.VietQRAccountName != "" {
			settingsMap["vietqr_account_name"] = store.VietQRAccountName
		}
		if store.Timezone != "" {
			settingsMap["timezone"] = store.Timezone
		}
	}

	models.SendSuccess(c, http.StatusOK, settingsMap, "Settings retrieved successfully")
}

// UpdateSettings bulk updates system settings with encryption for secrets and preserves masked values (Admin only)
// PUT /api/v1/settings
func (h *SettingHandler) UpdateSettings(c *gin.Context) {
	storeID := middleware.GetStoreID(c)
	if storeID == 0 {
		storeID = 1
	}

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

	userRole, _ := c.Get("role")
	roleStr := fmt.Sprintf("%v", userRole)
	isSuperAdmin := roleStr == string(models.StoreRoleSuperAdmin) || roleStr == "admin"

	// Fetch existing settings map for preserving masked secrets
	existingMap := make(map[string]string)
	var globalExisting []models.Setting
	h.db.Find(&globalExisting)
	for _, s := range globalExisting {
		existingMap[s.Key] = s.Value
	}
	var storeExisting []models.StoreSetting
	h.db.Where("store_id = ?", storeID).Find(&storeExisting)
	for _, s := range storeExisting {
		existingMap[s.Key] = s.Value
	}

	encKey := utils.GetSettingsEncryptionKey()
	now := time.Now()
	auditUpdatedKeys := []string{}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		storeUpdates := make(map[string]interface{})

		for key, val := range req {
			// Skip metadata / configured virtual fields
			if strings.HasSuffix(key, "_configured") {
				continue
			}

			// Restrict global SMTP keys to super_admin
			if strings.HasPrefix(key, "smtp_") && !isSuperAdmin {
				continue
			}

			// Check for store columns
			switch key {
			case "store_name":
				storeUpdates["name"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "store_address":
				storeUpdates["address"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "store_phone":
				storeUpdates["phone"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "store_logo_url":
				storeUpdates["logo_url"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "currency":
				storeUpdates["currency_code"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "currency_symbol":
				storeUpdates["currency_symbol"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "vietqr_bank_id":
				storeUpdates["vietqr_bank_id"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "vietqr_account_no":
				storeUpdates["vietqr_account_no"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "vietqr_account_name":
				storeUpdates["vietqr_account_name"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			case "timezone":
				storeUpdates["timezone"] = val
				auditUpdatedKeys = append(auditUpdatedKeys, key)
				continue
			}

			finalValue := val
			if models.SensitiveSettingKeys[key] {
				if models.IsSecretMasked(val) || (strings.TrimSpace(val) == "" && existingMap[key] != "") {
					finalValue = existingMap[key]
				} else if strings.TrimSpace(val) != "" {
					encrypted, err := utils.EncryptSettingSecret(val, encKey)
					if err != nil {
						return fmt.Errorf("failed to encrypt secret for '%s': %w", key, err)
					}
					finalValue = encrypted
				}
			}

			if strings.HasPrefix(key, "smtp_") {
				// Global setting
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
			} else {
				// Store setting
				storeSetting := models.StoreSetting{
					StoreID:   storeID,
					Key:       key,
					Value:     finalValue,
					UpdatedAt: now,
				}
				if err := tx.Clauses(clause.OnConflict{
					Columns:   []clause.Column{{Name: "store_id"}, {Name: "key"}},
					DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
				}).Create(&storeSetting).Error; err != nil {
					return err
				}

				if storeID == 1 {
					// Mirror to global settings table for store 1
					setting := models.Setting{
						Key:       key,
						Value:     finalValue,
						UpdatedAt: now,
					}
					_ = tx.Clauses(clause.OnConflict{
						Columns:   []clause.Column{{Name: "key"}},
						DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
					}).Create(&setting).Error
				}
			}
			auditUpdatedKeys = append(auditUpdatedKeys, key)
		}

		if len(storeUpdates) > 0 {
			storeUpdates["updated_at"] = now
			if err := tx.Model(&models.Store{}).Where("id = ?", storeID).Updates(storeUpdates).Error; err != nil {
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
		h.cache.Invalidate(fmt.Sprintf("s%d:settings:all", storeID))
		h.cache.Invalidate(fmt.Sprintf("s%d:settings:store", storeID))
		h.cache.Invalidate("settings:all")
		h.cache.Invalidate("settings:store")
	}

	// Record audit log
	if h.auditSvc != nil {
		var actorID *uint
		if uidVal, exists := c.Get("user_id"); exists {
			if uid, ok := uidVal.(uint); ok {
				actorID = &uid
			}
		}
		var storeIDPtr *uint
		if storeID > 0 {
			storeIDPtr = &storeID
		}
		actorUsername, _ := c.Get("username")
		role, _ := c.Get("role")
		h.auditSvc.RecordStoreLog(
			storeIDPtr,
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

	// Return updated settings
	h.GetSettings(c)
}

// TestSMTP sends a test email to verify SMTP credentials configured in system settings
// POST /api/v1/settings/test-smtp
func (h *SettingHandler) TestSMTP(c *gin.Context) {
	storeID := middleware.GetStoreID(c)
	if storeID == 0 {
		storeID = 1
	}

	var req struct {
		To string `json:"to"`
	}
	_ = c.ShouldBindJSON(&req)

	if req.To == "" {
		recipients := h.emailSvc.GetDefaultRecipientsForStore(storeID)
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
