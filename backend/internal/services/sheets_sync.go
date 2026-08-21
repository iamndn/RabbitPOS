package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Sheet Tab Constants
const (
	SheetTabSummary      = "📊 Báo Cáo Tổng Hợp"
	SheetTabOrderHistory = "🧾 Lịch Sử Đơn Hàng"
	SheetTabCashLedger   = "💸 Sổ Thu Chi"
	SheetTabFundAudit    = "💳 Đối Soát Sổ Quỹ"
	SheetTabMenuCOGS     = "🍹 Menu & Giá Vốn"
)

// SheetsConfig holds parsed Google Sheets synchronization settings
type SheetsConfig struct {
	SyncEnabled        bool   `json:"sync_enabled"`
	SpreadsheetID      string `json:"spreadsheet_id"`
	ServiceAccountJSON string `json:"service_account_json"`
	AutoRealtimeSync   bool   `json:"auto_realtime_sync"`
	LastSyncedAt       string `json:"last_synced_at"`
	LastSyncStatus     string `json:"last_sync_status"` // 'idle', 'success', 'error'
	LastSyncError      string `json:"last_sync_error"`
}

// SheetsSyncStatusResponse returns current sync state and metadata
type SheetsSyncStatusResponse struct {
	SyncEnabled      bool   `json:"sync_enabled"`
	SpreadsheetID    string `json:"spreadsheet_id"`
	SpreadsheetURL   string `json:"spreadsheet_url"`
	AutoRealtimeSync bool   `json:"auto_realtime_sync"`
	LastSyncedAt     string `json:"last_synced_at"`
	LastSyncStatus   string `json:"last_sync_status"`
	LastSyncError    string `json:"last_sync_error"`
	Configured       bool   `json:"configured"`
}

// TestConnectionResult holds the verification response
type TestConnectionResult struct {
	SpreadsheetTitle string   `json:"spreadsheet_title"`
	SpreadsheetID    string   `json:"spreadsheet_id"`
	SpreadsheetURL   string   `json:"spreadsheet_url"`
	SheetCount       int      `json:"sheet_count"`
	Sheets           []string `json:"sheets"`
	Message          string   `json:"message"`
}

// SheetsSyncService manages Google Sheets synchronization operations
type SheetsSyncService struct {
	db      *gorm.DB
	syncMux sync.Mutex
}

// NewSheetsSyncService instantiates a new SheetsSyncService
func NewSheetsSyncService(db *gorm.DB) *SheetsSyncService {
	return &SheetsSyncService{db: db}
}

// GetConfig reads Google Sheets configuration key-value pairs from database
func (s *SheetsSyncService) GetConfig() (*SheetsConfig, error) {
	if s.db == nil {
		return nil, errors.New("database connection is unavailable")
	}

	var settings []models.Setting
	keys := []string{
		"google_sheets_sync_enabled",
		"google_sheets_spreadsheet_id",
		"google_sheets_service_account_json",
		"google_sheets_auto_realtime_sync",
		"google_sheets_last_synced_at",
		"google_sheets_last_sync_status",
		"google_sheets_last_sync_error",
	}

	if err := s.db.Where("key IN ?", keys).Find(&settings).Error; err != nil {
		return nil, err
	}

	cfg := &SheetsConfig{
		SyncEnabled:      false,
		SpreadsheetID:    "",
		ServiceAccountJSON: "",
		AutoRealtimeSync: true,
		LastSyncedAt:     "",
		LastSyncStatus:   "idle",
		LastSyncError:    "",
	}

	for _, st := range settings {
		switch st.Key {
		case "google_sheets_sync_enabled":
			cfg.SyncEnabled = strings.ToLower(strings.TrimSpace(st.Value)) == "true"
		case "google_sheets_spreadsheet_id":
			cfg.SpreadsheetID = strings.TrimSpace(st.Value)
		case "google_sheets_service_account_json":
			cfg.ServiceAccountJSON = strings.TrimSpace(st.Value)
		case "google_sheets_auto_realtime_sync":
			cfg.AutoRealtimeSync = strings.ToLower(strings.TrimSpace(st.Value)) != "false"
		case "google_sheets_last_synced_at":
			cfg.LastSyncedAt = st.Value
		case "google_sheets_last_sync_status":
			cfg.LastSyncStatus = st.Value
		case "google_sheets_last_sync_error":
			cfg.LastSyncError = st.Value
		}
	}

	return cfg, nil
}

// IsSyncEnabled checks if Google Sheets sync is currently active
func (s *SheetsSyncService) IsSyncEnabled() bool {
	cfg, err := s.GetConfig()
	if err != nil {
		return false
	}
	return cfg.SyncEnabled && cfg.SpreadsheetID != "" && cfg.ServiceAccountJSON != ""
}

// IsAutoRealtimeSyncEnabled checks if realtime event appending is enabled
func (s *SheetsSyncService) IsAutoRealtimeSyncEnabled() bool {
	cfg, err := s.GetConfig()
	if err != nil {
		return false
	}
	return cfg.SyncEnabled && cfg.AutoRealtimeSync && cfg.SpreadsheetID != "" && cfg.ServiceAccountJSON != ""
}

// GetStatus returns the current synchronization state
func (s *SheetsSyncService) GetStatus() (*SheetsSyncStatusResponse, error) {
	cfg, err := s.GetConfig()
	if err != nil {
		return nil, err
	}

	configured := cfg.SpreadsheetID != "" && cfg.ServiceAccountJSON != ""
	spreadsheetURL := ""
	if cfg.SpreadsheetID != "" {
		spreadsheetURL = fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s", cfg.SpreadsheetID)
	}

	return &SheetsSyncStatusResponse{
		SyncEnabled:      cfg.SyncEnabled,
		SpreadsheetID:    cfg.SpreadsheetID,
		SpreadsheetURL:   spreadsheetURL,
		AutoRealtimeSync: cfg.AutoRealtimeSync,
		LastSyncedAt:     cfg.LastSyncedAt,
		LastSyncStatus:   cfg.LastSyncStatus,
		LastSyncError:    cfg.LastSyncError,
		Configured:       configured,
	}, nil
}

// updateSyncStatus atomically updates the sync timestamp and status in settings table
func (s *SheetsSyncService) updateSyncStatus(status, errorMsg string) {
	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")

	updates := map[string]string{
		"google_sheets_last_sync_status": status,
		"google_sheets_last_sync_error":  errorMsg,
	}
	if status == "success" {
		updates["google_sheets_last_synced_at"] = nowStr
	}

	_ = s.db.Transaction(func(tx *gorm.DB) error {
		for k, v := range updates {
			setting := models.Setting{
				Key:       k,
				Value:     v,
				UpdatedAt: now,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
			}).Create(&setting).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// getClient initializes the Google Sheets API client using Service Account credentials JSON
func (s *SheetsSyncService) getClient(ctx context.Context, credentialsJSON string) (*sheets.Service, error) {
	if credentialsJSON == "" {
		return nil, errors.New("service account JSON credentials are missing")
	}

	srv, err := sheets.NewService(ctx, option.WithCredentialsJSON([]byte(credentialsJSON)))
	if err != nil {
		return nil, fmt.Errorf("failed to create Google Sheets client: %w", err)
	}

	return srv, nil
}

// EnsureSheetsLayout checks if the required tabs exist; creates any missing tabs with styled header rows
func (s *SheetsSyncService) EnsureSheetsLayout(ctx context.Context, srv *sheets.Service, spreadsheetID string) error {
	resp, err := srv.Spreadsheets.Get(spreadsheetID).Context(ctx).Do()
	if err != nil {
		return fmt.Errorf("failed to get spreadsheet metadata: %w", err)
	}

	existingTabs := make(map[string]int64)
	for _, sheet := range resp.Sheets {
		if sheet.Properties != nil {
			existingTabs[sheet.Properties.Title] = sheet.Properties.SheetId
		}
	}

	requiredTabs := []struct {
		Title   string
		Headers []interface{}
	}{
		{
			Title: SheetTabSummary,
			Headers: []interface{}{
				"Chỉ Số Tài Chính / Hoạt Động", "Giá Trị Kỳ Này (Tháng Này)", "Ghi Chú / Phân Tích",
			},
		},
		{
			Title: SheetTabOrderHistory,
			Headers: []interface{}{
				"Mã Đơn Hàng", "Ngày Giờ", "Thu Ngân", "Phương Thức Thanh Toán", "Trạng Thái",
				"Chi Tiết Món & Topping", "Ghi Chú", "Tổng Tiền Món (VNĐ)", "Giảm Giá",
				"Chiết Khấu Sàn", "Phí Vận Chuyển", "Phụ Thu", "Thực Thu (VNĐ)",
			},
		},
		{
			Title: SheetTabCashLedger,
			Headers: []interface{}{
				"Ngày Giờ", "Loại Giao Dịch", "Quỹ Tiền", "Danh Mục", "Số Tiền (VNĐ)", "Ghi Chú", "Thu Ngân Thực Hiện",
			},
		},
		{
			Title: SheetTabFundAudit,
			Headers: []interface{}{
				"Tên Quỹ", "Loại Quỹ", "Số Dư Đầu Kỳ", "Tổng Thu Vào", "Tổng Chi Ra",
				"Số Dư Cuối Kỳ (Tháng Này)", "Số Dư Kỳ Trước", "Tăng Trưởng (%)",
			},
		},
		{
			Title: SheetTabMenuCOGS,
			Headers: []interface{}{
				"Tên Món", "Danh Mục", "Biến Thể / Size", "Giá Vốn COGS (VNĐ)", "Giá Bán Lẻ (VNĐ)",
				"Biên LN Gộp (%)", "Trạng Thái Bán",
			},
		},
	}

	var requests []*sheets.Request

	// Add missing tabs
	for _, tab := range requiredTabs {
		if _, exists := existingTabs[tab.Title]; !exists {
			requests = append(requests, &sheets.Request{
				AddSheet: &sheets.AddSheetRequest{
					Properties: &sheets.SheetProperties{
						Title: tab.Title,
						GridProperties: &sheets.GridProperties{
							FrozenRowCount: 1,
						},
					},
				},
			})
		}
	}

	if len(requests) > 0 {
		batchReq := &sheets.BatchUpdateSpreadsheetRequest{
			Requests: requests,
		}
		res, err := srv.Spreadsheets.BatchUpdate(spreadsheetID, batchReq).Context(ctx).Do()
		if err != nil {
			return fmt.Errorf("failed to create missing sheet tabs: %w", err)
		}

		// Update existingTabs map with new sheet IDs
		for _, reply := range res.Replies {
			if reply.AddSheet != nil && reply.AddSheet.Properties != nil {
				existingTabs[reply.AddSheet.Properties.Title] = reply.AddSheet.Properties.SheetId
			}
		}
	}

	// Apply header styles and write initial headers for any tab that needs them
	var styleRequests []*sheets.Request
	for _, tab := range requiredTabs {
		sheetID, ok := existingTabs[tab.Title]
		if !ok {
			continue
		}

		// Header styling: Dark background, bold white text, centered alignment
		styleRequests = append(styleRequests, &sheets.Request{
			RepeatCell: &sheets.RepeatCellRequest{
				Range: &sheets.GridRange{
					SheetId:          sheetID,
					StartRowIndex:    0,
					EndRowIndex:      1,
					StartColumnIndex: 0,
					EndColumnIndex:   int64(len(tab.Headers)),
				},
				Cell: &sheets.CellData{
					UserEnteredFormat: &sheets.CellFormat{
						BackgroundColor: &sheets.Color{
							Red:   0.11,
							Green: 0.23,
							Blue:  0.44, // Elegant dark navy blue
						},
						TextFormat: &sheets.TextFormat{
							Bold:            true,
							FontSize:        11,
							ForegroundColor: &sheets.Color{Red: 1.0, Green: 1.0, Blue: 1.0},
						},
						HorizontalAlignment: "CENTER",
						VerticalAlignment:   "MIDDLE",
					},
				},
				Fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
			},
		})
	}

	if len(styleRequests) > 0 {
		_, _ = srv.Spreadsheets.BatchUpdate(spreadsheetID, &sheets.BatchUpdateSpreadsheetRequest{
			Requests: styleRequests,
		}).Context(ctx).Do()
	}

	return nil
}

// TestConnection tests read and write access to the target Google Spreadsheet
func (s *SheetsSyncService) TestConnection(ctx context.Context, credentialsJSON, spreadsheetID string) (*TestConnectionResult, error) {
	if credentialsJSON == "" || spreadsheetID == "" {
		// Fallback to configured settings if not provided
		cfg, err := s.GetConfig()
		if err != nil {
			return nil, err
		}
		if credentialsJSON == "" {
			credentialsJSON = cfg.ServiceAccountJSON
		}
		if spreadsheetID == "" {
			spreadsheetID = cfg.SpreadsheetID
		}
	}

	if credentialsJSON == "" {
		return nil, errors.New("vui lòng nhập hoặc tải lên tệp JSON Service Account")
	}
	if spreadsheetID == "" {
		return nil, errors.New("vui lòng nhập Google Spreadsheet ID")
	}

	srv, err := s.getClient(ctx, credentialsJSON)
	if err != nil {
		return nil, err
	}

	// Fetch Spreadsheet metadata
	meta, err := srv.Spreadsheets.Get(spreadsheetID).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối đến Google Sheets (kiểm tra quyền Editor của Service Account): %w", err)
	}

	// Ensure layout tabs exist
	if err := s.EnsureSheetsLayout(ctx, srv, spreadsheetID); err != nil {
		return nil, fmt.Errorf("không thể khởi tạo các trang tính chuẩn: %w", err)
	}

	// Refresh metadata to get updated tabs list
	meta, _ = srv.Spreadsheets.Get(spreadsheetID).Context(ctx).Do()

	sheetNames := make([]string, 0)
	if meta.Sheets != nil {
		for _, sh := range meta.Sheets {
			if sh.Properties != nil {
				sheetNames = append(sheetNames, sh.Properties.Title)
			}
		}
	}

	spreadsheetURL := fmt.Sprintf("https://docs.google.com/spreadsheets/d/%s", spreadsheetID)

	return &TestConnectionResult{
		SpreadsheetTitle: meta.Properties.Title,
		SpreadsheetID:    spreadsheetID,
		SpreadsheetURL:   spreadsheetURL,
		SheetCount:       len(sheetNames),
		Sheets:           sheetNames,
		Message:          fmt.Sprintf("Kết nối thành công tới bảng tính '%s' (%d trang tính)", meta.Properties.Title, len(sheetNames)),
	}, nil
}

// AppendOrderRow appends a single formatted order record to '🧾 Lịch Sử Đơn Hàng' tab
func (s *SheetsSyncService) AppendOrderRow(order models.Order) {
	if !s.IsAutoRealtimeSyncEnabled() {
		return
	}

	cfg, err := s.GetConfig()
	if err != nil || cfg.SpreadsheetID == "" || cfg.ServiceAccountJSON == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	srv, err := s.getClient(ctx, cfg.ServiceAccountJSON)
	if err != nil {
		log.Printf("[GoogleSheets] AppendOrderRow getClient error: %v", err)
		return
	}

	// Load order relations if missing
	if order.Fund == nil || len(order.Items) == 0 {
		var fullOrder models.Order
		if err := s.db.Preload("Fund").Preload("Promotion").Preload("Items.Variant.Product").First(&fullOrder, order.ID).Error; err == nil {
			order = fullOrder
		}
	}

	// Format item and topping detail string
	var itemSummaries []string
	for _, it := range order.Items {
		variantName := "Món"
		if it.Variant != nil {
			if it.Variant.Product != nil && it.Variant.Product.Name != "" {
				if it.Variant.VariantName != "" && it.Variant.VariantName != "Default" && it.Variant.VariantName != it.Variant.Product.Name {
					variantName = fmt.Sprintf("%s (%s)", it.Variant.Product.Name, it.Variant.VariantName)
				} else {
					variantName = it.Variant.Product.Name
				}
			} else if it.Variant.VariantName != "" {
				variantName = it.Variant.VariantName
			}
		}
		itemDesc := fmt.Sprintf("%s (x%d)", variantName, it.Quantity)

		var toppings []models.ToppingSnapshot
		if it.SelectedToppings != "" && it.SelectedToppings != "[]" {
			_ = json.Unmarshal([]byte(it.SelectedToppings), &toppings)
		}

		if len(toppings) > 0 {
			var topNames []string
			for _, tp := range toppings {
				topNames = append(topNames, tp.Name)
			}
			itemDesc += fmt.Sprintf(" [%s]", strings.Join(topNames, ", "))
		}

		if it.Notes != "" {
			itemDesc += fmt.Sprintf(" (%s)", it.Notes)
		}
		itemSummaries = append(itemSummaries, itemDesc)
	}

	itemsDetail := strings.Join(itemSummaries, "; ")

	fundName := "Khác"
	if order.Fund != nil {
		fundName = order.Fund.Name
	}

	statusStr := "Hoàn thành"
	if order.Status == models.OrderStatusCancelled {
		statusStr = "Đã hủy"
		if order.CancelReason != "" {
			statusStr += fmt.Sprintf(" (%s)", order.CancelReason)
		}
	}

	noteStr := ""
	if order.Note != nil {
		noteStr = *order.Note
	}

	cashierStr := order.CashierName
	if cashierStr == "" {
		cashierStr = order.CreatedBy
	}

	row := []interface{}{
		order.OrderCode,
		order.CreatedAt.Format("2006-01-02 15:04:05"),
		cashierStr,
		fundName,
		statusStr,
		itemsDetail,
		noteStr,
		order.Subtotal,
		order.DiscountAmount + order.PromotionDiscount,
		order.PlatformFeeDiscount,
		order.ShippingFee,
		order.Surcharge,
		order.TotalAmount,
	}

	rangeName := fmt.Sprintf("'%s'!A:M", SheetTabOrderHistory)
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = srv.Spreadsheets.Values.Append(cfg.SpreadsheetID, rangeName, valueRange).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Context(ctx).
		Do()

	if err != nil {
		log.Printf("[GoogleSheets] Failed to append order %s to sheet: %v", order.OrderCode, err)
	} else {
		log.Printf("[GoogleSheets] Order %s appended successfully to Google Sheet", order.OrderCode)
	}
}

// AppendTransactionRow appends a single formatted transaction record to '💸 Sổ Thu Chi' tab
func (s *SheetsSyncService) AppendTransactionRow(tx models.Transaction) {
	if !s.IsAutoRealtimeSyncEnabled() {
		return
	}

	cfg, err := s.GetConfig()
	if err != nil || cfg.SpreadsheetID == "" || cfg.ServiceAccountJSON == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	srv, err := s.getClient(ctx, cfg.ServiceAccountJSON)
	if err != nil {
		log.Printf("[GoogleSheets] AppendTransactionRow getClient error: %v", err)
		return
	}

	// Load fund if missing
	if tx.Fund == nil && tx.FundID > 0 {
		var fund models.Fund
		if err := s.db.First(&fund, tx.FundID).Error; err == nil {
			tx.Fund = &fund
		}
	}

	fundName := "Khác"
	if tx.Fund != nil {
		fundName = tx.Fund.Name
	}

	typeStr := "Chi tiền (Outflow)"
	if tx.TransactionType == models.TransactionTypeInflow {
		typeStr = "Thu tiền (Inflow)"
	}

	categoryLabels := map[string]string{
		"sale":                    "Doanh thu bán hàng POS",
		"ingredient_purchase":     "Mua nguyên vật liệu",
		"utility_bill":            "Chi phí vận hành / Hóa đơn",
		"reconciliation_variance": "Chênh lệch đối soát két",
		"other":                   "Chi phí khác",
	}
	categoryStr, ok := categoryLabels[string(tx.Category)]
	if !ok {
		categoryStr = string(tx.Category)
	}

	cashierStr := tx.CashierName
	if cashierStr == "" {
		cashierStr = tx.CreatedBy
	}

	row := []interface{}{
		tx.CreatedAt.Format("2006-01-02 15:04:05"),
		typeStr,
		fundName,
		categoryStr,
		tx.Amount,
		tx.Description,
		cashierStr,
	}

	rangeName := fmt.Sprintf("'%s'!A:G", SheetTabCashLedger)
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{row},
	}

	_, err = srv.Spreadsheets.Values.Append(cfg.SpreadsheetID, rangeName, valueRange).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Context(ctx).
		Do()

	if err != nil {
		log.Printf("[GoogleSheets] Failed to append transaction #%d to sheet: %v", tx.ID, err)
	} else {
		log.Printf("[GoogleSheets] Transaction #%d appended successfully to Google Sheet", tx.ID)
	}
}

// SyncAllToGoogleSheets executes full batch synchronization across all 5 operational & BI tabs
func (s *SheetsSyncService) SyncAllToGoogleSheets() error {
	s.syncMux.Lock()
	defer s.syncMux.Unlock()

	cfg, err := s.GetConfig()
	if err != nil {
		return err
	}
	if cfg.SpreadsheetID == "" || cfg.ServiceAccountJSON == "" {
		return errors.New("google Sheets chưa được cấu hình Spreadsheet ID hoặc Service Account JSON")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	srv, err := s.getClient(ctx, cfg.ServiceAccountJSON)
	if err != nil {
		s.updateSyncStatus("error", err.Error())
		return err
	}

	// 1. Ensure Layout & Tabs
	if err := s.EnsureSheetsLayout(ctx, srv, cfg.SpreadsheetID); err != nil {
		s.updateSyncStatus("error", err.Error())
		return err
	}

	// 2. Query All Operational Data
	var orders []models.Order
	if err := s.db.Preload("Fund").Preload("Items.Variant.Product").Order("created_at desc").Find(&orders).Error; err != nil {
		s.updateSyncStatus("error", "Lỗi truy vấn đơn hàng: "+err.Error())
		return err
	}

	var transactions []models.Transaction
	if err := s.db.Preload("Fund").Order("created_at desc").Find(&transactions).Error; err != nil {
		s.updateSyncStatus("error", "Lỗi truy vấn giao dịch: "+err.Error())
		return err
	}

	var products []models.Product
	if err := s.db.Preload("Category").Preload("Variants").Order("id asc").Find(&products).Error; err != nil {
		s.updateSyncStatus("error", "Lỗi truy vấn thực đơn: "+err.Error())
		return err
	}

	var funds []models.Fund
	if err := s.db.Order("id asc").Find(&funds).Error; err != nil {
		s.updateSyncStatus("error", "Lỗi truy vấn quỹ: "+err.Error())
		return err
	}

	// 3. Compute Executive Financial Aggregates (Current Month)
	now := time.Now()
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var grossSales, totalDiscounts, totalShipping, totalSurcharges, netRevenue float64
	var completedOrderCount int64

	for _, o := range orders {
		if o.CreatedAt.After(firstOfMonth) || o.CreatedAt.Equal(firstOfMonth) {
			if o.Status == models.OrderStatusCompleted {
				completedOrderCount++
				grossSales += o.Subtotal
				totalDiscounts += (o.DiscountAmount + o.PromotionDiscount + o.PlatformFeeDiscount)
				totalShipping += o.ShippingFee
				totalSurcharges += o.Surcharge
				netRevenue += o.TotalAmount
			}
		}
	}

	var aov float64 = 0
	if completedOrderCount > 0 {
		aov = netRevenue / float64(completedOrderCount)
	}

	// Query COGS for completed orders this month
	var totalCogs float64
	s.db.Raw(`
		SELECT COALESCE(SUM(pv.cogs_price * oi.quantity), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id
		JOIN product_variants pv ON pv.id = oi.product_variant_id
		WHERE o.status = 'completed' AND o.created_at >= ?
	`, firstOfMonth).Scan(&totalCogs)

	grossProfit := netRevenue - totalCogs
	var grossMarginPct float64 = 0
	if netRevenue > 0 {
		grossMarginPct = (grossProfit / netRevenue) * 100
	}

	// Operating expenses (Outflows this month excluding reconciliation variances)
	var operatingExpenses, otherInflow float64
	for _, tx := range transactions {
		if tx.CreatedAt.After(firstOfMonth) || tx.CreatedAt.Equal(firstOfMonth) {
			if tx.TransactionType == models.TransactionTypeOutflow && tx.Category != models.CategoryReconciliationVariance {
				operatingExpenses += tx.Amount
			} else if tx.TransactionType == models.TransactionTypeInflow && tx.Category != models.CategorySale && tx.Category != models.CategoryReconciliationVariance {
				otherInflow += tx.Amount
			}
		}
	}

	netProfit := grossProfit - operatingExpenses + otherInflow
	var netMarginPct float64 = 0
	if netRevenue > 0 {
		netMarginPct = (netProfit / netRevenue) * 100
	}

	var totalFundBalance float64
	for _, f := range funds {
		totalFundBalance += f.CurrentBalance
	}

	// --- 4. Build Data Values for 5 Tabs ---

	// Tab 1: 📊 Báo Cáo Tổng Hợp
	summaryValues := [][]interface{}{
		{"Chỉ Số Tài Chính / Hoạt Động", "Giá Trị Kỳ Này (Tháng Này)", "Ghi Chú / Phân Tích"},
		{"Doanh thu thuần (Net Revenue)", netRevenue, "Doanh thu thực nhận sau giảm giá + phụ thu"},
		{"Tổng giá bán món (Gross Sales)", grossSales, "Tổng tiền món nguyên giá trước chiết khấu"},
		{"Tổng chiết khấu & giảm giá", totalDiscounts, "Bao gồm giảm trực tiếp, khuyến mãi & sàn"},
		{"Tổng phí vận chuyển", totalShipping, "Thu từ khách hàng"},
		{"Tổng phụ thu dịch vụ", totalSurcharges, "Phụ thu ngày lễ / dịch vụ"},
		{"Tổng số đơn hoàn thành", completedOrderCount, "Đơn hàng trong tháng"},
		{"Giá trị đơn hàng trung bình (AOV)", aov, "VNĐ / Đơn"},
		{"Giá vốn hàng bán (COGS)", totalCogs, "Chi phí nguyên vật liệu món đã bán"},
		{"Lợi nhuận gộp (Gross Profit)", grossProfit, fmt.Sprintf("Biên LN gộp: %.1f%%", grossMarginPct)},
		{"Chi phí vận hành (OPEX)", operatingExpenses, "Mặt bằng, điện nước, nhân sự, chi phí khác"},
		{"Thu nhập khác", otherInflow, "Thu hồi, thanh lý tài sản"},
		{"Lợi nhuận ròng (Net Profit)", netProfit, fmt.Sprintf("Biên LN ròng: %.1f%%", netMarginPct)},
		{"Tổng số dư các quỹ tiền", totalFundBalance, fmt.Sprintf("Tổng cộng từ %d quỹ tiền", len(funds))},
		{"Thời gian cập nhật", now.Format("2006-01-02 15:04:05"), "Đồng bộ tự động từ RabbitPOS"},
	}

	// Tab 2: 🧾 Lịch Sử Đơn Hàng
	orderValues := [][]interface{}{
		{
			"Mã Đơn Hàng", "Ngày Giờ", "Thu Ngân", "Phương Thức Thanh Toán", "Trạng Thái",
			"Chi Tiết Món & Topping", "Ghi Chú", "Tổng Tiền Món (VNĐ)", "Giảm Giá",
			"Chiết Khấu Sàn", "Phí Vận Chuyển", "Phụ Thu", "Thực Thu (VNĐ)",
		},
	}
	for _, o := range orders {
		var itemSummaries []string
		for _, it := range o.Items {
			variantName := "Món"
			if it.Variant != nil {
				if it.Variant.Product != nil && it.Variant.Product.Name != "" {
					if it.Variant.VariantName != "" && it.Variant.VariantName != "Default" && it.Variant.VariantName != it.Variant.Product.Name {
						variantName = fmt.Sprintf("%s (%s)", it.Variant.Product.Name, it.Variant.VariantName)
					} else {
						variantName = it.Variant.Product.Name
					}
				} else if it.Variant.VariantName != "" {
					variantName = it.Variant.VariantName
				}
			}
			itemDesc := fmt.Sprintf("%s (x%d)", variantName, it.Quantity)

			var toppings []models.ToppingSnapshot
			if it.SelectedToppings != "" && it.SelectedToppings != "[]" {
				_ = json.Unmarshal([]byte(it.SelectedToppings), &toppings)
			}
			if len(toppings) > 0 {
				var topNames []string
				for _, tp := range toppings {
					topNames = append(topNames, tp.Name)
				}
				itemDesc += fmt.Sprintf(" [%s]", strings.Join(topNames, ", "))
			}
			if it.Notes != "" {
				itemDesc += fmt.Sprintf(" (%s)", it.Notes)
			}
			itemSummaries = append(itemSummaries, itemDesc)
		}

		fundName := "Khác"
		if o.Fund != nil {
			fundName = o.Fund.Name
		}

		statusStr := "Hoàn thành"
		if o.Status == models.OrderStatusCancelled {
			statusStr = "Đã hủy"
			if o.CancelReason != "" {
				statusStr += fmt.Sprintf(" (%s)", o.CancelReason)
			}
		}

		noteStr := ""
		if o.Note != nil {
			noteStr = *o.Note
		}

		cashierStr := o.CashierName
		if cashierStr == "" {
			cashierStr = o.CreatedBy
		}

		orderValues = append(orderValues, []interface{}{
			o.OrderCode,
			o.CreatedAt.Format("2006-01-02 15:04:05"),
			cashierStr,
			fundName,
			statusStr,
			strings.Join(itemSummaries, "; "),
			noteStr,
			o.Subtotal,
			o.DiscountAmount + o.PromotionDiscount,
			o.PlatformFeeDiscount,
			o.ShippingFee,
			o.Surcharge,
			o.TotalAmount,
		})
	}

	// Tab 3: 💸 Sổ Thu Chi
	txValues := [][]interface{}{
		{"Ngày Giờ", "Loại Giao Dịch", "Quỹ Tiền", "Danh Mục", "Số Tiền (VNĐ)", "Ghi Chú", "Thu Ngân Thực Hiện"},
	}
	categoryLabels := map[string]string{
		"sale":                    "Doanh thu bán hàng POS",
		"ingredient_purchase":     "Mua nguyên vật liệu",
		"utility_bill":            "Chi phí vận hành / Hóa đơn",
		"reconciliation_variance": "Chênh lệch đối soát két",
		"other":                   "Chi phí khác",
	}
	for _, tx := range transactions {
		fundName := "Khác"
		if tx.Fund != nil {
			fundName = tx.Fund.Name
		}

		typeStr := "Chi tiền (Outflow)"
		if tx.TransactionType == models.TransactionTypeInflow {
			typeStr = "Thu tiền (Inflow)"
		}

		catStr, ok := categoryLabels[string(tx.Category)]
		if !ok {
			catStr = string(tx.Category)
		}

		cashierStr := tx.CashierName
		if cashierStr == "" {
			cashierStr = tx.CreatedBy
		}

		txValues = append(txValues, []interface{}{
			tx.CreatedAt.Format("2006-01-02 15:04:05"),
			typeStr,
			fundName,
			catStr,
			tx.Amount,
			tx.Description,
			cashierStr,
		})
	}

	// Tab 4: 💳 Đối Soát Sổ Quỹ
	fundValues := [][]interface{}{
		{
			"Tên Quỹ", "Loại Quỹ", "Số Dư Đầu Kỳ", "Tổng Thu Vào", "Tổng Chi Ra",
			"Số Dư Cuối Kỳ (Tháng Này)", "Số Dư Kỳ Trước", "Tăng Trưởng (%)",
		},
	}
	for _, f := range funds {
		// Calculate inflows and outflows for this fund in the current month
		var inAmount, outAmount float64
		for _, tx := range transactions {
			if tx.FundID == f.ID && (tx.CreatedAt.After(firstOfMonth) || tx.CreatedAt.Equal(firstOfMonth)) {
				if tx.TransactionType == models.TransactionTypeInflow {
					inAmount += tx.Amount
				} else {
					outAmount += tx.Amount
				}
			}
		}

		openingBalance := f.CurrentBalance - inAmount + outAmount
		closingBalance := f.CurrentBalance

		var growthPct float64 = 0
		if openingBalance > 0 {
			growthPct = math.Round(((closingBalance-openingBalance)/openingBalance)*1000) / 10
		}

		fundTypeLabel := "Tiền mặt"
		if f.FundType == models.FundTypeBank {
			fundTypeLabel = "Ngân hàng / Chuyển khoản"
		} else if f.FundType == models.FundTypeEWallet {
			fundTypeLabel = "Ví điện tử"
		}

		fundValues = append(fundValues, []interface{}{
			f.Name,
			fundTypeLabel,
			openingBalance,
			inAmount,
			outAmount,
			closingBalance,
			openingBalance,
			growthPct,
		})
	}

	// Tab 5: 🍹 Menu & Giá Vốn
	menuValues := [][]interface{}{
		{
			"Tên Món", "Danh Mục", "Biến Thể / Size", "Giá Vốn COGS (VNĐ)", "Giá Bán Lẻ (VNĐ)",
			"Biên LN Gộp (%)", "Trạng Thái Bán",
		},
	}
	for _, p := range products {
		catName := "Chưa phân loại"
		if p.Category != nil {
			catName = p.Category.Name
		}

		for _, v := range p.Variants {
			var marginPct float64 = 0
			if v.RetailPrice > 0 {
				marginPct = math.Round(((v.RetailPrice-v.CogsPrice)/v.RetailPrice)*1000) / 10
			}

			statusStr := "Đang bán"
			if !p.IsActive || !v.IsActive {
				statusStr = "Ngừng bán"
			}

			menuValues = append(menuValues, []interface{}{
				p.Name,
				catName,
				v.VariantName,
				v.CogsPrice,
				v.RetailPrice,
				marginPct,
				statusStr,
			})
		}
	}

	// 5. Clear Old Values & Batch Update
	tabsToClear := []string{
		fmt.Sprintf("'%s'!A1:Z500", SheetTabSummary),
		fmt.Sprintf("'%s'!A1:Z100000", SheetTabOrderHistory),
		fmt.Sprintf("'%s'!A1:Z100000", SheetTabCashLedger),
		fmt.Sprintf("'%s'!A1:Z500", SheetTabFundAudit),
		fmt.Sprintf("'%s'!A1:Z5000", SheetTabMenuCOGS),
	}
	_, _ = srv.Spreadsheets.Values.BatchClear(cfg.SpreadsheetID, &sheets.BatchClearValuesRequest{
		Ranges: tabsToClear,
	}).Context(ctx).Do()

	batchUpdateReq := &sheets.BatchUpdateValuesRequest{
		ValueInputOption: "USER_ENTERED",
		Data: []*sheets.ValueRange{
			{
				Range:  fmt.Sprintf("'%s'!A1", SheetTabSummary),
				Values: summaryValues,
			},
			{
				Range:  fmt.Sprintf("'%s'!A1", SheetTabOrderHistory),
				Values: orderValues,
			},
			{
				Range:  fmt.Sprintf("'%s'!A1", SheetTabCashLedger),
				Values: txValues,
			},
			{
				Range:  fmt.Sprintf("'%s'!A1", SheetTabFundAudit),
				Values: fundValues,
			},
			{
				Range:  fmt.Sprintf("'%s'!A1", SheetTabMenuCOGS),
				Values: menuValues,
			},
		},
	}

	if _, err := srv.Spreadsheets.Values.BatchUpdate(cfg.SpreadsheetID, batchUpdateReq).Context(ctx).Do(); err != nil {
		s.updateSyncStatus("error", "Lỗi ghi dữ liệu Google Sheets: "+err.Error())
		return fmt.Errorf("failed to batch update Google Sheets: %w", err)
	}

	s.updateSyncStatus("success", "")
	log.Printf("[GoogleSheets] Batch sync completed successfully for spreadsheet %s", cfg.SpreadsheetID)
	return nil
}
