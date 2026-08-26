package handlers

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type TransactionHandler struct {
	db            *gorm.DB
	sheetsSyncSvc *services.SheetsSyncService
	fundCache     *cache.TTLCache
}

func NewTransactionHandler(db *gorm.DB, sheetsSyncSvc *services.SheetsSyncService, fundCache *cache.TTLCache) *TransactionHandler {
	return &TransactionHandler{db: db, sheetsSyncSvc: sheetsSyncSvc, fundCache: fundCache}
}

// ListTransactions retrieves transaction history with filters and pagination support
func (h *TransactionHandler) ListTransactions(c *gin.Context) {
	query := h.db.Model(&models.Transaction{}).
		Preload("Fund").
		Preload("ReferenceOrder").
		Preload("PurchaseItems.Ingredient")

	if fundIDStr := c.Query("fund_id"); fundIDStr != "" {
		if fundID, err := strconv.ParseUint(fundIDStr, 10, 32); err == nil {
			query = query.Where("fund_id = ?", fundID)
		}
	}

	if txType := c.Query("transaction_type"); txType != "" {
		query = query.Where("transaction_type = ?", txType)
	}

	if category := strings.TrimSpace(c.Query("category")); category != "" && category != "all" {
		categoryAliases := map[string][]string{
			"sale":                    {"sale", "Doanh thu bán hàng POS", "Doanh thu bán hàng", "Bán hàng"},
			"Doanh thu bán hàng POS": {"sale", "Doanh thu bán hàng POS", "Doanh thu bán hàng", "Bán hàng"},
			"Doanh thu bán hàng":     {"sale", "Doanh thu bán hàng POS", "Doanh thu bán hàng", "Bán hàng"},
			"ingredient_purchase":     {"ingredient_purchase", "Mua nguyên liệu", "Mua nguyên vật liệu", "Nguyên liệu"},
			"Mua nguyên liệu":         {"ingredient_purchase", "Mua nguyên liệu", "Mua nguyên vật liệu", "Nguyên liệu"},
			"utility_bill":            {"utility_bill", "Chi phí vận hành", "Vận hành"},
			"Chi phí vận hành":        {"utility_bill", "Chi phí vận hành", "Vận hành"},
			"reconciliation_variance": {"reconciliation_variance", "Chênh lệch đối soát", "Chênh lệch đối soát két"},
			"Chênh lệch đối soát két": {"reconciliation_variance", "Chênh lệch đối soát", "Chênh lệch đối soát két"},
			"Chênh lệch đối soát":     {"reconciliation_variance", "Chênh lệch đối soát", "Chênh lệch đối soát két"},
			"order_refund":            {"order_refund", "Hủy đơn / Trả hàng", "Hủy đơn", "Trả hàng", "Hoàn tiền đơn hàng"},
			"Hủy đơn / Trả hàng":      {"order_refund", "Hủy đơn / Trả hàng", "Hủy đơn", "Trả hàng", "Hoàn tiền đơn hàng"},
			"other":                   {"other", "Chi phí khác", "Thu khác", "Khác"},
			"Chi phí khác":            {"other", "Chi phí khác", "Thu khác", "Khác"},
			"Khác":                    {"other", "Chi phí khác", "Thu khác", "Khác"},
		}

		if aliases, found := categoryAliases[category]; found {
			query = query.Where("category IN ?", aliases)
		} else {
			var catItem models.TransactionCategoryItem
			if err := h.db.Where("code = ? OR name = ?", category, category).First(&catItem).Error; err == nil {
				names := []string{category}
				if catItem.Code != "" {
					names = append(names, catItem.Code)
				}
				if catItem.Name != "" {
					names = append(names, catItem.Name)
				}
				query = query.Where("category IN ?", names)
			} else {
				query = query.Where("category = ?", category)
			}
		}
	}

	pageStr := c.Query("page")
	pageSizeStr := c.Query("page_size")

	// If page parameter provided, perform paginated query
	if pageStr != "" {
		page, _ := strconv.Atoi(pageStr)
		if page < 1 {
			page = 1
		}
		pageSize, _ := strconv.Atoi(pageSizeStr)
		if pageSize < 1 || pageSize > 100 {
			pageSize = 25
		}

		var total int64
		if err := query.Count(&total).Error; err != nil {
			models.SendInternalErrorLogged(c, "Failed to count transactions", err)
			return
		}

		transactions := make([]models.Transaction, 0)
		if err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&transactions).Error; err != nil {
			models.SendInternalErrorLogged(c, "Failed to retrieve transactions", err)
			return
		}

		totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
		models.SendSuccess(c, http.StatusOK, gin.H{
			"items":       transactions,
			"page":        page,
			"page_size":   pageSize,
			"total_items": total,
			"total_pages": totalPages,
		}, "Transactions retrieved successfully")
		return
	}

	// Default unpaginated query for backwards compatibility
	transactions := make([]models.Transaction, 0)
	if err := query.Order("created_at desc").Find(&transactions).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve transactions", err)
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

	txTime := time.Now()
	if req.CreatedAt != nil && !req.CreatedAt.IsZero() {
		txTime = *req.CreatedAt
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
		CreatedAt:       txTime,
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

		// 3. Process optional itemized purchase items (Ingredients & Packaging)
		if len(req.PurchaseItems) > 0 {
			for _, item := range req.PurchaseItems {
				ingName := strings.TrimSpace(item.IngredientName)
				if ingName == "" && (item.IngredientID == nil || *item.IngredientID == 0) {
					continue
				}

				var ingredient models.Ingredient
				var findErr error

				if item.IngredientID != nil && *item.IngredientID > 0 {
					findErr = tx.First(&ingredient, *item.IngredientID).Error
				} else {
					findErr = tx.Where("LOWER(name) = LOWER(?)", ingName).First(&ingredient).Error
				}

				unit := strings.TrimSpace(item.Unit)
				if unit == "" {
					unit = "kg"
				}
				category := strings.TrimSpace(item.Category)
				if category == "" {
					category = "fruit"
				}

				if errors.Is(findErr, gorm.ErrRecordNotFound) {
					// Create new ingredient
					ingredient = models.Ingredient{
						Name:                 ingName,
						Category:             category,
						Unit:                 unit,
						LatestPurchasePrice:  item.UnitPrice,
						AveragePurchasePrice: item.UnitPrice,
						YieldRate:            1.0000,
						CreatedAt:            txTime,
						UpdatedAt:            txTime,
					}
					if err := tx.Create(&ingredient).Error; err != nil {
						return err
					}
				} else if findErr == nil {
					// Update existing ingredient latest price and unit if unset
					ingredient.LatestPurchasePrice = item.UnitPrice
					if ingredient.Unit == "" {
						ingredient.Unit = unit
					}
					if item.Category != "" && (ingredient.Category == "" || ingredient.Category == "fruit") {
						ingredient.Category = category
					}
					ingredient.UpdatedAt = txTime
					if err := tx.Save(&ingredient).Error; err != nil {
						return err
					}
				} else {
					return findErr
				}

				// Insert Purchase Item record
				subtotal := math.Round(item.Quantity*item.UnitPrice*100) / 100
				purchaseItem := models.PurchaseItem{
					TransactionID: transaction.ID,
					IngredientID:  ingredient.ID,
					Quantity:      item.Quantity,
					UnitPrice:     item.UnitPrice,
					Subtotal:      subtotal,
					CreatedAt:     txTime,
				}
				if err := tx.Create(&purchaseItem).Error; err != nil {
					return err
				}

				if err := recalculateIngredientPrices(tx, ingredient.ID); err != nil {
					return err
				}
			}
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to record transaction", err)
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
	}

	h.db.Preload("Fund").Preload("PurchaseItems.Ingredient").First(&transaction, transaction.ID)

	// Trigger non-blocking real-time Google Sheets sync if enabled
	if h.sheetsSyncSvc != nil {
		go h.sheetsSyncSvc.AppendTransactionRow(transaction)
	}

	models.SendSuccess(c, http.StatusCreated, transaction, "Transaction logged successfully")
}

// recalculateIngredientPrices computes weighted average and latest purchase price from all purchase items for an ingredient
func recalculateIngredientPrices(tx *gorm.DB, ingredientID uint) error {
	if ingredientID == 0 {
		return nil
	}
	type CostSummary struct {
		TotalCost float64 `gorm:"column:total_cost"`
		TotalQty  float64 `gorm:"column:total_qty"`
	}
	var summary CostSummary
	if err := tx.Model(&models.PurchaseItem{}).
		Select("COALESCE(SUM(subtotal), 0) AS total_cost, COALESCE(SUM(quantity), 0) AS total_qty").
		Where("ingredient_id = ?", ingredientID).
		Scan(&summary).Error; err != nil {
		return err
	}

	var latestItem models.PurchaseItem
	hasLatest := tx.Where("ingredient_id = ?", ingredientID).
		Order("created_at DESC, id DESC").
		Limit(1).
		Find(&latestItem).RowsAffected > 0

	var ingredient models.Ingredient
	if err := tx.First(&ingredient, ingredientID).Error; err != nil {
		return err
	}

	if summary.TotalQty > 0 {
		ingredient.AveragePurchasePrice = math.Round((summary.TotalCost/summary.TotalQty)*100) / 100
	} else {
		ingredient.AveragePurchasePrice = 0
	}

	if hasLatest {
		ingredient.LatestPurchasePrice = latestItem.UnitPrice
	} else {
		ingredient.LatestPurchasePrice = 0
	}

	return tx.Save(&ingredient).Error
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
		models.SendInternalErrorLogged(c, "Failed to find transaction", err)
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
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
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
		// 1. Revert effect of existing transaction on its original fund
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
		if req.CreatedAt != nil && !req.CreatedAt.IsZero() {
			existingTx.CreatedAt = *req.CreatedAt
		}

		if err := tx.Save(&existingTx).Error; err != nil {
			return err
		}

		// 4. Update itemized purchase items if provided
		if req.PurchaseItems != nil {
			// Find existing purchase items and record their ingredient IDs to recalculate later
			var oldItems []models.PurchaseItem
			if err := tx.Where("transaction_id = ?", existingTx.ID).Find(&oldItems).Error; err != nil {
				return err
			}
			affectedIngredientIDs := make(map[uint]bool)
			for _, oi := range oldItems {
				affectedIngredientIDs[oi.IngredientID] = true
			}

			// Remove old purchase items for this transaction
			if err := tx.Where("transaction_id = ?", existingTx.ID).Delete(&models.PurchaseItem{}).Error; err != nil {
				return err
			}

			// Insert new purchase items
			for _, item := range *req.PurchaseItems {
				ingName := strings.TrimSpace(item.IngredientName)
				if ingName == "" && (item.IngredientID == nil || *item.IngredientID == 0) {
					continue
				}

				var ingredient models.Ingredient
				var findErr error

				if item.IngredientID != nil && *item.IngredientID > 0 {
					findErr = tx.First(&ingredient, *item.IngredientID).Error
				} else {
					findErr = tx.Where("LOWER(name) = LOWER(?)", ingName).First(&ingredient).Error
				}

				unit := strings.TrimSpace(item.Unit)
				if unit == "" {
					unit = "kg"
				}
				category := strings.TrimSpace(item.Category)
				if category == "" {
					category = "fruit"
				}

				if errors.Is(findErr, gorm.ErrRecordNotFound) {
					// Create new ingredient
					ingredient = models.Ingredient{
						Name:                 ingName,
						Category:             category,
						Unit:                 unit,
						LatestPurchasePrice:  item.UnitPrice,
						AveragePurchasePrice: item.UnitPrice,
						YieldRate:            1.0000,
						CreatedAt:            existingTx.CreatedAt,
						UpdatedAt:            existingTx.CreatedAt,
					}
					if err := tx.Create(&ingredient).Error; err != nil {
						return err
					}
				} else if findErr == nil {
					// Update existing ingredient latest price and unit if unset
					ingredient.LatestPurchasePrice = item.UnitPrice
					if ingredient.Unit == "" {
						ingredient.Unit = unit
					}
					if item.Category != "" && (ingredient.Category == "" || ingredient.Category == "fruit") {
						ingredient.Category = category
					}
					ingredient.UpdatedAt = existingTx.CreatedAt
					if err := tx.Save(&ingredient).Error; err != nil {
						return err
					}
				} else {
					return findErr
				}

				affectedIngredientIDs[ingredient.ID] = true

				subtotal := math.Round(item.Quantity*item.UnitPrice*100) / 100
				purchaseItem := models.PurchaseItem{
					TransactionID: existingTx.ID,
					IngredientID:  ingredient.ID,
					Quantity:      item.Quantity,
					UnitPrice:     item.UnitPrice,
					Subtotal:      subtotal,
					CreatedAt:     existingTx.CreatedAt,
				}
				if err := tx.Create(&purchaseItem).Error; err != nil {
					return err
				}
			}

			// Recalculate prices for all affected ingredients
			for ingID := range affectedIngredientIDs {
				if err := recalculateIngredientPrices(tx, ingID); err != nil {
					return err
				}
			}
		} else {
			// If purchase items not provided but transaction timestamp changed, sync purchase items timestamp
			tx.Model(&models.PurchaseItem{}).Where("transaction_id = ?", existingTx.ID).Update("created_at", existingTx.CreatedAt)
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to update transaction", err)
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
	}

	h.db.Preload("Fund").Preload("PurchaseItems.Ingredient").First(&existingTx, existingTx.ID)
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
		models.SendInternalErrorLogged(c, "Failed to find transaction", err)
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

		// 2. Track affected ingredients from purchase items
		var oldItems []models.PurchaseItem
		if err := tx.Where("transaction_id = ?", existingTx.ID).Find(&oldItems).Error; err != nil {
			return err
		}
		affectedIngredientIDs := make(map[uint]bool)
		for _, oi := range oldItems {
			affectedIngredientIDs[oi.IngredientID] = true
		}

		// 3. Delete purchase items and transaction record
		if err := tx.Where("transaction_id = ?", existingTx.ID).Delete(&models.PurchaseItem{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&existingTx).Error; err != nil {
			return err
		}

		// 4. Recalculate prices for affected ingredients
		for ingID := range affectedIngredientIDs {
			if err := recalculateIngredientPrices(tx, ingID); err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete transaction", err)
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
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
			t.category, 
			COALESCE(SUM(t.amount), 0) as total_amount, 
			COUNT(t.id) as count 
		FROM transactions t
		LEFT JOIN orders o ON t.reference_order_id = o.id
		WHERE t.transaction_type = ? 
		  AND t.created_at BETWEEN ? AND ?
		  AND (t.reference_order_id IS NULL OR o.status != 'cancelled')
		GROUP BY t.category 
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

	canonicalMap := map[string]struct {
		Label string
		Code  string
	}{
		"sale":                    {Label: "Doanh thu bán hàng POS", Code: "sale"},
		"doanh thu bán hàng pos": {Label: "Doanh thu bán hàng POS", Code: "sale"},
		"doanh thu bán hàng":     {Label: "Doanh thu bán hàng POS", Code: "sale"},
		"ingredient_purchase":     {Label: "Mua nguyên liệu (Sữa, Cà phê, Đá)", Code: "ingredient_purchase"},
		"mua nguyên liệu":         {Label: "Mua nguyên liệu (Sữa, Cà phê, Đá)", Code: "ingredient_purchase"},
		"utility_bill":            {Label: "Chi phí vận hành (Điện, Nước, Net)", Code: "utility_bill"},
		"chi phí vận hành":        {Label: "Chi phí vận hành (Điện, Nước, Net)", Code: "utility_bill"},
		"reconciliation_variance": {Label: "Chênh lệch đối soát két", Code: "reconciliation_variance"},
		"chênh lệch đối soát két": {Label: "Chênh lệch đối soát két", Code: "reconciliation_variance"},
		"chênh lệch đối soát":     {Label: "Chênh lệch đối soát két", Code: "reconciliation_variance"},
		"order_refund":            {Label: "Hủy đơn / Trả hàng", Code: "order_refund"},
		"hủy đơn / trả hàng":      {Label: "Hủy đơn / Trả hàng", Code: "order_refund"},
		"hủy đơn":                 {Label: "Hủy đơn / Trả hàng", Code: "order_refund"},
		"hoàn tiền đơn hàng":      {Label: "Hủy đơn / Trả hàng", Code: "order_refund"},
		"other":                   {Label: "Chi phí khác", Code: "other"},
		"chi phí khác":            {Label: "Chi phí khác", Code: "other"},
	}

	type MergedItem struct {
		Category string
		Label    string
		Amount   float64
		Count    int64
	}

	mergedMap := make(map[string]*MergedItem)
	orderedKeys := make([]string, 0)

	for _, rc := range rawCategories {
		normKey := strings.ToLower(strings.TrimSpace(rc.Category))
		code := rc.Category
		label := strings.ReplaceAll(rc.Category, "_", " ")

		if canon, exists := canonicalMap[normKey]; exists {
			code = canon.Code
			label = canon.Label
		}

		if item, exists := mergedMap[code]; exists {
			item.Amount += rc.TotalAmount
			item.Count += rc.Count
		} else {
			mergedMap[code] = &MergedItem{
				Category: code,
				Label:    label,
				Amount:   rc.TotalAmount,
				Count:    rc.Count,
			}
			orderedKeys = append(orderedKeys, code)
		}
	}

	categories := make([]models.CategoryBreakdownItem, 0)
	for _, key := range orderedKeys {
		item := mergedMap[key]
		var pct float64 = 0
		if totalAmount > 0 {
			pct = math.Round((item.Amount/totalAmount)*1000) / 10
		}

		categories = append(categories, models.CategoryBreakdownItem{
			Category:      item.Category,
			CategoryLabel: item.Label,
			TotalAmount:   item.Amount,
			Percentage:    pct,
			Count:         item.Count,
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
