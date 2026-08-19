package models

import (
	"time"
)

// ProductTag represents special product badges
type ProductTag string

const (
	TagBestSeller ProductTag = "best_seller"
	TagNew        ProductTag = "new"
	TagFeatured   ProductTag = "featured"
	TagSuspended  ProductTag = "suspended"
	TagComingSoon ProductTag = "coming_soon"
	TagNone       ProductTag = "none"
)

// Product represents a item in the POS catalog
type Product struct {
	ID            uint             `gorm:"primaryKey" json:"id"`
	CategoryID    uint             `gorm:"not null;index" json:"category_id"`
	Category      *Category        `gorm:"foreignKey:CategoryID;constraint:OnDelete:CASCADE" json:"category,omitempty"`
	Name          string           `gorm:"type:varchar(150);not null" json:"name"`
	Description   string           `gorm:"type:text" json:"description"`
	ImageURL      string           `gorm:"type:text" json:"image_url"`
	Tag           ProductTag       `gorm:"type:varchar(20);default:'none'" json:"tag"`
	IsActive      bool             `gorm:"default:true;index" json:"is_active"`
	Variants      []ProductVariant `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"variants,omitempty"`
	VariantGroups []VariantGroup   `gorm:"foreignKey:ProductID;constraint:OnDelete:CASCADE" json:"variant_groups,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

// ProductVariant represents specific purchasing option (e.g. Size M, Size L)
type ProductVariant struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ProductID   uint      `gorm:"not null;index" json:"product_id"`
	VariantName string    `gorm:"type:varchar(100);not null" json:"variant_name"`
	CogsPrice   float64   `gorm:"type:numeric(10,2);not null;default:0.00" json:"cogs_price"`
	RetailPrice float64   `gorm:"type:numeric(10,2);not null;default:0.00" json:"retail_price"`
	SKU         string    `gorm:"type:varchar(50);index" json:"sku"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// VariantGroup represents structured modifiers (e.g. Size, Topping)
type VariantGroup struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	ProductID     uint      `gorm:"not null;index" json:"product_id"`
	GroupName     string    `gorm:"type:varchar(100);not null" json:"group_name"`
	SelectionType string    `gorm:"type:varchar(20);default:'single'" json:"selection_type"` // 'single' or 'multiple'
	IsRequired    bool      `gorm:"default:false" json:"is_required"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Request Payload DTOs

type CreateProductRequest struct {
	CategoryID  uint                   `json:"category_id" binding:"required"`
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	ImageURL    string                 `json:"image_url"`
	Tag         ProductTag             `json:"tag"`
	IsActive    *bool                  `json:"is_active"`
	Variants    []CreateVariantRequest `json:"variants"`
}

type UpdateProductRequest struct {
	CategoryID  *uint       `json:"category_id"`
	Name        *string     `json:"name"`
	Description *string     `json:"description"`
	ImageURL    *string     `json:"image_url"`
	Tag         *ProductTag `json:"tag"`
	IsActive    *bool       `json:"is_active"`
}

type CreateVariantRequest struct {
	VariantName string  `json:"variant_name" binding:"required"`
	CogsPrice   float64 `json:"cogs_price"`
	RetailPrice float64 `json:"retail_price"`
	SKU         string  `json:"sku"`
	IsActive    *bool   `json:"is_active"`
}

type UpdateVariantRequest struct {
	VariantName *string  `json:"variant_name"`
	CogsPrice   *float64 `json:"cogs_price"`
	RetailPrice *float64 `json:"retail_price"`
	SKU         *string  `json:"sku"`
	IsActive    *bool    `json:"is_active"`
}
