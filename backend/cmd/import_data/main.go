package main

import (
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
)

func main() {
	log.Println("Starting RabbitPOS historical orders & transactions import...")

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 1. Load users map
	var users []models.User
	db.Find(&users)
	userMap := make(map[string]models.User)
	for _, u := range users {
		userMap[strings.ToUpper(strings.TrimSpace(u.Username))] = u
	}

	// 2. Load funds map
	var funds []models.Fund
	db.Find(&funds)
	fundMap := make(map[string]models.Fund)
	var cashFund, bankFund models.Fund
	for _, f := range funds {
		fundMap[strings.ToLower(strings.TrimSpace(f.Name))] = f
		if f.FundType == models.FundTypeCash {
			cashFund = f
			fundMap["tiền mặt"] = f
			fundMap["cash"] = f
		} else if f.FundType == models.FundTypeBank {
			bankFund = f
			fundMap["chuyển khoản"] = f
			fundMap["bank"] = f
			fundMap["vietqr"] = f
		}
	}

	// 3. Load product & variants map
	var products []models.Product
	db.Preload("Variants").Find(&products)
	prodVariantMap := make(map[string]models.ProductVariant) // key: LOWER(prod_name + "_" + variant_name)
	prodFirstVariant := make(map[string]models.ProductVariant) // key: LOWER(prod_name) -> first variant

	for _, p := range products {
		pName := strings.ToLower(strings.TrimSpace(p.Name))
		for _, v := range p.Variants {
			vName := strings.ToLower(strings.TrimSpace(v.VariantName))
			key := pName + "_" + vName
			prodVariantMap[key] = v
			if _, ok := prodFirstVariant[pName]; !ok {
				prodFirstVariant[pName] = v
			}
		}
	}

	log.Printf("Loaded %d products with variants into memory", len(products))

	// Begin Transaction
	err = db.Transaction(func(tx *gorm.DB) error {
		// --- A. IMPORT ORDERS ---
		ordersFile, err := os.Open("/opt/RabbitPOS/backend/data/orders_raw.csv")
		if err != nil {
			return fmt.Errorf("failed to open orders_raw.csv: %w", err)
		}
		defer ordersFile.Close()

		r := csv.NewReader(ordersFile)
		r.TrimLeadingSpace = true
		r.LazyQuotes = true

		records, err := r.ReadAll()
		if err != nil {
			return fmt.Errorf("failed to read orders CSV: %w", err)
		}

		type OrderRow struct {
			OrderCode     string
			CreatedAt     time.Time
			Status        models.OrderStatus
			ProductName   string
			VariantName   string
			Quantity      int
			UnitPrice     float64
			ToppingsStr   string
			ToppingsPrice float64
			Discount      float64
			Shipping      float64
			Surcharge     float64
			TotalAmount   float64
			FundName      string
			CashierName   string
			Note          string
		}

		orderGroups := make(map[string][]OrderRow)
		var orderSeq []string

		for i, row := range records {
			if i == 0 || len(row) < 7 || strings.TrimSpace(row[0]) == "" {
				continue
			}

			orderCode := strings.TrimSpace(row[0])
			createdAt := parseTime(row[1])
			statusStr := strings.ToLower(strings.TrimSpace(row[2]))
			status := models.OrderStatusCompleted
			if statusStr == "cancelled" || strings.Contains(statusStr, "hủy") {
				status = models.OrderStatusCancelled
			}

			prodName := normalizeProductName(row[3])
			variantName := strings.TrimSpace(row[4])
			if variantName == "" {
				variantName = "Size M"
			}

			qty := parseInt(row[5])
			if qty <= 0 {
				qty = 1
			}

			unitPrice := parsePrice(row[6])
			toppingsStr := ""
			if len(row) > 7 {
				toppingsStr = strings.TrimSpace(row[7])
			}
			toppingsPrice := 0.0
			if len(row) > 8 && row[8] != "" {
				toppingsPrice = parsePrice(row[8])
			}
			discount := 0.0
			if len(row) > 9 && row[9] != "" {
				discount = parsePrice(row[9])
			}
			shipping := 0.0
			if len(row) > 10 && row[10] != "" {
				shipping = parsePrice(row[10])
			}
			surcharge := 0.0
			if len(row) > 11 && row[11] != "" {
				surcharge = parsePrice(row[11])
			}
			totalAmount := 0.0
			if len(row) > 12 && row[12] != "" {
				totalAmount = parsePrice(row[12])
			}
			fundName := "tiền mặt"
			if len(row) > 13 && strings.TrimSpace(row[13]) != "" {
				fundName = strings.TrimSpace(row[13])
			}
			cashierName := "NDN"
			if len(row) > 14 && strings.TrimSpace(row[14]) != "" {
				cashierName = strings.ToUpper(strings.TrimSpace(row[14]))
			}
			note := ""
			if len(row) > 15 {
				note = strings.TrimSpace(row[15])
			}

			if _, exists := orderGroups[orderCode]; !exists {
				orderSeq = append(orderSeq, orderCode)
			}
			orderGroups[orderCode] = append(orderGroups[orderCode], OrderRow{
				OrderCode:     orderCode,
				CreatedAt:     createdAt,
				Status:        status,
				ProductName:   prodName,
				VariantName:   variantName,
				Quantity:      qty,
				UnitPrice:     unitPrice,
				ToppingsStr:   toppingsStr,
				ToppingsPrice: toppingsPrice,
				Discount:      discount,
				Shipping:      shipping,
				Surcharge:     surcharge,
				TotalAmount:   totalAmount,
				FundName:      fundName,
				CashierName:   cashierName,
				Note:          note,
			})
		}

		ordersCount := 0
		orderItemsCount := 0
		saleInflowsCount := 0

		for _, oCode := range orderSeq {
			items := orderGroups[oCode]
			if len(items) == 0 {
				continue
			}

			firstItem := items[0]
			targetFund := cashFund
			if strings.Contains(strings.ToLower(firstItem.FundName), "chuyển") || strings.Contains(strings.ToLower(firstItem.FundName), "bank") {
				targetFund = bankFund
			}

			var cashierIDPtr *uint
			if u, ok := userMap[firstItem.CashierName]; ok {
				cashierIDPtr = &u.ID
			}

			var subtotal float64
			var orderItems []models.OrderItem

			for _, itm := range items {
				key := strings.ToLower(itm.ProductName) + "_" + strings.ToLower(itm.VariantName)
				variant, ok := prodVariantMap[key]
				if !ok {
					// Fallback to first variant of product
					if fv, okF := prodFirstVariant[strings.ToLower(itm.ProductName)]; okF {
						variant = fv
					} else {
						log.Printf("[WARN] Unknown product variant: '%s' / '%s' for order %s", itm.ProductName, itm.VariantName, oCode)
						// Create placeholder variant if needed
						var p models.Product
						if err := tx.Where("LOWER(name) = LOWER(?)", itm.ProductName).First(&p).Error; err != nil {
							p = models.Product{CategoryID: 1, Name: itm.ProductName, IsActive: true}
							_ = tx.Create(&p).Error
						}
						newV := models.ProductVariant{ProductID: p.ID, VariantName: itm.VariantName, RetailPrice: itm.UnitPrice, IsActive: true}
						_ = tx.Create(&newV).Error
						variant = newV
						prodVariantMap[key] = variant
					}
				}

				lineTotal := (itm.UnitPrice * float64(itm.Quantity)) + itm.ToppingsPrice
				subtotal += lineTotal

				orderItems = append(orderItems, models.OrderItem{
					ProductVariantID: variant.ID,
					Quantity:         itm.Quantity,
					UnitPrice:        itm.UnitPrice,
					LineTotal:        lineTotal,
					SelectedToppings: "[]",
					ToppingsPrice:    itm.ToppingsPrice,
					CreatedAt:        itm.CreatedAt,
					UpdatedAt:        itm.CreatedAt,
				})
			}

			calcTotal := subtotal - firstItem.Discount + firstItem.Shipping + firstItem.Surcharge
			if firstItem.TotalAmount > 0 {
				calcTotal = firstItem.TotalAmount
			}

			var notePtr *string
			if firstItem.Note != "" {
				notePtr = &firstItem.Note
			}

			order := models.Order{
				OrderCode:      oCode,
				Status:         firstItem.Status,
				Subtotal:       subtotal,
				DiscountAmount: firstItem.Discount,
				ShippingFee:    firstItem.Shipping,
				Surcharge:      firstItem.Surcharge,
				TotalAmount:    calcTotal,
				FundID:         targetFund.ID,
				CreatedBy:      firstItem.CashierName,
				CashierID:      cashierIDPtr,
				CashierName:    firstItem.CashierName,
				Note:           notePtr,
				CreatedAt:      firstItem.CreatedAt,
				UpdatedAt:      firstItem.CreatedAt,
			}

			if err := tx.Create(&order).Error; err != nil {
				return fmt.Errorf("failed to create order %s: %w", oCode, err)
			}
			ordersCount++

			for i := range orderItems {
				orderItems[i].OrderID = order.ID
				if err := tx.Create(&orderItems[i]).Error; err != nil {
					return fmt.Errorf("failed to create order item: %w", err)
				}
				orderItemsCount++
			}

			// If completed, record automated sale inflow transaction and adjust fund balance
			if order.Status == models.OrderStatusCompleted && order.TotalAmount > 0 {
				saleTx := models.Transaction{
					FundID:           order.FundID,
					TransactionType:  models.TransactionTypeInflow,
					Category:         models.CategorySale,
					Amount:           order.TotalAmount,
					ReferenceOrderID: &order.ID,
					Description:      fmt.Sprintf("POS Sale Order: %s", order.OrderCode),
					CreatedBy:        order.CashierName,
					CashierID:        order.CashierID,
					CashierName:      order.CashierName,
					CreatedAt:        order.CreatedAt,
				}
				if err := tx.Create(&saleTx).Error; err != nil {
					return fmt.Errorf("failed to create sale transaction for order %s: %w", oCode, err)
				}
				saleInflowsCount++

				// Increment fund balance
				tx.Model(&models.Fund{}).Where("id = ?", order.FundID).UpdateColumn("current_balance", gorm.Expr("current_balance + ?", order.TotalAmount))
			}
		}

		log.Printf("Successfully imported %d orders (%d items, %d sales inflows)", ordersCount, orderItemsCount, saleInflowsCount)

		// --- B. IMPORT EXPENSES / TRANSACTIONS ---
		txFile, err := os.Open("/opt/RabbitPOS/backend/data/transactions_raw.csv")
		if err != nil {
			return fmt.Errorf("failed to open transactions_raw.csv: %w", err)
		}
		defer txFile.Close()

		rTx := csv.NewReader(txFile)
		rTx.TrimLeadingSpace = true
		rTx.LazyQuotes = true

		txRecords, err := rTx.ReadAll()
		if err != nil {
			return fmt.Errorf("failed to read transactions CSV: %w", err)
		}

		expenseCount := 0
		for i, row := range txRecords {
			if i == 0 || len(row) < 4 || strings.TrimSpace(row[0]) == "" {
				continue
			}

			createdAt := parseTime(row[0])
			txTypeStr := strings.ToLower(strings.TrimSpace(row[1]))
			txType := models.TransactionTypeOutflow
			if strings.Contains(txTypeStr, "thu") || strings.Contains(txTypeStr, "inflow") {
				txType = models.TransactionTypeInflow
			}

			catName := normalizeCategoryName(row[2])
			amount := parsePrice(row[3])
			if amount <= 0 {
				continue
			}

			fundName := "tiền mặt"
			if len(row) > 4 && strings.TrimSpace(row[4]) != "" {
				fundName = strings.TrimSpace(row[4])
			}
			targetFund := cashFund
			if strings.Contains(strings.ToLower(fundName), "chuyển") || strings.Contains(strings.ToLower(fundName), "bank") {
				targetFund = bankFund
			}

			cashierName := "NDN"
			if len(row) > 5 && strings.TrimSpace(row[5]) != "" {
				cashierName = strings.ToUpper(strings.TrimSpace(row[5]))
			}
			var cashierIDPtr *uint
			if u, ok := userMap[cashierName]; ok {
				cashierIDPtr = &u.ID
			}

			desc := ""
			if len(row) > 6 {
				desc = strings.TrimSpace(row[6])
			}

			// Ensure transaction category exists
			var txCat models.TransactionCategoryItem
			if err := tx.Where("LOWER(name) = LOWER(?)", catName).First(&txCat).Error; err != nil {
				txCat = models.TransactionCategoryItem{
					Name:     catName,
					Type:     string(txType),
					IsSystem: false,
				}
				_ = tx.Create(&txCat).Error
			}

			transaction := models.Transaction{
				FundID:          targetFund.ID,
				TransactionType: txType,
				Category:        models.TransactionCategory(catName),
				Amount:          amount,
				Description:     desc,
				CreatedBy:       cashierName,
				CashierID:       cashierIDPtr,
				CashierName:     cashierName,
				CreatedAt:       createdAt,
			}

			if err := tx.Create(&transaction).Error; err != nil {
				return fmt.Errorf("failed to create transaction row %d: %w", i+1, err)
			}
			expenseCount++

			// Deduct or add from fund balance
			if txType == models.TransactionTypeInflow {
				tx.Model(&models.Fund{}).Where("id = ?", targetFund.ID).UpdateColumn("current_balance", gorm.Expr("current_balance + ?", amount))
			} else {
				tx.Model(&models.Fund{}).Where("id = ?", targetFund.ID).UpdateColumn("current_balance", gorm.Expr("current_balance - ?", amount))
			}
		}

		log.Printf("Successfully imported %d manual expense/ledger transactions", expenseCount)

		// Reset Postgres Sequences
		tables := []string{
			"categories", "products", "product_variants", "variant_groups",
			"toppings", "funds", "transaction_categories", "transactions",
			"orders", "order_items",
		}
		for _, tbl := range tables {
			tx.Exec(fmt.Sprintf(
				"SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1), (SELECT MAX(id) IS NOT NULL FROM %s));",
				tbl, tbl, tbl,
			))
		}

		return nil
	})

	if err != nil {
		log.Fatalf("Data import failed: %v", err)
	}

	log.Println("✅ ALL ORDERS AND TRANSACTIONS SUCCESSFULLY IMPORTED!")
}

func parseTime(val string) time.Time {
	val = strings.TrimSpace(val)
	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, val); err == nil {
			return t
		}
	}
	return time.Now()
}

func parsePrice(val string) float64 {
	clean := strings.ReplaceAll(val, "đ", "")
	clean = strings.ReplaceAll(clean, "VND", "")
	clean = strings.ReplaceAll(clean, "vnd", "")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.ReplaceAll(clean, "\"", "")
	clean = strings.TrimSpace(clean)

	p, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0.0
	}
	return p
}

func parseInt(val string) int {
	clean := strings.TrimSpace(val)
	i, err := strconv.Atoi(clean)
	if err != nil {
		if f, err := strconv.ParseFloat(clean, 64); err == nil {
			return int(f)
		}
		return 0
	}
	return i
}

func normalizeProductName(val string) string {
	val = strings.TrimSpace(val)
	upper := strings.ToUpper(val)

	// Exact and pattern mappings
	replacements := map[string]string{
		"TÁO + LÊ":       "TÁO + LÊ",
		"T?O + L?":       "TÁO + LÊ",
		"TO + L":         "TÁO + LÊ",
		"LỰU + TÁO":      "LỰU + TÁO",
		"L?U + T?O":      "LỰU + TÁO",
		"L?U + TO":       "LỰU + TÁO",
		"LỰU":            "LỰU",
		"L?U":            "LỰU",
		"CAM":            "CAM",
		"DỨA":            "DỨA",
		"D?A":            "DỨA",
		"ỔI":             "ỔI",
		"?I":             "ỔI",
		"LÊ":             "LÊ",
		"L":              "LÊ",
		"L?":             "LÊ",
		"DƯA HẤU":        "DƯA HẤU",
		"D?A H?U":        "DƯA HẤU",
		"CÀ PHÊ MUỐI":    "CÀ PHÊ MUỐI",
		"C? PH? MU?I":    "CÀ PHÊ MUỐI",
		"C PH MU?I":      "CÀ PHÊ MUỐI",
		"CÀ PHÊ SỮA":     "CÀ PHÊ SỮA",
		"C? PH? S?A":     "CÀ PHÊ SỮA",
		"C PH S?A":       "CÀ PHÊ SỮA",
		"CÀ PHÊ ĐEN":     "CÀ PHÊ ĐEN",
		"C? PH? ?EN":     "CÀ PHÊ ĐEN",
		"C PH ?EN":       "CÀ PHÊ ĐEN",
		"ỔI + DỨA":       "ỔI + DỨA",
		"?I + D?A":       "ỔI + DỨA",
		"DỨA + CAM":      "DỨA + CAM",
		"D?A + CAM":      "DỨA + CAM",
		"ỔI + CÓC":       "ỔI + CÓC",
		"?I + C?C":       "ỔI + CÓC",
		"?I + CC":        "ỔI + CÓC",
		"CÓC":            "CÓC",
		"C?C":            "CÓC",
		"CC":             "CÓC",
		"DƯA VÀNG":       "DƯA VÀNG",
		"D?A V?NG":       "DƯA VÀNG",
		"D?A VNG":        "DƯA VÀNG",
		"CAM + CÀ RỐT":   "CAM + CÀ RỐT",
		"CAM + C? R?T":   "CAM + CÀ RỐT",
		"CAM + C R?T":    "CAM + CÀ RỐT",
		"LỰU + DỨA":      "LỰU + DỨA",
		"L?U + D?A":      "LỰU + DỨA",
		"DỨA + TÁO":      "DỨA + TÁO",
		"D?A + T?O":      "DỨA + TÁO",
		"D?A + TO":       "DỨA + TÁO",
		"ỔI + TÁO":       "ỔI + TÁO",
		"?I + T?O":       "ỔI + TÁO",
		"?I + TO":        "ỔI + TÁO",
		"LỰU + CAM":      "LỰU + CAM",
		"L?U + CAM":      "LỰU + CAM",
		"CÓC + TÁO":      "CÓC + TÁO",
		"C?C + T?O":      "CÓC + TÁO",
		"CC + TO":        "CÓC + TÁO",
		"TÁO":            "TÁO",
		"T?O":            "TÁO",
		"TO":             "TÁO",
		"DƯA HẤU + TÁO":  "DƯA HẤU + TÁO",
		"D?A H?U + T?O":  "DƯA HẤU + TÁO",
		"D?A H?U + TO":   "DƯA HẤU + TÁO",
		"CÓC + DỨA":      "CÓC + DỨA",
		"C?C + D?A":      "CÓC + DỨA",
		"CC + D?A":       "CÓC + DỨA",
		"TÁO + CÀ RỐT":   "TÁO + CÀ RỐT",
		"T?O + C? R?T":   "TÁO + CÀ RỐT",
		"TO + C R?T":     "TÁO + CÀ RỐT",
		"DƯA HẤU + DỨA":  "DƯA HẤU + DỨA",
		"D?A H?U + D?A":  "DƯA HẤU + DỨA",
		"DƯA VÀNG + TÁO": "DƯA VÀNG + TÁO",
		"D?A V?NG + T?O": "DƯA VÀNG + TÁO",
		"D?A VNG + TO":   "DƯA VÀNG + TÁO",
		"DƯA VÀNG + LÊ":  "DƯA VÀNG + LÊ",
		"D?A V?NG + L?":  "DƯA VÀNG + LÊ",
		"D?A VNG + L":    "DƯA VÀNG + LÊ",
		"CÀ RỐT":         "CÀ RỐT",
		"C? R?T":         "CÀ RỐT",
		"C R?T":          "CÀ RỐT",
		"DƯA HẤU + CAM":  "DƯA HẤU + CAM",
		"D?A H?U + CAM":  "DƯA HẤU + CAM",
		"CAM + TÁO":      "CAM + TÁO",
		"CAM + T?O":      "CAM + TÁO",
		"CAM + TO":       "CAM + TÁO",
		"DỨA + CÀ RỐT":   "DỨA + CÀ RỐT",
		"D?A + C? R?T":   "DỨA + CÀ RỐT",
		"D?A + C R?T":    "DỨA + CÀ RỐT",
	}

	if match, ok := replacements[upper]; ok {
		return match
	}
	return val
}

func normalizeCategoryName(val string) string {
	val = strings.TrimSpace(val)
	upper := strings.ToUpper(val)

	if strings.Contains(upper, "NHẬP HÀNG") || strings.Contains(upper, "NH?P H") {
		return "Chi phí nhập hàng"
	}
	if strings.Contains(upper, "THIẾT BỊ") || strings.Contains(upper, "THI?T B") {
		return "Thiết bị, dụng cụ, phần mềm"
	}
	if strings.Contains(upper, "ĐIỆN") || strings.Contains(upper, "?I?N") {
		return "Điện, nước, internet"
	}
	if strings.Contains(upper, "ĐÁ") || strings.Contains(upper, "?") || upper == "ĐÁ" || upper == "?" {
		return "Tiền đá viên"
	}
	if strings.Contains(upper, "MARKETING") {
		return "Chi phí marketing"
	}
	if strings.Contains(upper, "THUÊ NHÀ") || strings.Contains(upper, "THU? NH") || strings.Contains(upper, "MẶT BẰNG") || strings.Contains(upper, "M?T B?NG") {
		return "Thuê nhà, mặt bằng, văn phòng"
	}
	return val
}
