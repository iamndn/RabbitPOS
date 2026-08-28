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

// Order represents a customer POS transaction with server-authoritative financials & audit trail
type Order struct {
	ID                  uint        `gorm:"primaryKey" json:"id"`
	OrderCode           string      `gorm:"type:varchar(50);not null;uniqueIndex" json:"order_code"`
	Status              OrderStatus `gorm:"type:varchar(30);not null;default:'completed';index" json:"status"`
	Subtotal            float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"subtotal"`
	DiscountAmount      float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"discount_amount"`
	ManualDiscount      float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"manual_discount"`
	PromotionID         *uint       `gorm:"index" json:"promotion_id,omitempty"`
	Promotion           *Promotion  `gorm:"foreignKey:PromotionID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL" json:"promotion,omitempty"`
	PromotionDiscount   float64     `gorm:"type:numeric(15,2);not null;default:0.00" json:"promotion_discount"`
	ShippingFee         float64     `gorm:"type:numeric(15,2);not null;default:0.00" json:"shipping_fee"`
	PlatformFeeDiscount float64     `gorm:"type:numeric(15,2);not null;default:0.00" json:"platform_fee_discount"`
	Surcharge           float64     `gorm:"type:numeric(15,2);not null;default:0.00" json:"surcharge"`
	TotalAmount         float64     `gorm:"type:numeric(12,2);not null;default:0.00" json:"total_amount"`
	FundID              uint        `gorm:"not null;index" json:"fund_id"`
	Fund                *Fund       `gorm:"foreignKey:FundID" json:"fund,omitempty"`
	Items               []OrderItem `gorm:"foreignKey:OrderID;constraint:OnDelete:CASCADE" json:"items,omitempty"`
	CreatedBy           string      `gorm:"type:varchar(100);default:'cashier'" json:"created_by"`
	CashierID           *uint       `gorm:"index" json:"cashier_id,omitempty"`
	CashierName         string      `gorm:"type:varchar(100);default:''" json:"cashier_name"`
	CancelReason        string      `gorm:"type:text" json:"cancel_reason,omitempty"`
	CancelledAt         *time.Time  `json:"cancelled_at,omitempty"`
	Note                *string     `gorm:"type:text" json:"note,omitempty"`

	// Price Override & Admin Audit Trail Fields
	IsPriceOverridden bool       `gorm:"default:false;index" json:"is_price_overridden"`
	OverrideReason    string     `gorm:"type:text" json:"override_reason,omitempty"`
	OverriddenByID    *uint      `gorm:"index" json:"overridden_by_id,omitempty"`
	OverriddenByName  string     `gorm:"type:varchar(100)" json:"overridden_by_name,omitempty"`
	OverriddenAt      *time.Time `json:"overridden_at,omitempty"`

	// Idempotency tracking
	IdempotencyKey *string `gorm:"type:varchar(128);index" json:"idempotency_key,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// OrderItem represents an individual line item in an order
type OrderItem struct {
	ID                uint            `gorm:"primaryKey" json:"id"`
	OrderID           uint            `gorm:"not null;index" json:"order_id"`
	ProductVariantID  uint            `gorm:"not null;index" json:"product_variant_id"`
	Variant           *ProductVariant `gorm:"foreignKey:ProductVariantID" json:"variant,omitempty"`
	Quantity          int             `gorm:"not null;default:1" json:"quantity"`
	UnitPrice         float64         `gorm:"type:numeric(10,2);not null;default:0.00" json:"unit_price"`
	OriginalUnitPrice float64         `gorm:"type:numeric(10,2);not null;default:0.00" json:"original_unit_price"`
	LineTotal         float64         `gorm:"type:numeric(10,2);not null;default:0.00" json:"line_total"`
	SelectedToppings  string          `gorm:"type:jsonb;not null;default:'[]'" json:"selected_toppings"`
	ToppingsPrice     float64         `gorm:"type:numeric(15,2);not null;default:0" json:"toppings_price"`
	Notes             string          `gorm:"type:text" json:"notes"`
	IsPriceOverridden bool            `gorm:"default:false" json:"is_price_overridden"`
	OverrideReason    string          `gorm:"type:text" json:"override_reason,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// --- Request & Response DTOs ---

// CreateOrderItemRequest defines client input for an individual order item
type CreateOrderItemRequest struct {
	ProductVariantID uint   `json:"product_variant_id" binding:"required,gt=0"`
	Quantity         int    `json:"quantity" binding:"required,gt=0"`
	ToppingIDs       []uint `json:"topping_ids,omitempty"`
	Notes            string `json:"notes,omitempty"`
	IsGift           bool   `json:"is_gift,omitempty"`

	// Admin Override Fields (Ignored / Forbidden if requester is not admin)
	PriceOverride  *float64 `json:"price_override,omitempty"`
	OverrideReason string   `json:"override_reason,omitempty"`

	// Backward Compatibility Fields (Ignored by server calculations; recalculated from DB)
	UnitPrice        float64           `json:"unit_price,omitempty"`
	LineTotal        float64           `json:"line_total,omitempty"`
	SelectedToppings []ToppingSnapshot `json:"selected_toppings,omitempty"`
	ToppingsPrice    float64           `json:"toppings_price,omitempty"`
}

// CreateOrderRequest defines client input for creating a new POS order
type CreateOrderRequest struct {
	IdempotencyKey string                   `json:"idempotency_key,omitempty"`
	FundID         uint                     `json:"fund_id" binding:"required,gt=0"`
	Items          []CreateOrderItemRequest `json:"items" binding:"required,min=1,dive"`
	PromotionID    *uint                    `json:"promotion_id,omitempty"`
	Note           string                   `json:"note,omitempty"`

	// Admin Override & Backdating Fields (Forbidden if requester is not admin)
	ManualDiscount *float64   `json:"manual_discount,omitempty"`
	ShippingFee    *float64   `json:"shipping_fee,omitempty"`
	Surcharge      *float64   `json:"surcharge,omitempty"`
	OverrideReason string     `json:"override_reason,omitempty"`
	CreatedAt      *time.Time `json:"created_at,omitempty"` // For backdating past orders (Admin only)

	// Backward Compatibility Fields (Ignored by server calculations; recalculated from DB)
	DiscountAmount      float64 `json:"discount_amount,omitempty"`
	PromotionDiscount   float64 `json:"promotion_discount,omitempty"`
	PlatformFeeDiscount float64 `json:"platform_fee_discount,omitempty"`
	TotalAmount         float64 `json:"total_amount,omitempty"`
	Subtotal            float64 `json:"subtotal,omitempty"`
	CreatedBy           string  `json:"created_by,omitempty"`
}

type CancelOrderRequest struct {
	Refund       bool   `json:"refund"`
	CancelReason string `json:"cancel_reason" binding:"required,min=1"`
}

type VietQRResponse struct {
	OrderCode   string  `json:"order_code"`
	BankID      string  `json:"bank_id"`
	AccountNo   string  `json:"account_no"`
	AccountName string  `json:"account_name"`
	Amount      float64 `json:"amount"`
	QrURL       string  `json:"qr_url"`
}
