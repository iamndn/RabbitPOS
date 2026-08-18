package models

import (
	"encoding/json"
	"time"
)

// Topping represents an add-on item available for drinks
// If CategoryID is nil, the topping is considered global (available for all products)
type Topping struct {
	ID         uint      `gorm:"primaryKey"                          json:"id"`
	Name       string    `gorm:"type:varchar(100);not null"          json:"name"`
	Price      float64   `gorm:"type:numeric(15,2);not null;default:0" json:"price"`
	COGS       float64   `gorm:"type:numeric(15,2);not null;default:0" json:"cogs"`
	CategoryID *uint     `gorm:"index"                               json:"category_id"`
	IsActive   bool      `gorm:"not null;default:true"               json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ToppingSnapshot is the denormalized record stored in order_items.selected_toppings JSONB
// It captures the topping state at order time so historical orders remain accurate
type ToppingSnapshot struct {
	ID    uint    `json:"id"`
	Name  string  `json:"name"`
	Price float64 `json:"price"`
}

// MarshalToppingSnapshots serializes a slice of snapshots to JSON string for GORM storage
func MarshalToppingSnapshots(snapshots []ToppingSnapshot) (string, error) {
	if len(snapshots) == 0 {
		return "[]", nil
	}
	b, err := json.Marshal(snapshots)
	if err != nil {
		return "[]", err
	}
	return string(b), nil
}

// UnmarshalToppingSnapshots parses a JSON string into a slice of ToppingSnapshot
func UnmarshalToppingSnapshots(raw string) ([]ToppingSnapshot, error) {
	var snapshots []ToppingSnapshot
	if raw == "" || raw == "null" {
		return []ToppingSnapshot{}, nil
	}
	if err := json.Unmarshal([]byte(raw), &snapshots); err != nil {
		return []ToppingSnapshot{}, err
	}
	return snapshots, nil
}

// --- DTOs ---

type CreateToppingRequest struct {
	Name       string  `json:"name"        binding:"required,min=1,max=100"`
	Price      float64 `json:"price"       binding:"gte=0"`
	COGS       float64 `json:"cogs"`
	CategoryID *uint   `json:"category_id"`
	IsActive   *bool   `json:"is_active"`
}

type UpdateToppingRequest struct {
	Name       string  `json:"name"        binding:"omitempty,min=1,max=100"`
	Price      float64 `json:"price"       binding:"gte=0"`
	COGS       float64 `json:"cogs"`
	CategoryID *uint   `json:"category_id"`
	IsActive   *bool   `json:"is_active"`
}
