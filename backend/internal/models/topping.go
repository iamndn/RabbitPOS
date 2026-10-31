package models

import (
	"encoding/json"
	"time"
)

// Topping represents an add-on item available for drinks.
// Category scope is stored in the topping_categories join table (many-to-many):
// no linked categories = global topping (available for all products).
// CategoryID is a legacy mirror of the first linked category kept for backward compatibility.
type Topping struct {
	ID         uint      `gorm:"primaryKey"                          json:"id"`
	StoreID    uint      `gorm:"not null;default:1"                  json:"store_id"`
	Name       string    `gorm:"type:varchar(100);not null"          json:"name"`
	Price      float64   `gorm:"type:numeric(15,2);not null;default:0" json:"price"`
	COGS       float64   `gorm:"type:numeric(15,2);not null;default:0" json:"cogs"`
	CategoryID *uint     `gorm:"index"                               json:"category_id"`
	Category   *Category `gorm:"foreignKey:CategoryID"               json:"category,omitempty"`
	// CategoryIDs lists every category this topping applies to (empty = all categories).
	// Populated from topping_categories; never persisted on the toppings table.
	CategoryIDs  []uint    `gorm:"-"                                   json:"category_ids"`
	DisplayOrder int       `gorm:"default:0;index"                     json:"display_order"`
	IsActive     bool      `gorm:"not null;default:true"               json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ToppingCategory is the join row linking a topping to a category it applies to.
type ToppingCategory struct {
	ToppingID  uint `gorm:"primaryKey;autoIncrement:false" json:"topping_id"`
	CategoryID uint `gorm:"primaryKey;autoIncrement:false;index" json:"category_id"`
}

func (ToppingCategory) TableName() string { return "topping_categories" }

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

// ResolveCategoryIDs returns the de-duplicated category scope requested by a create/update payload.
// CategoryIDs takes precedence; otherwise the legacy single CategoryID is used. Empty = global.
func ResolveCategoryIDs(ids *[]uint, legacy *uint) []uint {
	var src []uint
	if ids != nil {
		src = *ids
	} else if legacy != nil {
		src = []uint{*legacy}
	}
	seen := make(map[uint]struct{}, len(src))
	out := make([]uint, 0, len(src))
	for _, id := range src {
		if id == 0 {
			continue
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// --- DTOs ---

type CreateToppingRequest struct {
	Name       string  `json:"name"          binding:"required,min=1,max=100"`
	Price      float64 `json:"price"         binding:"gte=0"`
	COGS       float64 `json:"cogs"`
	CategoryID *uint   `json:"category_id"`
	// CategoryIDs (preferred) scopes the topping to several categories; empty/omitted CategoryID = global.
	CategoryIDs  *[]uint `json:"category_ids"`
	DisplayOrder int     `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}

type UpdateToppingRequest struct {
	Name       string  `json:"name"          binding:"omitempty,min=1,max=100"`
	Price      float64 `json:"price"         binding:"gte=0"`
	COGS       float64 `json:"cogs"`
	CategoryID *uint   `json:"category_id"`
	// CategoryIDs (preferred) scopes the topping to several categories. When omitted, the legacy
	// CategoryID is used (nil = global).
	CategoryIDs  *[]uint `json:"category_ids"`
	DisplayOrder *int    `json:"display_order"`
	IsActive     *bool   `json:"is_active"`
}
