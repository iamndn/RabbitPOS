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
