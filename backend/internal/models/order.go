package models

import (
	"time"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusCancelled OrderStatus = "cancelled"
)

// Order represents a customer POS transaction
type Order struct {
	ID             uint        `gorm:"primaryKey" json:"id"`
	OrderCode      string      `gorm:"type:varchar(50);not null;uniqueIndex" json:"order_code"`
	Status         OrderStatus `gorm:"type:varchar(20);not null;default:'completed'" json:"status"`
	Subtotal       float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"subtotal"`
	DiscountAmount float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"discount_amount"`
	TotalAmount    float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"total_amount"`
	FundID         uint        `gorm:"not null;index" json:"fund_id"`
	Fund           *Fund       `gorm:"foreignKey:FundID" json:"fund,omitempty"`
	Items          []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	CreatedBy      string      `gorm:"type:varchar(100);default:'cashier'" json:"created_by"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// OrderItem represents an individual line item in an order
type OrderItem struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	OrderID          uint            `gorm:"not null;index" json:"order_id"`
	ProductVariantID uint            `gorm:"not null;index" json:"product_variant_id"`
	Variant          *ProductVariant `gorm:"foreignKey:ProductVariantID" json:"variant,omitempty"`
	Quantity         int             `gorm:"not null;default:1" json:"quantity"`
	UnitPrice        float64         `gorm:"type:numeric(10,2);not null;default:0.00" json:"unit_price"`
	LineTotal        float64         `gorm:"type:numeric(10,2);not null;default:0.00" json:"line_total"`
	Notes            string          `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// Request & Response DTOs

type CreateOrderItemRequest struct {
	ProductVariantID uint    `json:"product_variant_id" binding:"required,gt=0"`
	Quantity         int     `json:"quantity" binding:"required,gt=0"`
	UnitPrice        float64 `json:"unit_price" binding:"gte=0"`
	Notes            string  `json:"notes"`
}

type CreateOrderRequest struct {
	FundID         uint                     `json:"fund_id" binding:"required,gt=0"`
	DiscountAmount float64                  `json:"discount_amount"`
	Items          []CreateOrderItemRequest `json:"items" binding:"required,min=1,dive"`
	CreatedBy      string                   `json:"created_by"`
}

type VietQRResponse struct {
	OrderCode   string  `json:"order_code"`
	BankID      string  `json:"bank_id"`
	AccountNo   string  `json:"account_no"`
	AccountName string  `json:"account_name"`
	Amount      float64 `json:"amount"`
	QrURL       string  `json:"qr_url"`
}
