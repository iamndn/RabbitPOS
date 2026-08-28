package models

import "time"

// AuditLog records security-critical actions and administrative modifications across RabbitPOS
type AuditLog struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ActorID       *uint     `gorm:"index" json:"actor_id,omitempty"`
	ActorUsername string    `gorm:"type:varchar(100);not null;index" json:"actor_username"`
	Role          string    `gorm:"type:varchar(50);not null" json:"role"`
	Action        string    `gorm:"type:varchar(100);not null;index" json:"action"`
	Resource      string    `gorm:"type:varchar(100);not null;index" json:"resource"`
	ResourceID    *string   `gorm:"type:varchar(100);index" json:"resource_id,omitempty"`
	Status        string    `gorm:"type:varchar(20);not null;default:'success'" json:"status"`
	IPAddress     string    `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent     string    `gorm:"type:varchar(255)" json:"user_agent"`
	Metadata      string    `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	CreatedAt     time.Time `gorm:"index" json:"created_at"`
}
