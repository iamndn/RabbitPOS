package services

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
)

type AuditService struct {
	db *gorm.DB
}

func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{db: db}
}

var sensitiveMetadataKeys = map[string]bool{
	"password":                           true,
	"password_hash":                      true,
	"new_password":                       true,
	"temp_token":                         true,
	"token":                              true,
	"jwt":                                true,
	"secret":                             true,
	"smtp_password":                      true,
	"google_sheets_service_account_json": true,
	"private_key":                        true,
	"authorization":                      true,
}

// SanitizeAuditMetadata scrubs any sensitive passwords, credentials, tokens or keys from metadata map
func SanitizeAuditMetadata(metadata map[string]interface{}) string {
	if len(metadata) == 0 {
		return "{}"
	}

	sanitized := make(map[string]interface{})
	for k, v := range metadata {
		lowerK := strings.ToLower(k)
		isSensitive := false
		for sk := range sensitiveMetadataKeys {
			if strings.Contains(lowerK, sk) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[k] = "[REDACTED]"
		} else if m, ok := v.(map[string]interface{}); ok {
			sanitized[k] = jsonSanitizeMap(m)
		} else {
			sanitized[k] = v
		}
	}

	b, err := json.Marshal(sanitized)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func jsonSanitizeMap(input map[string]interface{}) map[string]interface{} {
	out := make(map[string]interface{})
	for k, v := range input {
		lowerK := strings.ToLower(k)
		isSensitive := false
		for sk := range sensitiveMetadataKeys {
			if strings.Contains(lowerK, sk) {
				isSensitive = true
				break
			}
		}
		if isSensitive {
			out[k] = "[REDACTED]"
		} else if nested, ok := v.(map[string]interface{}); ok {
			out[k] = jsonSanitizeMap(nested)
		} else {
			out[k] = v
		}
	}
	return out
}

// RecordLog records an audit log entry. Does not block or fail request if db is nil.
func (s *AuditService) RecordLog(
	actorID *uint,
	actorUsername string,
	role string,
	action string,
	resource string,
	resourceID *string,
	status string,
	ip string,
	userAgent string,
	metadata map[string]interface{},
) {
	if s == nil || s.db == nil {
		return
	}

	metaJSON := SanitizeAuditMetadata(metadata)

	logEntry := models.AuditLog{
		ActorID:       actorID,
		ActorUsername: actorUsername,
		Role:          role,
		Action:        action,
		Resource:      resource,
		ResourceID:    resourceID,
		Status:        status,
		IPAddress:     ip,
		UserAgent:     userAgent,
		Metadata:      metaJSON,
		CreatedAt:     time.Now(),
	}

	// Insert in non-blocking goroutine
	go func(entry models.AuditLog) {
		if err := s.db.Create(&entry).Error; err != nil {
			log.Printf("[AUDIT ERROR] Failed to record audit log: %v", err)
		}
	}(logEntry)
}

// RecordLogSync records an audit log synchronously (useful in test assertions and critical transactions)
func (s *AuditService) RecordLogSync(
	actorID *uint,
	actorUsername string,
	role string,
	action string,
	resource string,
	resourceID *string,
	status string,
	ip string,
	userAgent string,
	metadata map[string]interface{},
) error {
	if s == nil || s.db == nil {
		return nil
	}

	metaJSON := SanitizeAuditMetadata(metadata)

	logEntry := models.AuditLog{
		ActorID:       actorID,
		ActorUsername: actorUsername,
		Role:          role,
		Action:        action,
		Resource:      resource,
		ResourceID:    resourceID,
		Status:        status,
		IPAddress:     ip,
		UserAgent:     userAgent,
		Metadata:      metaJSON,
		CreatedAt:     time.Now(),
	}

	return s.db.Create(&logEntry).Error
}
