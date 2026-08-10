package models

import (
	"time"
)

type FundType string

const (
	FundTypeCash    FundType = "cash"
	FundTypeBank    FundType = "bank"
	FundTypeEWallet FundType = "e-wallet"
)

// Fund represents a cash drawer or bank account payment repository
type Fund struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Name           string    `gorm:"type:varchar(100);not null" json:"name"`
	FundType       FundType  `gorm:"type:varchar(20);not null;default:'cash'" json:"fund_type"`
	CurrentBalance float64   `gorm:"type:numeric(12,2);not null;default:0.00" json:"current_balance"`
	IsActive       bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}
