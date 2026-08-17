package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FundHandler struct {
	db *gorm.DB
}

func NewFundHandler(db *gorm.DB) *FundHandler {
	return &FundHandler{db: db}
}

// ListFunds returns active payment funds (Cash Drawer, Bank Accounts, E-Wallets)
func (h *FundHandler) ListFunds(c *gin.Context) {
	funds := make([]models.Fund, 0)
	if err := h.db.Where("is_active = ?", true).Order("id asc").Find(&funds).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve funds: "+err.Error())
		return
	}

	// Fallback response if DB has no funds seeded yet
	if len(funds) == 0 {
		funds = []models.Fund{
			{ID: 1, Name: "Cash Drawer", FundType: models.FundTypeCash, CurrentBalance: 0, IsActive: true},
			{ID: 2, Name: "MBBank Account", FundType: models.FundTypeBank, CurrentBalance: 0, IsActive: true},
		}
	}

	models.SendSuccess(c, http.StatusOK, funds, "Funds retrieved successfully")
}

// GetFundBalance returns theoretical balance and transaction totals for a target fund
func (h *FundHandler) GetFundBalance(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid fund ID")
		return
	}

	var fund models.Fund
	if err := h.db.First(&fund, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Fund not found")
			return
		}
		models.SendInternalError(c, "Failed to retrieve fund details")
		return
	}

	var totalInflows float64
	var totalOutflows float64

	h.db.Model(&models.Transaction{}).
		Where("fund_id = ? AND transaction_type = ?", id, models.TransactionTypeInflow).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalInflows)

	h.db.Model(&models.Transaction{}).
		Where("fund_id = ? AND transaction_type = ?", id, models.TransactionTypeOutflow).
		Select("COALESCE(SUM(amount), 0)").Scan(&totalOutflows)

	var lastTx models.Transaction
	var lastTxTime *time.Time
	if err := h.db.Where("fund_id = ?", id).Order("created_at desc").First(&lastTx).Error; err == nil {
		lastTxTime = &lastTx.CreatedAt
	}

	resp := models.FundBalanceResponse{
		FundID:             fund.ID,
		FundName:           fund.Name,
		TheoreticalBalance: fund.CurrentBalance,
		TotalInflows:       totalInflows,
		TotalOutflows:      totalOutflows,
		LastTransactionAt:  lastTxTime,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Fund balance details retrieved successfully")
}

// ReconcileFund compares actual counted balance against theoretical balance and logs variance
func (h *FundHandler) ReconcileFund(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid fund ID")
		return
	}

	var fund models.Fund
	if err := h.db.First(&fund, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Fund not found")
			return
		}
		models.SendInternalError(c, "Failed to retrieve fund details")
		return
	}

	var req models.ReconcileFundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	theoreticalBalance := fund.CurrentBalance
	actualBalance := req.ActualBalance
	variance := actualBalance - theoreticalBalance

	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = "manager"
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// Log variance transaction if there is a discrepancy
		if variance != 0 {
			var txType models.TransactionType
			var txAmount float64
			var desc string

			if variance > 0 {
				txType = models.TransactionTypeInflow
				txAmount = variance
				desc = fmt.Sprintf("Fund Reconciliation Surplus Variance (+%.2f). %s", variance, req.Notes)
			} else {
				txType = models.TransactionTypeOutflow
				txAmount = -variance
				desc = fmt.Sprintf("Fund Reconciliation Deficit Variance (-%.2f). %s", -variance, req.Notes)
			}

			reconcileTx := models.Transaction{
				FundID:          fund.ID,
				TransactionType: txType,
				Category:        models.CategoryReconciliationVariance,
				Amount:          txAmount,
				Description:     desc,
				CreatedBy:       createdBy,
			}

			if err := tx.Create(&reconcileTx).Error; err != nil {
				return err
			}
		}

		// Update Fund Current Balance to match Actual Count
		if err := tx.Model(&fund).Update("current_balance", actualBalance).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to reconcile fund balance: "+err.Error())
		return
	}

	// Fetch updated fund
	h.db.First(&fund, id)

	models.SendSuccess(c, http.StatusOK, gin.H{
		"fund":                fund,
		"theoretical_balance": theoreticalBalance,
		"actual_balance":      actualBalance,
		"variance":            variance,
	}, "Fund balance reconciled successfully")
}
