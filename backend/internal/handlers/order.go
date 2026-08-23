package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OrderHandler struct {
	db            *gorm.DB
	sheetsSyncSvc *services.SheetsSyncService
	fundCache     *cache.TTLCache
}

func NewOrderHandler(db *gorm.DB, sheetsSyncSvc *services.SheetsSyncService, fundCache *cache.TTLCache) *OrderHandler {
	return &OrderHandler{db: db, sheetsSyncSvc: sheetsSyncSvc, fundCache: fundCache}
}

// ListOrders retrieves orders with loaded relations, optional filters and pagination
func (h *OrderHandler) ListOrders(c *gin.Context) {
	query := h.db.Model(&models.Order{}).
		Preload("Fund").
		Preload("Promotion").
		Preload("Items.Variant.Product")

	if fundIDStr := c.Query("fund_id"); fundIDStr != "" {
		if fundID, err := strconv.ParseUint(fundIDStr, 10, 32); err == nil {
			query = query.Where("fund_id = ?", fundID)
		}
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
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
			models.SendInternalErrorLogged(c, "Failed to count orders", err)
			return
		}

		orders := make([]models.Order, 0)
		if err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&orders).Error; err != nil {
			models.SendInternalErrorLogged(c, "Failed to retrieve orders", err)
			return
		}

		totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
		models.SendSuccess(c, http.StatusOK, gin.H{
			"items":       orders,
			"page":        page,
			"page_size":   pageSize,
			"total_items": total,
			"total_pages": totalPages,
		}, "Orders retrieved successfully")
		return
	}

	// Default unpaginated query for backwards compatibility
	orders := make([]models.Order, 0)
	if err := query.Order("created_at desc").Find(&orders).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve orders", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, orders, "Orders retrieved successfully")
}

// GetOrderByID retrieves order details by ID
func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var order models.Order
	if err := h.db.Preload("Fund").Preload("Promotion").Preload("Items.Variant.Product").First(&order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Order not found")
			return
		}
		models.SendInternalError(c, "Failed to retrieve order details")
		return
	}

	models.SendSuccess(c, http.StatusOK, order, "Order details retrieved successfully")
}

// CreateOrder processes cart items, calculates dynamic adjustments & promotions, creates order, logs automated transaction, and increments target fund balance
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ResponseEnvelope{
			Status:  "error",
			Message: "Invalid order payload: " + err.Error(),
		})
		return
	}

	// Verify target Fund exists
	var fund models.Fund
	if err := h.db.First(&fund, req.FundID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusBadRequest, "Invalid fund ID: Fund does not exist")
			return
		}
		models.SendInternalError(c, "Failed to verify payment fund")
		return
	}

	// Determine Order Creation Timestamp (Default: time.Now(), or custom backfilled timestamp)
	orderTime := time.Now()
	if req.CreatedAt != nil && !req.CreatedAt.IsZero() {
		orderTime = *req.CreatedAt
	}

	// Generate Human-Readable Order Code e.g. ORD-20260811-153045
	orderCode := fmt.Sprintf("ORD-%s-%04d", orderTime.Format("20060102-150405"), orderTime.Nanosecond()/100000)

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
		createdBy = "cashier"
	}

	var subtotal float64 = 0
	var orderItems []models.OrderItem

	for _, itemReq := range req.Items {
		lineTotal := itemReq.UnitPrice * float64(itemReq.Quantity)
		subtotal += lineTotal

		// Serialize the topping snapshot to JSON string for JSONB storage
		toppingsJSON, err := models.MarshalToppingSnapshots(itemReq.SelectedToppings)
		if err != nil {
			toppingsJSON = "[]"
		}

		orderItems = append(orderItems, models.OrderItem{
			ProductVariantID: itemReq.ProductVariantID,
			Quantity:         itemReq.Quantity,
			UnitPrice:        itemReq.UnitPrice,
			LineTotal:        lineTotal,
			SelectedToppings: toppingsJSON,
			ToppingsPrice:    itemReq.ToppingsPrice,
			Notes:            itemReq.Notes,
			CreatedAt:        orderTime,
		})
	}

	// Compute Final Total with promotions and dynamic adjustments
	totalAmount := subtotal - req.DiscountAmount - req.PromotionDiscount - req.PlatformFeeDiscount + req.ShippingFee + req.Surcharge
	if totalAmount < 0 {
		totalAmount = 0
	}

	// Set order note only if non-empty (stored as nullable pointer)
	var orderNote *string
	if req.Note != "" {
		orderNote = &req.Note
	}

	order := models.Order{
		OrderCode:           orderCode,
		Status:              models.OrderStatusCompleted,
		Subtotal:            subtotal,
		DiscountAmount:      req.DiscountAmount,
		PromotionID:         req.PromotionID,
		PromotionDiscount:   req.PromotionDiscount,
		ShippingFee:         req.ShippingFee,
		PlatformFeeDiscount: req.PlatformFeeDiscount,
		Surcharge:           req.Surcharge,
		TotalAmount:         totalAmount,
		FundID:              req.FundID,
		CreatedBy:           createdBy,
		CashierID:           cashierIDPtr,
		CashierName:         cashierName,
		Note:                orderNote,
		CreatedAt:           orderTime,
	}

	// Database Transaction to save order, insert items, update fund balance, increment promotion usage, AND log inflow transaction
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Insert Order
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		// 2. Insert OrderItems linked to OrderID
		for i := range orderItems {
			orderItems[i].OrderID = order.ID
		}
		if err := tx.Create(&orderItems).Error; err != nil {
			return err
		}

		// 3. Increment Promotion Usage Count if applied
		if order.PromotionID != nil && *order.PromotionID > 0 {
			if err := tx.Model(&models.Promotion{}).Where("id = ?", *order.PromotionID).
				Update("usage_count", gorm.Expr("usage_count + 1")).Error; err != nil {
				return err
			}
		}

		// 4. Insert Automated Inflow Transaction for Sale (include cashier attribution)
		transaction := models.Transaction{
			FundID:           order.FundID,
			TransactionType:  models.TransactionTypeInflow,
			Category:         models.CategorySale,
			Amount:           totalAmount,
			ReferenceOrderID: &order.ID,
			Description:      fmt.Sprintf("POS Sale Order: %s", order.OrderCode),
			CreatedBy:        createdBy,
			CashierID:        cashierIDPtr,
			CashierName:      cashierName,
			CreatedAt:        orderTime,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		// 5. Update Fund Current Balance
		if err := tx.Model(&fund).Update("current_balance", gorm.Expr("current_balance + ?", totalAmount)).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to process order transaction", err)
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
	}

	// Load order relations for response
	h.db.Preload("Fund").Preload("Promotion").Preload("Items.Variant.Product").First(&order, order.ID)

	// Trigger non-blocking real-time Google Sheets sync if enabled
	if h.sheetsSyncSvc != nil {
		go h.sheetsSyncSvc.AppendOrderRow(order)
	}

	models.SendSuccess(c, http.StatusCreated, order, "Order created successfully")
}

// CancelOrder handles order cancellation, status transition, and optional refund to fund account
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid order ID")
		return
	}

	var order models.Order
	if err := h.db.First(&order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Order not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find order", err)
		return
	}

	if order.Status == models.OrderStatusCancelled {
		models.SendError(c, http.StatusBadRequest, "Order is already cancelled")
		return
	}

	var req models.CancelOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request payload")
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

	now := time.Now()
	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Update Order Status
		orderUpdates := map[string]interface{}{
			"status":        models.OrderStatusCancelled,
			"cancel_reason": req.CancelReason,
			"cancelled_at":  &now,
		}
		if err := tx.Model(&order).Updates(orderUpdates).Error; err != nil {
			return err
		}

		// 2. If Refund requested, log Outflow transaction and deduct fund balance
		if req.Refund && order.TotalAmount > 0 {
			refundDesc := fmt.Sprintf("Hoàn tiền đơn hàng #%s - Lý do: %s", order.OrderCode, req.CancelReason)
			refundTx := models.Transaction{
				FundID:           order.FundID,
				TransactionType:  models.TransactionTypeOutflow,
				Category:         models.CategoryOther,
				Amount:           order.TotalAmount,
				ReferenceOrderID: &order.ID,
				Description:      refundDesc,
				CreatedBy:        cashierName,
				CashierID:        cashierIDPtr,
				CashierName:      cashierName,
			}

			if err := tx.Create(&refundTx).Error; err != nil {
				return err
			}

			// Deduct from fund current balance
			if err := tx.Model(&models.Fund{}).Where("id = ?", order.FundID).
				Update("current_balance", gorm.Expr("current_balance - ?", order.TotalAmount)).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to cancel order", err)
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
	}

	h.db.Preload("Fund").Preload("Promotion").Preload("Items.Variant.Product").First(&order, order.ID)

	// Trigger non-blocking real-time Google Sheets sync if enabled
	if h.sheetsSyncSvc != nil {
		go h.sheetsSyncSvc.AppendOrderRow(order)
	}

	models.SendSuccess(c, http.StatusOK, order, "Order cancelled successfully")
}

// GetVietQR generates Napas 247 VietQR payload & image URL for bank transfers
func (h *OrderHandler) GetVietQR(c *gin.Context) {
	orderCode := c.Query("order_code")
	amountStr := c.Query("amount")

	amount, _ := strconv.ParseFloat(amountStr, 64)
	if orderCode == "" {
		orderCode = fmt.Sprintf("POS-%d", time.Now().Unix())
	}

	// Fetch VietQR settings from DB with default fallbacks
	bankID := "MB"
	accountNo := "123456789"
	accountName := "THO JUICE AND COFFEE"

	var settings []models.Setting
	if err := h.db.Where("key IN ?", []string{"vietqr_bank_id", "vietqr_account_no", "vietqr_account_name"}).Find(&settings).Error; err == nil {
		for _, s := range settings {
			switch s.Key {
			case "vietqr_bank_id":
				if s.Value != "" {
					bankID = s.Value
				}
			case "vietqr_account_no":
				if s.Value != "" {
					accountNo = s.Value
				}
			case "vietqr_account_name":
				if s.Value != "" {
					accountName = s.Value
				}
			}
		}
	}

	addInfoEscaped := url.QueryEscape(orderCode)
	accountNameEscaped := url.QueryEscape(accountName)

	qrURL := fmt.Sprintf("https://img.vietqr.io/image/%s-%s-compact2.png?amount=%.0f&addInfo=%s&accountName=%s",
		bankID, accountNo, amount, addInfoEscaped, accountNameEscaped)

	resp := models.VietQRResponse{
		OrderCode:   orderCode,
		BankID:      bankID,
		AccountNo:   accountNo,
		AccountName: accountName,
		Amount:      amount,
		QrURL:       qrURL,
	}

	models.SendSuccess(c, http.StatusOK, resp, "VietQR generated successfully")
}
