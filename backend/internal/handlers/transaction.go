package handlers

import (
	"net/http"
	"strconv"

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
