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
	CategorySale                   TransactionCategory = "Doanh thu bán hàng POS"
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
	// CreatedBy is kept for backward compatibility; prefer CashierName for new code
	CreatedBy   string `gorm:"type:varchar(100);default:'system'" json:"created_by"`
	CashierID   *uint  `gorm:"index" json:"cashier_id,omitempty"`
	CashierName string `gorm:"type:varchar(100);default:''" json:"cashier_name"`
	CreatedAt   time.Time `json:"created_at"`
	// PurchaseItems contains itemized inventory purchase items if logged with this transaction
	PurchaseItems []PurchaseItem `gorm:"foreignKey:TransactionID;constraint:OnDelete:CASCADE" json:"purchase_items,omitempty"`
}

// Request & Response DTOs

type CreateTransactionRequest struct {
	FundID          uint                `json:"fund_id" binding:"required"`
	TransactionType TransactionType     `json:"transaction_type" binding:"required"`
	Category        TransactionCategory `json:"category" binding:"required"`
	Amount          float64             `json:"amount" binding:"required,gt=0"`
	Description     string              `json:"description"`
	// CreatedBy is optional; will be overridden by JWT context if available
	CreatedBy string `json:"created_by"`
	// CreatedAt is an optional custom transaction timestamp (e.g. for backfilling past transactions)
	CreatedAt *time.Time `json:"created_at"`
	// PurchaseItems is an optional list of itemized ingredient/packaging purchases
	PurchaseItems []PurchaseItemInput `json:"purchase_items,omitempty"`
}

type UpdateTransactionRequest struct {
	FundID          uint                `json:"fund_id" binding:"required"`
	TransactionType TransactionType     `json:"transaction_type" binding:"required,oneof=inflow outflow"`
	Category        TransactionCategory `json:"category" binding:"required"`
	Amount          float64             `json:"amount" binding:"required,gt=0"`
	Description     string              `json:"description"`
	// CreatedAt is an optional custom transaction timestamp
	CreatedAt *time.Time `json:"created_at"`
	// PurchaseItems is an optional list of itemized ingredient/packaging purchases
	PurchaseItems *[]PurchaseItemInput `json:"purchase_items,omitempty"`
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

// CashierShiftSummary contains financial totals for a specific cashier's shift
type CashierShiftSummary struct {
	CashierName   string     `json:"cashier_name"`
	Date          string     `json:"date"`
	TotalInflows  float64    `json:"total_inflows"`
	TotalOutflows float64    `json:"total_outflows"`
	NetCash       float64    `json:"net_cash"`
	OrderCount    int64      `json:"order_count"`
	StartTime     *time.Time `json:"start_time"`
	EndTime       *time.Time `json:"end_time"`
}
