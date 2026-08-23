package models

import "time"

// TransactionCategoryItem represents a category for categorizing financial inflows and outflows
type TransactionCategoryItem struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"type:varchar(100);not null" json:"name"`
	Type      string    `gorm:"type:varchar(20);not null;default:'outflow';index" json:"type"` // outflow, inflow, both
	Code      string    `gorm:"type:varchar(50)" json:"code"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	IsSystem  bool      `gorm:"default:false" json:"is_system"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName specifies the table name for TransactionCategoryItem
func (TransactionCategoryItem) TableName() string {
	return "transaction_categories"
}

// CreateTransactionCategoryRequest represents the payload to create a new category
type CreateTransactionCategoryRequest struct {
	Name      string `json:"name" binding:"required"`
	Type      string `json:"type" binding:"required,oneof=outflow inflow both"`
	Code      string `json:"code"`
	IsDefault *bool  `json:"is_default"`
}

// UpdateTransactionCategoryRequest represents the payload to edit an existing category
type UpdateTransactionCategoryRequest struct {
	Name      string `json:"name" binding:"required"`
	Type      string `json:"type" binding:"required,oneof=outflow inflow both"`
	IsDefault *bool  `json:"is_default"`
}
