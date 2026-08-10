package models

import (
	"time"
)

// Category represents a product category in the POS catalog domain
type Category struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	DisplayOrder int       `gorm:"default:0" json:"display_order"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CreateCategoryRequest defines body structure for category creation
type CreateCategoryRequest struct {
	Name         string `json:"name" binding:"required"`
	DisplayOrder int    `json:"display_order"`
	IsActive     *bool  `json:"is_active"`
}
