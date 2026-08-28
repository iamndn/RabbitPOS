package models

import "time"

// RevokedToken stores explicitly revoked JWT unique identifiers (JTIs) on logout
type RevokedToken struct {
	JTI       string    `gorm:"type:varchar(64);primaryKey" json:"jti"`
	UserID    uint      `gorm:"index" json:"user_id"`
	ExpiresAt time.Time `gorm:"index" json:"expires_at"`
	Reason    string    `gorm:"type:varchar(100)" json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}
