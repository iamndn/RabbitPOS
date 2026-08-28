package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

// CreateOrder processes cart items with Server-Authoritative pricing, RBAC overrides, idempotency & transaction safety
// POST /api/v1/orders
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	// Read canonical raw body bytes for Idempotency SHA-256 hash
	var bodyBytes []byte
	if c.Request.Body != nil {
		bodyBytes, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	}

	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "ORDER_INVALID_PAYLOAD", "Dữ liệu đơn hàng không hợp lệ: "+err.Error())
		return
	}

	// Extract requester identity and RBAC role from JWT Context (Server-Authoritative)
	role := "cashier"
	if roleVal, ok := c.Get("role"); ok {
		if r, ok := roleVal.(string); ok && r != "" {
			role = r
		}
	}
	cashierName := "cashier"
	if usernameVal, ok := c.Get("username"); ok {
		if uname, ok := usernameVal.(string); ok && uname != "" {
			cashierName = uname
		}
	}
	var cashierIDPtr *uint
	if userIDVal, ok := c.Get("user_id"); ok {
		if uid, ok := userIDVal.(uint); ok {
			cashierIDPtr = &uid
		}
	}
	isAdmin := role == "admin"

	// Enforce RBAC for Admin-Only Overrides (Price Override, Manual Discount, Custom Backdating)
	hasItemPriceOverride := false
	for _, itm := range req.Items {
		if itm.PriceOverride != nil {
			hasItemPriceOverride = true
			break
		}
	}
	hasManualDiscount := req.ManualDiscount != nil && *req.ManualDiscount > 0
	hasBackdate := req.CreatedAt != nil && !req.CreatedAt.IsZero()
	hasCustomFee := (req.ShippingFee != nil && *req.ShippingFee > 0) || (req.Surcharge != nil && *req.Surcharge > 0)

	if !isAdmin && (hasItemPriceOverride || hasManualDiscount || hasBackdate || hasCustomFee) {
		models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN_ROLE", "Chỉ quản trị viên (Admin) mới có quyền can thiệp giá (override), giảm giá thủ công hoặc chọn ngày tạo đơn trong quá khứ.")
		return
	}

	// Log backward-compatibility warning if client passed legacy money values
	if req.TotalAmount > 0 || req.Subtotal > 0 || req.DiscountAmount > 0 {
		log.Printf("[PRICE WARN] Client submitted unverified money fields (subtotal/total). Ignored in favor of server-authoritative calculations.")
	}

	// Idempotency Key Processing
	idempotencyKey := c.GetHeader("Idempotency-Key")
	if idempotencyKey == "" {
		idempotencyKey = req.IdempotencyKey
	}

	var requestHash string
	if idempotencyKey != "" {
		requestHash = utils.ComputeBytesSHA256(bodyBytes)

		var existingRecord models.IdempotencyRecord
		if err := h.db.Where("key = ?", idempotencyKey).First(&existingRecord).Error; err == nil {
			// Idempotency Record Exists
			if existingRecord.Status == models.IdempotencyStatusCompleted {
				if existingRecord.RequestHash == requestHash {
					// Duplicate Request with Identical Payload -> Return Cached Result safely
					c.Header("X-Cache-Lookup", "HIT-IDEMPOTENT")
					c.Data(existingRecord.ResponseCode, "application/json; charset=utf-8", []byte(existingRecord.ResponseBody))
					return
				}
				// Duplicate Key with Different Payload -> 409 Conflict
				models.SendErrorCode(c, http.StatusConflict, "ORDER_IDEMPOTENT_CONFLICT", "Khóa Idempotency-Key đã được sử dụng trước đó cho một yêu cầu khác với dữ liệu khác.")
				return
			} else if existingRecord.Status == models.IdempotencyStatusProcessing {
				if time.Now().Before(existingRecord.ExpiresAt) {
					models.SendErrorCode(c, http.StatusConflict, "REQUEST_IN_PROGRESS", "Yêu cầu với khóa Idempotency này đang được xử lý. Vui lòng thử lại sau giây lát.")
					return
				}
			}
		}
	}

	// Execute Server-Authoritative Pricing Calculation & Creation inside 1 Database Transaction
	var createdOrder models.Order

	txErr := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. If Idempotency Key provided, record processing lock
		if idempotencyKey != "" {
			procRecord := models.IdempotencyRecord{
				Key:          idempotencyKey,
				RequestHash:  requestHash,
				ResourceType: "order",
				Status:       models.IdempotencyStatusProcessing,
				CreatedAt:    time.Now(),
				ExpiresAt:    time.Now().Add(24 * time.Hour),
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"status", "request_hash", "expires_at"}),
			}).Create(&procRecord).Error; err != nil {
				return fmt.Errorf("failed to initialize idempotency record: %w", err)
			}
		}

		// 2. Verify Target Fund
		var fund models.Fund
		if err := tx.First(&fund, req.FundID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("FUND_NOT_FOUND: Quỹ thanh toán ID %d không tồn tại", req.FundID)
			}
			return err
		}
		if !fund.IsActive {
			return fmt.Errorf("FUND_INACTIVE: Quỹ thanh toán %s hiện đang bị khóa", fund.Name)
		}

		// 3. Determine Order Timestamp
		orderTime := time.Now()
		if isAdmin && req.CreatedAt != nil && !req.CreatedAt.IsZero() {
			orderTime = *req.CreatedAt
		}
		orderCode := fmt.Sprintf("ORD-%s-%04d", orderTime.Format("20060102-150405"), orderTime.Nanosecond()/100000)

		// 4. Server-Authoritative Items & Toppings Calculation
		var subtotal float64 = 0
		var orderItems []models.OrderItem
		isOrderOverridden := false

		for _, itemReq := range req.Items {
			// Query Product Variant from DB
			var variant models.ProductVariant
			if err := tx.Preload("Product").First(&variant, itemReq.ProductVariantID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return fmt.Errorf("VARIANT_NOT_FOUND: Biến thể món ID %d không tồn tại", itemReq.ProductVariantID)
				}
				return err
			}
			if !variant.IsActive {
				return fmt.Errorf("VARIANT_INACTIVE: Biến thể món %s đã ngừng kinh doanh", variant.VariantName)
			}
			if variant.Product != nil && !variant.Product.IsActive {
				return fmt.Errorf("PRODUCT_INACTIVE: Sản phẩm %s đã ngừng kinh doanh", variant.Product.Name)
			}

			origUnitPrice := variant.RetailPrice
			unitPrice := origUnitPrice
			isItemOverridden := false

			// Apply Admin Price Override if requested
			if isAdmin && itemReq.PriceOverride != nil && *itemReq.PriceOverride >= 0 {
				unitPrice = math.Round(*itemReq.PriceOverride)
				isItemOverridden = true
				isOrderOverridden = true
			}

			// Query & Calculate Toppings authoritatively
			var toppingsPrice float64 = 0
			var toppingsSnapshots []models.ToppingSnapshot

			// Handle ToppingIDs
			if len(itemReq.ToppingIDs) > 0 {
				var toppings []models.Topping
				if err := tx.Where("id IN ? AND is_active = ?", itemReq.ToppingIDs, true).Find(&toppings).Error; err != nil {
					return err
				}
				if len(toppings) != len(itemReq.ToppingIDs) {
					return fmt.Errorf("TOPPING_NOT_FOUND: Một số topping không tồn tại hoặc đã ngừng phục vụ")
				}
				for _, t := range toppings {
					toppingsPrice += t.Price
					toppingsSnapshots = append(toppingsSnapshots, models.ToppingSnapshot{
						ID:    t.ID,
						Name:  t.Name,
						Price: t.Price,
					})
				}
			} else if len(itemReq.SelectedToppings) > 0 {
				// Fallback for backward compatibility: query active prices by ID from DB
				var toppingIDs []uint
				for _, s := range itemReq.SelectedToppings {
					if s.ID > 0 {
						toppingIDs = append(toppingIDs, s.ID)
					}
				}
				if len(toppingIDs) > 0 {
					var toppings []models.Topping
					if err := tx.Where("id IN ? AND is_active = ?", toppingIDs, true).Find(&toppings).Error; err != nil {
						return err
					}
					topMap := make(map[uint]models.Topping)
					for _, t := range toppings {
						topMap[t.ID] = t
					}
					for _, s := range itemReq.SelectedToppings {
						if t, found := topMap[s.ID]; found {
							toppingsPrice += t.Price
							toppingsSnapshots = append(toppingsSnapshots, models.ToppingSnapshot{
								ID:    t.ID,
								Name:  t.Name,
								Price: t.Price,
							})
						}
					}
				}
			}

			toppingsJSON, _ := models.MarshalToppingSnapshots(toppingsSnapshots)
			lineTotal := math.Round((unitPrice + toppingsPrice) * float64(itemReq.Quantity))
			subtotal += lineTotal

			orderItems = append(orderItems, models.OrderItem{
				ProductVariantID:  variant.ID,
				Quantity:          itemReq.Quantity,
				UnitPrice:         unitPrice,
				OriginalUnitPrice: origUnitPrice,
				LineTotal:         lineTotal,
				SelectedToppings:  toppingsJSON,
				ToppingsPrice:     toppingsPrice,
				Notes:             itemReq.Notes,
				IsPriceOverridden: isItemOverridden,
				OverrideReason:    itemReq.OverrideReason,
				CreatedAt:         orderTime,
			})
		}

		// 5. Promotion Calculation & Atomic Validation
		var promoDiscount float64 = 0
		if req.PromotionID != nil && *req.PromotionID > 0 {
			var promo models.Promotion
			// Row lock for concurrent usage count safety
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&promo, *req.PromotionID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					return fmt.Errorf("PROMOTION_NOT_FOUND: Chương trình khuyến mãi ID %d không tồn tại", *req.PromotionID)
				}
				return err
			}
			if !promo.IsActive {
				return fmt.Errorf("PROMOTION_INACTIVE: Khuyến mãi %s đã bị vô hiệu hóa", promo.Name)
			}
			if promo.StartDate != nil && orderTime.Before(*promo.StartDate) {
				return fmt.Errorf("PROMOTION_NOT_STARTED: Khuyến mãi %s chưa đến thời gian áp dụng", promo.Name)
			}
			if promo.EndDate != nil && orderTime.After(*promo.EndDate) {
				return fmt.Errorf("PROMOTION_EXPIRED: Khuyến mãi %s đã hết hạn sử dụng", promo.Name)
			}
			if promo.UsageLimit > 0 && promo.UsageCount >= promo.UsageLimit {
				return fmt.Errorf("PROMOTION_USAGE_EXCEEDED: Khuyến mãi %s đã hết lượt sử dụng cho phép", promo.Name)
			}
			if subtotal < promo.MinOrderAmount {
				return fmt.Errorf("PROMOTION_MIN_AMOUNT_NOT_MET: Đơn hàng chưa đạt giá trị tối thiểu (%.0fđ) để áp dụng khuyến mãi %s", promo.MinOrderAmount, promo.Name)
			}

			switch promo.PromoType {
			case models.PromoTypeDiscountAmount:
				promoDiscount = math.Min(promo.DiscountValue, subtotal)
			case models.PromoTypeDiscountPercent:
				promoDiscount = math.Round(subtotal * promo.DiscountValue / 100)
			case models.PromoTypeGiftItem:
				promoDiscount = 0
			}

			// Atomic increment promotion usage
			if err := tx.Model(&promo).Update("usage_count", gorm.Expr("usage_count + 1")).Error; err != nil {
				return fmt.Errorf("failed to increment promotion usage: %w", err)
			}
		}

		// 6. Admin Manual Discount & Extra Fees
		var manualDiscount float64 = 0
		if isAdmin && req.ManualDiscount != nil {
			manualDiscount = math.Round(*req.ManualDiscount)
			if manualDiscount > subtotal {
				manualDiscount = subtotal
			}
			if manualDiscount > 0 {
				isOrderOverridden = true
			}
		}

		var shippingFee float64 = 0
		if isAdmin && req.ShippingFee != nil {
			shippingFee = math.Round(*req.ShippingFee)
		}

		var surcharge float64 = 0
		if isAdmin && req.Surcharge != nil {
			surcharge = math.Round(*req.Surcharge)
		}

		// 7. Calculate Final Total Amount
		totalAmount := math.Round(subtotal - promoDiscount - manualDiscount + shippingFee + surcharge)
		if totalAmount < 0 {
			totalAmount = 0
		}

		// 8. Construct Order Record
		var orderNote *string
		if req.Note != "" {
			orderNote = &req.Note
		}

		var idempKeyPtr *string
		if idempotencyKey != "" {
			idempKeyPtr = &idempotencyKey
		}

		createdOrder = models.Order{
			OrderCode:           orderCode,
			Status:              models.OrderStatusCompleted,
			Subtotal:            subtotal,
			DiscountAmount:      manualDiscount,
			ManualDiscount:      manualDiscount,
			PromotionID:         req.PromotionID,
			PromotionDiscount:   promoDiscount,
			ShippingFee:         shippingFee,
			PlatformFeeDiscount: 0,
			Surcharge:           surcharge,
			TotalAmount:         totalAmount,
			FundID:              fund.ID,
			CreatedBy:           cashierName,
			CashierID:           cashierIDPtr,
			CashierName:         cashierName,
			Note:                orderNote,
			IsPriceOverridden:   isOrderOverridden,
			OverrideReason:      req.OverrideReason,
			IdempotencyKey:      idempKeyPtr,
			CreatedAt:           orderTime,
			UpdatedAt:           orderTime,
		}

		if isOrderOverridden {
			createdOrder.OverriddenByID = cashierIDPtr
			createdOrder.OverriddenByName = cashierName
			createdOrder.OverriddenAt = &orderTime
		}

		if err := tx.Create(&createdOrder).Error; err != nil {
			return fmt.Errorf("failed to create order: %w", err)
		}

		// 9. Insert Order Items linked to Order ID
		for i := range orderItems {
			orderItems[i].OrderID = createdOrder.ID
		}
		if err := tx.Create(&orderItems).Error; err != nil {
			return fmt.Errorf("failed to insert order items: %w", err)
		}

		// 10. Record Automated Inflow Transaction
		transaction := models.Transaction{
			FundID:           createdOrder.FundID,
			TransactionType:  models.TransactionTypeInflow,
			Category:         models.CategorySale,
			Amount:           totalAmount,
			ReferenceOrderID: &createdOrder.ID,
			Description:      fmt.Sprintf("POS Sale Order: %s", createdOrder.OrderCode),
			CreatedBy:        cashierName,
			CashierID:        cashierIDPtr,
			CashierName:      cashierName,
			CreatedAt:        orderTime,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return fmt.Errorf("failed to create sales transaction: %w", err)
		}

		// 11. Increment Fund Balance
		if err := tx.Model(&fund).Update("current_balance", gorm.Expr("current_balance + ?", totalAmount)).Error; err != nil {
			return fmt.Errorf("failed to update fund balance: %w", err)
		}

		// 12. Preload full relations for response
		if err := tx.Preload("Fund").Preload("Promotion").Preload("Items.Variant.Product").First(&createdOrder, createdOrder.ID).Error; err != nil {
			return err
		}

		// 13. Save Completed Idempotency Record
		if idempotencyKey != "" {
			respBytes, _ := json.Marshal(models.ResponseEnvelope{
				Status:  "success",
				Data:    createdOrder,
				Message: "Order created successfully",
			})
			if err := tx.Model(&models.IdempotencyRecord{}).Where("key = ?", idempotencyKey).Updates(map[string]interface{}{
				"status":        models.IdempotencyStatusCompleted,
				"resource_id":   createdOrder.ID,
				"response_code": http.StatusCreated,
				"response_body": string(respBytes),
			}).Error; err != nil {
				return fmt.Errorf("failed to complete idempotency record: %w", err)
			}
		}

		return nil
	})

	if txErr != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "ORDER_PROCESSING_FAILED", txErr.Error())
		return
	}

	if h.fundCache != nil {
		h.fundCache.Invalidate("funds:list")
	}

	// Trigger non-blocking real-time Google Sheets sync if enabled
	if h.sheetsSyncSvc != nil {
		go h.sheetsSyncSvc.AppendOrderRow(createdOrder)
	}

	models.SendSuccess(c, http.StatusCreated, createdOrder, "Order created successfully")
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
				Category:         models.CategoryOrderRefund,
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
