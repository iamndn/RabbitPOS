package models

import (
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
