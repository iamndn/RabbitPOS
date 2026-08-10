package models

import (
	"time"
)

type TransactionType string

const (
	TransactionTypeInflow  TransactionType = "inflow"
	TransactionTypeOutflow TransactionType = "outflow"
)

type TransactionCategory string

const (
	CategorySale                   TransactionCategory = "sale"
	CategoryIngredientPurchase     TransactionCategory = "ingredient_purchase"
	CategoryUtilityBill            TransactionCategory = "utility_bill"
	CategoryReconciliationVariance TransactionCategory = "reconciliation_variance"
	CategoryOther                  TransactionCategory = "other"
)

// Transaction represents a financial ledger record in the cash flow system
type Transaction struct {
	ID               uint                `gorm:"primaryKey" json:"id"`
	FundID           uint                `gorm:"not null;index" json:"fund_id"`
	Fund             *Fund               `gorm:"foreignKey:FundID" json:"fund,omitempty"`
	TransactionType  TransactionType     `gorm:"type:varchar(20);not null;default:'outflow'" json:"transaction_type"`
	Category         TransactionCategory `gorm:"type:varchar(50);not null;default:'other'" json:"category"`
	Amount           float64             `gorm:"type:numeric(12,2);not null;default:0.00" json:"amount"`
	ReferenceOrderID *uint               `gorm:"index" json:"reference_order_id,omitempty"`
	ReferenceOrder   *Order              `gorm:"foreignKey:ReferenceOrderID" json:"reference_order,omitempty"`
	Description      string              `gorm:"type:text" json:"description"`
	CreatedBy        string              `gorm:"type:varchar(100);default:'system'" json:"created_by"`
	CreatedAt        time.Time           `json:"created_at"`
}

// Request & Response DTOs

type CreateTransactionRequest struct {
	FundID          uint                `json:"fund_id" binding:"required"`
	TransactionType TransactionType     `json:"transaction_type" binding:"required"`
	Category        TransactionCategory `json:"category" binding:"required"`
	Amount          float64             `json:"amount" binding:"required,gt=0"`
	Description     string              `json:"description"`
	CreatedBy       string              `json:"created_by"`
}

type ReconcileFundRequest struct {
	ActualBalance float64 `json:"actual_balance" binding:"gte=0"`
	Notes         string  `json:"notes"`
	CreatedBy     string  `json:"created_by"`
}

type FundBalanceResponse struct {
	FundID             uint       `json:"fund_id"`
	FundName           string     `json:"fund_name"`
	TheoreticalBalance float64    `json:"theoretical_balance"`
	TotalInflows       float64    `json:"total_inflows"`
	TotalOutflows      float64    `json:"total_outflows"`
	LastTransactionAt  *time.Time `json:"last_transaction_at"`
}
