package utils

import (
	"testing"
)

func TestCrypto_AESGCM_RoundTrip(t *testing.T) {
	key := DeriveKeyFromSecret("my-super-secret-backup-passphrase-2026")
	if len(key) != 32 {
		t.Fatalf("Expected 32-byte key, got %d", len(key))
	}

	originalText := []byte(`{"test":"rabbitpos_backup_data_content_12345"}`)
	cipherB64, nonceB64, err := EncryptAESGCM(originalText, key)
	if err != nil {
		t.Fatalf("EncryptAESGCM failed: %v", err)
	}

	decrypted, err := DecryptAESGCM(cipherB64, nonceB64, key)
	if err != nil {
		t.Fatalf("DecryptAESGCM failed: %v", err)
	}

	if string(decrypted) != string(originalText) {
		t.Errorf("Expected decrypted %s, got %s", originalText, decrypted)
	}

	// Tampered ciphertext should fail
	wrongKey := DeriveKeyFromSecret("wrong-password")
	_, err = DecryptAESGCM(cipherB64, nonceB64, wrongKey)
	if err == nil {
		t.Errorf("Expected decryption error with wrong key, but got nil")
	}
}

func TestCrypto_ComputeSHA256Checksum(t *testing.T) {
	type SampleData struct {
		Name  string `json:"name"`
		Count int    `json:"count"`
	}

	d1 := SampleData{Name: "Cam sành", Count: 10}
	d2 := SampleData{Name: "Cam sành", Count: 10}
	d3 := SampleData{Name: "Cam sành", Count: 11}

	chk1, err := ComputeSHA256Checksum(d1)
	if err != nil {
		t.Fatalf("ComputeSHA256Checksum failed: %v", err)
	}
	chk2, _ := ComputeSHA256Checksum(d2)
	chk3, _ := ComputeSHA256Checksum(d3)

	if chk1 != chk2 {
		t.Errorf("Checksums for identical structs should match: %s vs %s", chk1, chk2)
	}
	if chk1 == chk3 {
		t.Errorf("Checksums for different structs should differ: %s vs %s", chk1, chk3)
	}
}

func TestCrypto_GenerateSecureToken(t *testing.T) {
	tok1, err := GenerateSecureToken(16)
	if err != nil {
		t.Fatalf("GenerateSecureToken failed: %v", err)
	}
	tok2, _ := GenerateSecureToken(16)

	if len(tok1) != 32 { // 16 bytes = 32 hex chars
		t.Errorf("Expected 32 hex chars, got %d", len(tok1))
	}
	if tok1 == tok2 {
		t.Errorf("Tokens should be uniquely generated")
	}
}

func TestCrypto_SettingSecret_EncryptionRoundTrip(t *testing.T) {
	secretKey := "test-settings-secret-key-32bytes!"
	plainSecret := "smtp_app_password_super_secret_123"

	envelope, err := EncryptSettingSecret(plainSecret, secretKey)
	if err != nil {
		t.Fatalf("EncryptSettingSecret failed: %v", err)
	}

	if !IsSecretEncrypted(envelope) {
		t.Errorf("Expected encrypted envelope to start with enc:v1:, got %s", envelope)
	}

	decrypted, err := DecryptSettingSecret(envelope, secretKey)
	if err != nil {
		t.Fatalf("DecryptSettingSecret failed: %v", err)
	}

	if decrypted != plainSecret {
		t.Errorf("Expected decrypted %s, got %s", plainSecret, decrypted)
	}
}

func TestCrypto_SettingSecret_TransparentMigration(t *testing.T) {
	secretKey := "test-settings-secret-key-32bytes!"
	legacyPlainSecret := "my_unencrypted_legacy_password"

	if IsSecretEncrypted(legacyPlainSecret) {
		t.Errorf("Plain text should not be detected as encrypted")
	}

	// Legacy plain text should be passed through safely
	decrypted, err := DecryptSettingSecret(legacyPlainSecret, secretKey)
	if err != nil {
		t.Fatalf("DecryptSettingSecret failed on plaintext fallback: %v", err)
	}

	if decrypted != legacyPlainSecret {
		t.Errorf("Expected transparent pass-through %s, got %s", legacyPlainSecret, decrypted)
	}
}
