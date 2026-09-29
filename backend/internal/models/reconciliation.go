package models

import (
	"time"
)

type ReconciliationStatus string

const (
	ReconciliationStatusActive   ReconciliationStatus = "active"
	ReconciliationStatusReverted ReconciliationStatus = "reverted"
	ReconciliationStatusUpdated  ReconciliationStatus = "updated"
)

// FundReconciliation tracks the lifecycle of fund balance audits (created, updated, reverted, restored)
type FundReconciliation struct {
	ID                 uint                 `gorm:"primaryKey" json:"id"`
	FundID             uint                 `gorm:"not null;index" json:"fund_id"`
	Fund               *Fund                `gorm:"foreignKey:FundID" json:"fund,omitempty"`
	TheoreticalBalance float64              `gorm:"type:numeric(12,2);not null;default:0.00" json:"theoretical_balance"`
	ActualBalance      float64              `gorm:"type:numeric(12,2);not null;default:0.00" json:"actual_balance"`
	Variance           float64              `gorm:"type:numeric(12,2);not null;default:0.00" json:"variance"`
	Notes              string               `gorm:"type:text" json:"notes"`
	CreatedBy          string               `gorm:"type:varchar(100);default:'manager'" json:"created_by"`
	TransactionID      *uint                `gorm:"index" json:"transaction_id,omitempty"`
	Transaction        *Transaction         `gorm:"foreignKey:TransactionID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"transaction,omitempty"`
	Status             ReconciliationStatus `gorm:"type:varchar(30);not null;default:'active';index" json:"status"`
	PreviousActual     *float64             `gorm:"type:numeric(12,2)" json:"previous_actual,omitempty"`
	PreviousVariance   *float64             `gorm:"type:numeric(12,2)" json:"previous_variance,omitempty"`
	CreatedAt          time.Time            `json:"created_at"`
	UpdatedAt          time.Time            `json:"updated_at"`
	RevertedAt         *time.Time           `json:"reverted_at,omitempty"`
}

// UpdateReconcileRequest defines the payload for updating an actual counted balance
type UpdateReconcileRequest struct {
	ActualBalance float64 `json:"actual_balance" binding:"gte=0"`
	Notes         string  `json:"notes"`
}
