package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type OrderHandler struct {
	db *gorm.DB
}

func NewOrderHandler(db *gorm.DB) *OrderHandler {
	return &OrderHandler{db: db}
}

// ListOrders retrieves orders with loaded relations and optional filters
func (h *OrderHandler) ListOrders(c *gin.Context) {
	query := h.db.Model(&models.Order{}).Preload("Fund").Preload("Items.Variant")

	if fundIDStr := c.Query("fund_id"); fundIDStr != "" {
		if fundID, err := strconv.ParseUint(fundIDStr, 10, 32); err == nil {
			query = query.Where("fund_id = ?", fundID)
		}
	}

	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	orders := make([]models.Order, 0)
	if err := query.Order("created_at desc").Find(&orders).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve orders: "+err.Error())
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
	if err := h.db.Preload("Fund").Preload("Items.Variant").First(&order, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Order not found")
			return
		}
		models.SendInternalError(c, "Failed to retrieve order details")
		return
	}

	models.SendSuccess(c, http.StatusOK, order, "Order details retrieved successfully")
}

// CreateOrder processes cart items, calculates totals, creates order, logs automated transaction, and increments target fund balance
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

	// Generate Human-Readable Order Code e.g. ORD-20260811-153045
	now := time.Now()
	orderCode := fmt.Sprintf("ORD-%s-%04d", now.Format("20060102-150405"), now.Nanosecond()/100000)

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
		})
	}

	totalAmount := subtotal - req.DiscountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	order := models.Order{
		OrderCode:      orderCode,
		Status:         models.OrderStatusCompleted,
		Subtotal:       subtotal,
		DiscountAmount: req.DiscountAmount,
		TotalAmount:    totalAmount,
		FundID:         req.FundID,
		CreatedBy:      createdBy,
		CashierID:      cashierIDPtr,
		CashierName:    cashierName,
	}

	// Database Transaction to save order, insert items, update fund balance, AND log inflow transaction
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

		// 3. Insert Automated Inflow Transaction for Sale (include cashier attribution)
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
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}

		// 4. Update Fund Current Balance
		if err := tx.Model(&fund).Update("current_balance", gorm.Expr("current_balance + ?", totalAmount)).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Failed to process order transaction: "+err.Error())
		return
	}

	// Load order relations for response
	h.db.Preload("Fund").Preload("Items.Variant").First(&order, order.ID)

	models.SendSuccess(c, http.StatusCreated, order, "Order created successfully")
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
