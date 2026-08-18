package models

import (
	"encoding/json"
	"time"
)

type PromoType string

const (
	PromoTypeDiscountAmount  PromoType = "discount_amount"
	PromoTypeDiscountPercent PromoType = "discount_percent"
	PromoTypeGiftItem        PromoType = "gift_item"
)

type PromoScope string

const (
	PromoScopeAll      PromoScope = "all"
	PromoScopeCategory PromoScope = "category"
	PromoScopeProduct  PromoScope = "product"
)

// Promotion represents a store discount or gift rule
type Promotion struct {
	ID                   uint            `gorm:"primaryKey"                                json:"id"`
	Name                 string          `gorm:"type:varchar(150);not null"               json:"name"`
	PromoType            PromoType       `gorm:"type:varchar(50);not null"                json:"promo_type"`
	DiscountValue        float64         `gorm:"type:numeric(15,2);not null;default:0"    json:"discount_value"`
	MinOrderAmount       float64         `gorm:"type:numeric(15,2);not null;default:0"    json:"min_order_amount"`
	MinQuantity          int             `gorm:"not null;default:0"                       json:"min_quantity"`
	Scope                PromoScope      `gorm:"type:varchar(50);not null;default:'all'"  json:"scope"`
	TargetIDs            string          `gorm:"type:jsonb;not null;default:'[]'"         json:"target_ids"`
	GiftProductVariantID *uint           `gorm:"index"                                    json:"gift_product_variant_id,omitempty"`
	GiftVariant          *ProductVariant `gorm:"foreignKey:GiftProductVariantID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"gift_variant,omitempty"`
	StartDate            *time.Time      `gorm:"index"                                    json:"start_date,omitempty"`
	EndDate              *time.Time      `gorm:"index"                                    json:"end_date,omitempty"`
	UsageLimit           int             `gorm:"not null;default:0"                       json:"usage_limit"`
	UsageCount           int             `gorm:"not null;default:0"                       json:"usage_count"`
	IsActive             bool            `gorm:"not null;default:true;index"              json:"is_active"`
	CreatedAt            time.Time       `json:"created_at"`
	UpdatedAt            time.Time       `json:"updated_at"`
}

// GetTargetIDs parses the TargetIDs JSON string into a uint slice
func (p *Promotion) GetTargetIDs() []uint {
	if p.TargetIDs == "" || p.TargetIDs == "null" {
		return []uint{}
	}
	var ids []uint
	if err := json.Unmarshal([]byte(p.TargetIDs), &ids); err != nil {
		return []uint{}
	}
	return ids
}

// SetTargetIDs serializes a uint slice into TargetIDs JSON string
func (p *Promotion) SetTargetIDs(ids []uint) {
	if len(ids) == 0 {
		p.TargetIDs = "[]"
		return
	}
	b, err := json.Marshal(ids)
	if err != nil {
		p.TargetIDs = "[]"
		return
	}
	p.TargetIDs = string(b)
}

// --- DTOs ---

type CreatePromotionRequest struct {
	Name                 string     `json:"name"                    binding:"required,min=1,max=150"`
	PromoType            PromoType  `json:"promo_type"             binding:"required,oneof=discount_amount discount_percent gift_item"`
	DiscountValue        float64    `json:"discount_value"         binding:"gte=0"`
	MinOrderAmount       float64    `json:"min_order_amount"       binding:"gte=0"`
	MinQuantity          int        `json:"min_quantity"           binding:"gte=0"`
	Scope                PromoScope `json:"scope"                  binding:"omitempty,oneof=all category product"`
	TargetIDs            []uint     `json:"target_ids"`
	GiftProductVariantID *uint      `json:"gift_product_variant_id"`
	StartDate            *time.Time `json:"start_date"`
	EndDate              *time.Time `json:"end_date"`
	UsageLimit           int        `json:"usage_limit"            binding:"gte=0"`
	IsActive             *bool      `json:"is_active"`
}

type UpdatePromotionRequest struct {
	Name                 string      `json:"name"                    binding:"omitempty,min=1,max=150"`
	PromoType            *PromoType  `json:"promo_type"             binding:"omitempty,oneof=discount_amount discount_percent gift_item"`
	DiscountValue        *float64    `json:"discount_value"         binding:"omitempty,gte=0"`
	MinOrderAmount       *float64    `json:"min_order_amount"       binding:"omitempty,gte=0"`
	MinQuantity          *int        `json:"min_quantity"           binding:"omitempty,gte=0"`
	Scope                *PromoScope `json:"scope"                  binding:"omitempty,oneof=all category product"`
	TargetIDs            *[]uint     `json:"target_ids"`
	GiftProductVariantID *uint       `json:"gift_product_variant_id"`
	StartDate            *time.Time  `json:"start_date"`
	EndDate              *time.Time  `json:"end_date"`
	UsageLimit           *int        `json:"usage_limit"            binding:"omitempty,gte=0"`
	IsActive             *bool       `json:"is_active"`
}
