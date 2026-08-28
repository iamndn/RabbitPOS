package models

import (
	"strings"
	"time"
)

// Setting represents a system key-value configuration entry
type Setting struct {
	Key       string    `gorm:"primaryKey;type:varchar(100)" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateSettingsRequest payload map for bulk settings update
type UpdateSettingsRequest map[string]string

// SensitiveSettingKeys defines keys that contain secret credentials needing encryption & masking
var SensitiveSettingKeys = map[string]bool{
	"smtp_password":                      true,
	"google_sheets_service_account_json": true,
}

// StoreSettingsKeys defines the safe whitelist of settings accessible to cashier/staff POS clients
var StoreSettingsKeys = map[string]bool{
	"store_name":                       true,
	"store_address":                    true,
	"store_phone":                      true,
	"store_logo_url":                   true,
	"currency":                         true,
	"currency_symbol":                  true,
	"auto_show_receipt_after_checkout": true,
	"vietqr_bank_id":                   true,
	"vietqr_account_no":                true,
	"vietqr_account_name":              true,
}

const (
	SecretMaskShort = "••••••••"
	SecretMaskJSON  = "{\n  \"type\": \"service_account\",\n  \"private_key\": \"[PROTECTED_ENCRYPTED_KEY]\",\n  \"status\": \"CONFIGURED\"\n}"
)

// MaskSecretValue returns a safe masked representation of a sensitive setting value
func MaskSecretValue(key, val string) string {
	if strings.TrimSpace(val) == "" {
		return ""
	}
	if key == "google_sheets_service_account_json" {
		return SecretMaskJSON
	}
	return SecretMaskShort
}

// IsSecretMasked checks if the incoming value from client is a mask placeholder
func IsSecretMasked(val string) bool {
	trimmed := strings.TrimSpace(val)
	return trimmed == SecretMaskShort ||
		trimmed == "********" ||
		trimmed == "******" ||
		strings.Contains(trimmed, "[PROTECTED_ENCRYPTED_KEY]") ||
		strings.Contains(trimmed, "[PROTECTED]")
}
