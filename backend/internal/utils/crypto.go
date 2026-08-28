package utils

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// ComputeSHA256Checksum serializes data to canonical JSON and computes its SHA-256 hex checksum
func ComputeSHA256Checksum(data interface{}) (string, error) {
	bytes, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal data for checksum: %w", err)
	}
	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:]), nil
}

// ComputeBytesSHA256 computes the SHA-256 hex checksum of raw bytes
func ComputeBytesSHA256(data []byte) string {
	hash := sha256.Sum256(data)
	return hex.EncodeToString(hash[:])
}

// DeriveKeyFromSecret generates a deterministic 32-byte AES-256 key from any secret passphrase
func DeriveKeyFromSecret(secret string) []byte {
	hash := sha256.Sum256([]byte(secret))
	return hash[:]
}

// EncryptAESGCM encrypts plaintext bytes with AES-256-GCM authenticated encryption (AEAD)
func EncryptAESGCM(plaintext []byte, key []byte) (ciphertextBase64 string, nonceBase64 string, err error) {
	if len(key) != 32 {
		return "", "", errors.New("AES-256 key must be exactly 32 bytes")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", fmt.Errorf("failed to create GCM AEAD: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", "", fmt.Errorf("failed to generate random nonce: %w", err)
	}

	// Seal appends ciphertext and authentication tag
	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)

	return base64.StdEncoding.EncodeToString(ciphertext), base64.StdEncoding.EncodeToString(nonce), nil
}

// DecryptAESGCM decrypts base64 ciphertext and nonce using AES-256-GCM authenticated encryption
func DecryptAESGCM(ciphertextBase64 string, nonceBase64 string, key []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-256 key must be exactly 32 bytes")
	}

	ciphertext, err := base64.StdEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 ciphertext: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(nonceBase64)
	if err != nil {
		return nil, fmt.Errorf("invalid base64 nonce: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM AEAD: %w", err)
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce length: expected %d bytes, got %d", gcm.NonceSize(), len(nonce))
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, errors.New("decryption failed or data was tampered with (authentication tag mismatch)")
	}

	return plaintext, nil
}

// GenerateSecureToken creates a cryptographically secure random hex string of specified byte length
func GenerateSecureToken(byteLength int) (string, error) {
	b := make([]byte, byteLength)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// GetSettingsEncryptionKey retrieves the master encryption key from environment
func GetSettingsEncryptionKey() string {
	keys := []string{
		"SETTINGS_ENCRYPTION_KEY",
		"APP_ENCRYPTION_KEY",
		"BACKUP_ENCRYPTION_KEY",
	}
	for _, k := range keys {
		if val := os.Getenv(k); val != "" {
			return val
		}
	}
	// Fallback key for non-production environments
	return "rabbitpos_default_secret_key_change_in_prod_2026"
}

// IsSecretEncrypted checks if a setting value is already stored in enc:v1 format
func IsSecretEncrypted(val string) bool {
	return strings.HasPrefix(strings.TrimSpace(val), "enc:v1:")
}

// EncryptSettingSecret encrypts a plaintext secret into an authenticated AEAD envelope format (enc:v1:<nonce>:<ciphertext>)
func EncryptSettingSecret(plaintext string, secretKey string) (string, error) {
	trimmed := strings.TrimSpace(plaintext)
	if trimmed == "" {
		return "", nil
	}
	if IsSecretEncrypted(trimmed) {
		return trimmed, nil
	}

	key := DeriveKeyFromSecret(secretKey)
	ciphertextB64, nonceB64, err := EncryptAESGCM([]byte(trimmed), key)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("enc:v1:%s:%s", nonceB64, ciphertextB64), nil
}

// DecryptSettingSecret decrypts an AEAD envelope string into plaintext.
// If the input is not encrypted (legacy plain text), it returns the plaintext directly for transparent migration.
func DecryptSettingSecret(envelope string, secretKey string) (string, error) {
	trimmed := strings.TrimSpace(envelope)
	if trimmed == "" {
		return "", nil
	}
	if !IsSecretEncrypted(trimmed) {
		// Plain text fallback (automatic backward compatibility / transparent migration)
		return trimmed, nil
	}

	parts := strings.Split(trimmed, ":")
	if len(parts) != 4 || parts[0] != "enc" || parts[1] != "v1" {
		return "", errors.New("malformed encrypted setting envelope format")
	}

	nonceB64 := parts[2]
	ciphertextB64 := parts[3]
	key := DeriveKeyFromSecret(secretKey)

	plaintextBytes, err := DecryptAESGCM(ciphertextB64, nonceB64, key)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt setting secret: %w", err)
	}

	return string(plaintextBytes), nil
}
