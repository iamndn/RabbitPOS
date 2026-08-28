package models

import "time"

type IdempotencyStatus string

const (
	IdempotencyStatusProcessing IdempotencyStatus = "processing"
	IdempotencyStatusCompleted  IdempotencyStatus = "completed"
	IdempotencyStatusFailed     IdempotencyStatus = "failed"
)

// IdempotencyRecord stores processed API requests to guarantee exactly-once execution semantics
type IdempotencyRecord struct {
	Key          string            `gorm:"type:varchar(128);primaryKey" json:"key"`
	RequestHash  string            `gorm:"type:varchar(64);not null;index" json:"request_hash"`
	ResourceType string            `gorm:"type:varchar(50);not null;default:'order'" json:"resource_type"`
	ResourceID   *uint             `gorm:"index" json:"resource_id,omitempty"`
	Status       IdempotencyStatus `gorm:"type:varchar(20);not null;default:'processing';index" json:"status"`
	ResponseCode int               `json:"response_code"`
	ResponseBody string            `gorm:"type:text" json:"response_body"`
	CreatedAt    time.Time         `json:"created_at"`
	ExpiresAt    time.Time         `gorm:"index" json:"expires_at"`
}
