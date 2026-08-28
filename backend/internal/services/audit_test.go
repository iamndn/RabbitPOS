package services

import (
	"strings"
	"testing"
)

func TestAudit_SanitizeMetadata_ScrubsPasswordsAndKeys(t *testing.T) {
	rawMetadata := map[string]interface{}{
		"action":                             "settings_update",
		"smtp_user":                          "rabbitpos@example.com",
		"smtp_password":                      "super_secret_smtp_password_123",
		"google_sheets_service_account_json": `{"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk..."}`,
		"temp_token":                         "jwt_secret_token_abc_xyz",
		"client_ip":                          "192.168.1.50",
		"nested_info": map[string]interface{}{
			"user_password": "my_new_password_456",
			"public_info":   "safe_value",
		},
	}

	sanitizedJSON := SanitizeAuditMetadata(rawMetadata)

	// Verify that secret values are NOT in the output
	if strings.Contains(sanitizedJSON, "super_secret_smtp_password_123") {
		t.Errorf("SanitizeAuditMetadata leaked smtp_password in output: %s", sanitizedJSON)
	}
	if strings.Contains(sanitizedJSON, "BEGIN PRIVATE KEY") {
		t.Errorf("SanitizeAuditMetadata leaked private_key in output: %s", sanitizedJSON)
	}
	if strings.Contains(sanitizedJSON, "jwt_secret_token_abc_xyz") {
		t.Errorf("SanitizeAuditMetadata leaked temp_token in output: %s", sanitizedJSON)
	}
	if strings.Contains(sanitizedJSON, "my_new_password_456") {
		t.Errorf("SanitizeAuditMetadata leaked nested user_password in output: %s", sanitizedJSON)
	}

	// Verify that safe values ARE preserved
	if !strings.Contains(sanitizedJSON, "rabbitpos@example.com") {
		t.Errorf("SanitizeAuditMetadata should preserve safe smtp_user: %s", sanitizedJSON)
	}
	if !strings.Contains(sanitizedJSON, "192.168.1.50") {
		t.Errorf("SanitizeAuditMetadata should preserve safe client_ip: %s", sanitizedJSON)
	}
	if !strings.Contains(sanitizedJSON, "safe_value") {
		t.Errorf("SanitizeAuditMetadata should preserve nested safe_value: %s", sanitizedJSON)
	}
}
