package handlers

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TransactionHandler struct {
	db *gorm.DB
}

func NewTransactionHandler(db *gorm.DB) *TransactionHandler {
	return &TransactionHandler{db: db}
}

// ListTransactions retrieves transaction history with filters
func (h *TransactionHandler) ListTransactions(c *gin.Context) {
	query := h.db.Model(&models.Transaction{}).Preload("Fund").Preload("ReferenceOrder")

	if fundIDStr := c.Query("fund_id"); fundIDStr != "" {
		if fundID, err := strconv.ParseUint(fundIDStr, 10, 32); err == nil {
			query = query.Where("fund_id = ?", fundID)
		}
	}

	if txType := c.Query("transaction_type"); txType != "" {
		query = query.Where("transaction_type = ?", txType)
	}

	if category := c.Query("category"); category != "" {
		query = query.Where("category = ?", category)
	}

	transactions := make([]models.Transaction, 0)
	if err := query.Order("created_at desc").Find(&transactions).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve transactions: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, transactions, "Transactions retrieved successfully")
}

// CreateTransaction logs a manual inflow or outflow expense and updates target fund balance
func (h *TransactionHandler) CreateTransaction(c *gin.Context) {
	var req models.CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	var fund models.Fund
	if err := h.db.First(&fund, req.FundID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusBadRequest, "Invalid fund ID: Fund does not exist")
			return
		}
		models.SendInternalError(c, "Failed to verify target fund")
		return
	}

	// Extract cashier identity from JWT context for attribution
	cashierName := ""
	var cashierIDPtr *uint
	if usernameVal, ok := c.Get("username"); ok {
		if uname, ok := usernameVal.(string); ok {
			cashierName = uname
		}
	}
	if userIDVal, ok := c.Get("user_id"); ok {
		if uid, ok := userIDVal.(uint); ok {
			cashierIDPtr = &uid
		}
	}

	createdBy := req.CreatedBy
	if createdBy == "" {
		createdBy = cashierName
	}
	if createdBy == "" {
		createdBy = "manager"
	}

	transaction := models.Transaction{
		FundID:          req.FundID,
		TransactionType: req.TransactionType,
		Category:        req.Category,
		Amount:          req.Amount,
		Description:     req.Description,
		CreatedBy:       createdBy,
		CashierID:       cashierIDPtr,
		CashierName:     cashierName,
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Create Transaction record
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		// 2. Adjust Fund Balance
		if req.TransactionType == models.TransactionTypeInflow {
			if err := tx.Model(&fund).Update("current_balance", gorm.Expr("current_balance + ?", req.Amount)).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&fund).Update("current_balance", gorm.Expr("current_balance - ?", req.Amount)).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to record transaction: "+err.Error())
		return
	}

	h.db.Preload("Fund").First(&transaction, transaction.ID)

	models.SendSuccess(c, http.StatusCreated, transaction, "Transaction logged successfully")
}

// UpdateTransaction updates an existing manual transaction and adjusts fund balances accordingly
func (h *TransactionHandler) UpdateTransaction(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	var existingTx models.Transaction
	if err := h.db.First(&existingTx, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "Transaction not found")
			return
		}
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	// Guard: Do not allow editing transactions linked to sales orders or reconciliation variances
	if existingTx.ReferenceOrderID != nil {
		models.SendError(c, http.StatusForbidden, "Cannot edit transactions linked to sales orders")
		return
	}
	if existingTx.Category == models.CategoryReconciliationVariance {
		models.SendError(c, http.StatusForbidden, "Cannot edit balance audit reconciliation transactions")
		return
	}

	var req models.UpdateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	var targetFund models.Fund
	if err := h.db.First(&targetFund, req.FundID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusBadRequest, "Target fund not found")
			return
		}
		models.SendInternalError(c, "Failed to verify target fund")
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Revert effect of old transaction on the old fund
		if existingTx.TransactionType == models.TransactionTypeInflow {
			if err := tx.Model(&models.Fund{}).Where("id = ?", existingTx.FundID).
				Update("current_balance", gorm.Expr("current_balance - ?", existingTx.Amount)).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&models.Fund{}).Where("id = ?", existingTx.FundID).
				Update("current_balance", gorm.Expr("current_balance + ?", existingTx.Amount)).Error; err != nil {
				return err
			}
		}

		// 2. Apply effect of new transaction on the new fund
		if req.TransactionType == models.TransactionTypeInflow {
			if err := tx.Model(&models.Fund{}).Where("id = ?", req.FundID).
				Update("current_balance", gorm.Expr("current_balance + ?", req.Amount)).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&models.Fund{}).Where("id = ?", req.FundID).
				Update("current_balance", gorm.Expr("current_balance - ?", req.Amount)).Error; err != nil {
				return err
			}
		}

		// 3. Update the transaction record
		existingTx.FundID = req.FundID
		existingTx.TransactionType = req.TransactionType
		existingTx.Category = req.Category
		existingTx.Amount = req.Amount
		existingTx.Description = req.Description

		if err := tx.Save(&existingTx).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to update transaction: "+err.Error())
		return
	}

	h.db.Preload("Fund").First(&existingTx, existingTx.ID)
	models.SendSuccess(c, http.StatusOK, existingTx, "Transaction updated successfully")
}

// DeleteTransaction deletes an existing manual transaction and reverts fund balance
func (h *TransactionHandler) DeleteTransaction(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid transaction ID")
		return
	}

	var existingTx models.Transaction
	if err := h.db.First(&existingTx, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "Transaction not found")
			return
		}
		models.SendInternalError(c, "Database query error: "+err.Error())
		return
	}

	// Guard: Do not allow deleting transactions linked to sales orders or reconciliation variances
	if existingTx.ReferenceOrderID != nil {
		models.SendError(c, http.StatusForbidden, "Cannot delete transactions linked to sales orders")
		return
	}
	if existingTx.Category == models.CategoryReconciliationVariance {
		models.SendError(c, http.StatusForbidden, "Cannot delete balance audit reconciliation transactions")
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Revert effect of the transaction on the fund
		if existingTx.TransactionType == models.TransactionTypeInflow {
			if err := tx.Model(&models.Fund{}).Where("id = ?", existingTx.FundID).
				Update("current_balance", gorm.Expr("current_balance - ?", existingTx.Amount)).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&models.Fund{}).Where("id = ?", existingTx.FundID).
				Update("current_balance", gorm.Expr("current_balance + ?", existingTx.Amount)).Error; err != nil {
				return err
			}
		}

		// 2. Delete the transaction record
		if err := tx.Delete(&existingTx).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to delete transaction: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"id": id}, "Transaction deleted successfully")
}

// GetCategoryBreakdown computes grouped transaction metrics by expense/inflow category
func (h *TransactionHandler) GetCategoryBreakdown(c *gin.Context) {
	txType := strings.ToLower(c.DefaultQuery("type", "outflow"))
	if txType != "inflow" && txType != "outflow" {
		txType = "outflow"
	}

	startTime, endTime, _, _, _, fromStr, toStr := parseAnalyticsPeriod(c)

	type CategoryRaw struct {
		Category    string
		TotalAmount float64
		Count       int64
	}

	var rawCategories []CategoryRaw
	query := `
		SELECT 
			category, 
			COALESCE(SUM(amount), 0) as total_amount, 
			COUNT(id) as count 
		FROM transactions 
		WHERE transaction_type = ? AND created_at BETWEEN ? AND ?
		GROUP BY category 
		ORDER BY total_amount DESC
	`

	if err := h.db.Raw(query, txType, startTime, endTime).Scan(&rawCategories).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve category breakdown: "+err.Error())
		return
	}

	var totalAmount float64
	var totalCount int64
	for _, rc := range rawCategories {
		totalAmount += rc.TotalAmount
		totalCount += rc.Count
	}

	categoryLabels := map[string]string{
		"ingredient_purchase":     "Mua nguyên liệu (Sữa, Cà phê, Đá)",
		"utility_bill":            "Chi phí vận hành (Điện, Nước, Net)",
		"sale":                    "Doanh thu bán hàng POS",
		"reconciliation_variance": "Chênh lệch đối soát két",
		"other":                   "Chi phí khác",
	}

	categories := make([]models.CategoryBreakdownItem, 0)
	for _, rc := range rawCategories {
		var pct float64 = 0
		if totalAmount > 0 {
			pct = math.Round((rc.TotalAmount/totalAmount)*1000) / 10
		}
		label, ok := categoryLabels[rc.Category]
		if !ok {
			label = strings.ReplaceAll(rc.Category, "_", " ")
		}

		categories = append(categories, models.CategoryBreakdownItem{
			Category:      rc.Category,
			CategoryLabel: label,
			TotalAmount:   rc.TotalAmount,
			Percentage:    pct,
			Count:         rc.Count,
		})
	}

	response := models.CategoryBreakdownResponse{
		TransactionType: txType,
		TotalAmount:     totalAmount,
		TotalCount:      totalCount,
		From:            fromStr,
		To:              toStr,
		Categories:      categories,
	}

	models.SendSuccess(c, http.StatusOK, response, "Category breakdown retrieved successfully")
}
