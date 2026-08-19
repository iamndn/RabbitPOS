package services

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ImporterService struct {
	db *gorm.DB
}

func NewImporterService(db *gorm.DB) *ImporterService {
	return &ImporterService{db: db}
}

// GenerateExcelTemplate creates a professionally formatted sample Excel workbook
// with 5 sheets covering all system data domains with sample rows and guidelines.
func (s *ImporterService) GenerateExcelTemplate() ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()

	// Styles
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      &excelize.Fill{Type: "pattern", Color: []string{"4F46E5"}, Pattern: 1}, // Indigo
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
		Border: []excelize.Border{
			{Type: "left", Color: "CBD5E1", Style: 1},
			{Type: "top", Color: "CBD5E1", Style: 1},
			{Type: "bottom", Color: "CBD5E1", Style: 1},
			{Type: "right", Color: "CBD5E1", Style: 1},
		},
	})

	emeraldHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      &excelize.Fill{Type: "pattern", Color: []string{"059669"}, Pattern: 1}, // Emerald
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})

	amberHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      &excelize.Fill{Type: "pattern", Color: []string{"D97706"}, Pattern: 1}, // Amber
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})

	violetHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      &excelize.Fill{Type: "pattern", Color: []string{"7C3AED"}, Pattern: 1}, // Violet
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})

	roseHeaderStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11, Family: "Segoe UI"},
		Fill:      &excelize.Fill{Type: "pattern", Color: []string{"E11D48"}, Pattern: 1}, // Rose
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})

	// 1. SHEET 1: Danh Mục (Categories)
	sheet1 := "📁 Danh Mục"
	f.SetSheetName("Sheet1", sheet1)
	catHeaders := []string{"Mã Danh Mục", "Tên Danh Mục (*)", "Thứ Tự Hiển Thị", "Trạng Thái (Có/Không)", "Ảnh (URL)"}
	for colIdx, text := range catHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheet1, cell, text)
	}
	f.SetRowStyle(sheet1, 1, 1, headerStyle)
	f.SetRowHeight(sheet1, 1, 28)

	sampleCategories := [][]interface{}{
		{"CAT01", "Cà Phê", 1, "Có", ""},
		{"CAT02", "Trà Sữa & Trà Hoa Quả", 2, "Có", ""},
		{"CAT03", "Nước Ép & Sinh Tố", 3, "Có", ""},
		{"CAT04", "Đá Xay & Frappe", 4, "Có", ""},
		{"CAT05", "Bánh & Ăn Vặt", 5, "Có", ""},
	}
	for rowIdx, row := range sampleCategories {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet1, cell, val)
		}
	}
	f.SetColWidth(sheet1, "A", "A", 16)
	f.SetColWidth(sheet1, "B", "B", 28)
	f.SetColWidth(sheet1, "C", "C", 18)
	f.SetColWidth(sheet1, "D", "D", 22)
	f.SetColWidth(sheet1, "E", "E", 25)

	// 2. SHEET 2: Topping
	sheet2 := "🧋 Topping"
	f.NewSheet(sheet2)
	topHeaders := []string{"Tên Topping (*)", "Giá Bán (*)", "Giá Vốn (COGS)", "Danh Mục Áp Dụng (Để trống = Tất cả)", "Trạng Thái (Có/Không)"}
	for colIdx, text := range topHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheet2, cell, text)
	}
	f.SetRowStyle(sheet2, 1, 1, violetHeaderStyle)
	f.SetRowHeight(sheet2, 1, 28)

	sampleToppings := [][]interface{}{
		{"Trân Châu Trắng 3Q", 8000, 2500, "", "Có"},
		{"Thạch Đào Giòn", 8000, 2000, "Trà Sữa & Trà Hoa Quả", "Có"},
		{"Kem Cheese Macchiato", 10000, 3500, "", "Có"},
		{"Pudding Trứng", 8000, 2200, "Trà Sữa & Trà Hoa Quả", "Có"},
		{"Hạt Sen Huế", 10000, 4000, "", "Có"},
	}
	for rowIdx, row := range sampleToppings {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet2, cell, val)
		}
	}
	f.SetColWidth(sheet2, "A", "A", 28)
	f.SetColWidth(sheet2, "B", "B", 16)
	f.SetColWidth(sheet2, "C", "C", 18)
	f.SetColWidth(sheet2, "D", "D", 35)
	f.SetColWidth(sheet2, "E", "E", 22)

	// 3. SHEET 3: Sản Phẩm & Biến Thể (Products & Variants)
	sheet3 := "🍹 Sản Phẩm & Biến Thể"
	f.NewSheet(sheet3)
	prodHeaders := []string{"Tên Sản Phẩm (*)", "Danh Mục (*)", "Mô Tả", "Thẻ Tag (none/best_seller/new)", "Tên Biến Thể / Size (*)", "Mã SKU", "Giá Vốn (COGS)", "Giá Bán Lẻ (*)", "Trạng Thái (Có/Không)", "Ảnh (URL)"}
	for colIdx, text := range prodHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheet3, cell, text)
	}
	f.SetRowStyle(sheet3, 1, 1, emeraldHeaderStyle)
	f.SetRowHeight(sheet3, 1, 28)

	sampleProducts := [][]interface{}{
		{"Cà Phê Muối", "Cà Phê", "Cà phê pha phin truyền thống kèm lớp kem muối béo ngậy", "best_seller", "Size M", "CF-MUOI-M", 8000, 25000, "Có", ""},
		{"Cà Phê Muối", "Cà Phê", "Cà phê pha phin truyền thống kèm lớp kem muối béo ngậy", "best_seller", "Size L", "CF-MUOI-L", 10000, 30000, "Có", ""},
		{"Bạc Xỉu", "Cà Phê", "Nhiều sữa ít cà phê ngọt dịu", "none", "Size M", "BX-M", 7000, 25000, "Có", ""},
		{"Trà Đào Cam Sả", "Trà Sữa & Trà Hoa Quả", "Trà thanh mát kết hợp đào miếng tươi giòn và sả thơm", "best_seller", "Size M", "TDCS-M", 11000, 35000, "Có", ""},
		{"Trà Đào Cam Sả", "Trà Sữa & Trà Hoa Quả", "Trà thanh mát kết hợp đào miếng tươi giòn và sả thơm", "best_seller", "Size L", "TDCS-L", 13000, 42000, "Có", ""},
		{"Nước Ép Dưa Hấu", "Nước Ép & Sinh Tố", "100% dưa hấu tươi nguyên chất không đường hóa học", "new", "Mặc định", "NE-DH", 9000, 30000, "Có", ""},
		{"Sinh Tố Bơ Sáp", "Nước Ép & Sinh Tố", "Bơ sáp Đắk Lắk dẻo quánh xay cùng sữa đặc", "none", "Size M", "ST-BO-M", 15000, 40000, "Có", ""},
		{"Sinh Tố Bơ Sáp", "Nước Ép & Sinh Tố", "Bơ sáp Đắk Lắk dẻo quánh xay cùng sữa đặc", "none", "Size L", "ST-BO-L", 18000, 48000, "Có", ""},
	}
	for rowIdx, row := range sampleProducts {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet3, cell, val)
		}
	}
	f.SetColWidth(sheet3, "A", "A", 25)
	f.SetColWidth(sheet3, "B", "B", 24)
	f.SetColWidth(sheet3, "C", "C", 35)
	f.SetColWidth(sheet3, "D", "D", 26)
	f.SetColWidth(sheet3, "E", "E", 22)
	f.SetColWidth(sheet3, "F", "F", 16)
	f.SetColWidth(sheet3, "G", "G", 16)
	f.SetColWidth(sheet3, "H", "H", 16)
	f.SetColWidth(sheet3, "I", "I", 22)
	f.SetColWidth(sheet3, "J", "J", 25)

	// 4. SHEET 4: Sổ Thu Chi (Transactions)
	sheet4 := "💸 Sổ Thu Chi"
	f.NewSheet(sheet4)
	txHeaders := []string{"Thời Gian (YYYY-MM-DD HH:MM)", "Loại (Thu/Chi) (*)", "Danh Mục Thu Chi (*)", "Số Tiền (*)", "Nguồn Tiền (Tiền mặt/Chuyển khoản) (*)", "Người Thực Hiện", "Ghi Chú"}
	for colIdx, text := range txHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheet4, cell, text)
	}
	f.SetRowStyle(sheet4, 1, 1, amberHeaderStyle)
	f.SetRowHeight(sheet4, 1, 28)

	nowStr := time.Now().Format("2006-01-02 08:30")
	sampleTransactions := [][]interface{}{
		{nowStr, "Thu", "Nạp tiền đầu ca", 500000, "Tiền mặt", "NDN", "Tiền thối két đầu ngày"},
		{nowStr, "Chi", "Mua nguyên vật liệu", 250000, "Tiền mặt", "NHUNG", "Mua hoa quả tươi chợ sớm"},
		{nowStr, "Chi", "Tiền đá viên", 40000, "Tiền mặt", "DAT", "2 bao đá bi"},
	}
	for rowIdx, row := range sampleTransactions {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet4, cell, val)
		}
	}
	f.SetColWidth(sheet4, "A", "A", 26)
	f.SetColWidth(sheet4, "B", "B", 18)
	f.SetColWidth(sheet4, "C", "C", 25)
	f.SetColWidth(sheet4, "D", "D", 18)
	f.SetColWidth(sheet4, "E", "E", 32)
	f.SetColWidth(sheet4, "F", "F", 20)
	f.SetColWidth(sheet4, "G", "G", 35)

	// 5. SHEET 5: Lịch Sử Đơn Hàng (Historical Orders)
	sheet5 := "🧾 Lịch Sử Đơn Hàng"
	f.NewSheet(sheet5)
	orderHeaders := []string{"Mã Đơn Hàng (*)", "Thời Gian (YYYY-MM-DD HH:MM)", "Trạng Thái (completed/cancelled)", "Tên Món (*)", "Biến Thể / Size", "Số Lượng (*)", "Đơn Giá Món (*)", "Topping Đi Kèm", "Tiền Topping", "Giảm Giá Đơn", "Phí Ship", "Phụ Thu", "Tổng Tiền Đơn", "Nguồn Tiền (Tiền mặt/Chuyển khoản)", "Thu Ngân", "Ghi Chú Đơn"}
	for colIdx, text := range orderHeaders {
		cell, _ := excelize.CoordinatesToCellName(colIdx+1, 1)
		f.SetCellValue(sheet5, cell, text)
	}
	f.SetRowStyle(sheet5, 1, 1, roseHeaderStyle)
	f.SetRowHeight(sheet5, 1, 28)

	sampleOrders := [][]interface{}{
		{"ORD-DEMO-0001", nowStr, "completed", "Cà Phê Muối", "Size M", 2, 25000, "Trân Châu Trắng 3Q", 8000, 0, 0, 0, 58000, "Tiền mặt", "NDN", "Ít ngọt ít đá"},
		{"ORD-DEMO-0002", nowStr, "completed", "Trà Đào Cam Sả", "Size L", 1, 42000, "Thạch Đào Giòn", 8000, 5000, 0, 0, 45000, "Chuyển khoản", "NHUNG", "Khách quen"},
	}
	for rowIdx, row := range sampleOrders {
		for colIdx, val := range row {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			f.SetCellValue(sheet5, cell, val)
		}
	}
	f.SetColWidth(sheet5, "A", "A", 20)
	f.SetColWidth(sheet5, "B", "B", 24)
	f.SetColWidth(sheet5, "C", "C", 24)
	f.SetColWidth(sheet5, "D", "D", 24)
	f.SetColWidth(sheet5, "E", "E", 18)
	f.SetColWidth(sheet5, "F", "F", 14)
	f.SetColWidth(sheet5, "G", "G", 16)
	f.SetColWidth(sheet5, "H", "H", 25)
	f.SetColWidth(sheet5, "I", "I", 16)
	f.SetColWidth(sheet5, "J", "J", 16)
	f.SetColWidth(sheet5, "K", "K", 14)
	f.SetColWidth(sheet5, "L", "L", 14)
	f.SetColWidth(sheet5, "M", "M", 18)
	f.SetColWidth(sheet5, "N", "N", 30)
	f.SetColWidth(sheet5, "O", "O", 16)
	f.SetColWidth(sheet5, "P", "P", 25)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return nil, fmt.Errorf("failed to encode template workbook: %w", err)
	}

	return buf.Bytes(), nil
}

// ImportExcel processes an uploaded .xlsx file and ingests records into PostgreSQL
func (s *ImporterService) ImportExcel(
	reader io.ReaderAt,
	size int64,
	opts models.ImportOptions,
	currentUserID *uint,
	currentUsername string,
) (*models.ImportResponse, error) {
	f, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel workbook: %w", err)
	}
	defer f.Close()

	response := &models.ImportResponse{
		Success:   true,
		Timestamp: time.Now(),
		Errors:    make([]models.ImportRowError, 0),
	}

	// Transaction safety
	err = s.db.Transaction(func(tx *gorm.DB) error {
		sheetList := f.GetSheetList()
		target := strings.ToLower(strings.TrimSpace(opts.Target))
		if target == "" {
			target = "all"
		}

		// 1. Categories
		if target == "all" || target == "categories" {
			sheetName := findSheet(sheetList, []string{"danh mục", "categories", "category", "danhmuc"})
			if sheetName != "" {
				rows, err := f.GetRows(sheetName)
				if err == nil && len(rows) > 1 {
					s.importCategories(tx, sheetName, rows[1:], response)
				}
			}
		}

		// 2. Toppings
		if target == "all" || target == "toppings" {
			sheetName := findSheet(sheetList, []string{"topping", "toppings"})
			if sheetName != "" {
				rows, err := f.GetRows(sheetName)
				if err == nil && len(rows) > 1 {
					s.importToppings(tx, sheetName, rows[1:], response)
				}
			}
		}

		// 3. Products & Variants
		if target == "all" || target == "products" {
			sheetName := findSheet(sheetList, []string{"sản phẩm", "san pham", "products", "product", "sanpham"})
			if sheetName != "" {
				rows, err := f.GetRows(sheetName)
				if err == nil && len(rows) > 1 {
					s.importProducts(tx, sheetName, rows[1:], opts.UpsertProducts, response)
				}
			}
		}

		// 4. Transactions
		if target == "all" || target == "transactions" {
			sheetName := findSheet(sheetList, []string{"sổ thu chi", "thu chi", "transactions", "transaction", "thuchi"})
			if sheetName != "" {
				rows, err := f.GetRows(sheetName)
				if err == nil && len(rows) > 1 {
					s.importTransactions(tx, sheetName, rows[1:], opts.UpdateFunds, currentUserID, currentUsername, response)
				}
			}
		}

		// 5. Orders
		if target == "all" || target == "orders" {
			sheetName := findSheet(sheetList, []string{"lịch sử đơn hàng", "đơn hàng", "orders", "order", "donhang"})
			if sheetName != "" {
				rows, err := f.GetRows(sheetName)
				if err == nil && len(rows) > 1 {
					s.importOrders(tx, sheetName, rows[1:], currentUserID, currentUsername, response)
				}
			}
		}

		// Sequence reset for PostgreSQL
		s.resetSequences(tx)
		return nil
	})

	if err != nil {
		return nil, err
	}

	response.Stats.TotalErrors = len(response.Errors)
	response.Message = fmt.Sprintf(
		"Nhập dữ liệu hoàn tất: %d danh mục, %d topping, %d sản phẩm (%d biến thể), %d giao dịch, %d đơn hàng.",
		response.Stats.CategoriesCount,
		response.Stats.ToppingsCount,
		response.Stats.ProductsCount,
		response.Stats.VariantsCount,
		response.Stats.TransactionsCount,
		response.Stats.OrdersCount,
	)

	return response, nil
}

// ImportCSV processes an uploaded individual CSV file for a specific target domain
func (s *ImporterService) ImportCSV(
	r io.Reader,
	opts models.ImportOptions,
	currentUserID *uint,
	currentUsername string,
) (*models.ImportResponse, error) {
	csvReader := csv.NewReader(r)
	csvReader.TrimLeadingSpace = true
	csvReader.FieldsPerRecord = -1

	rows, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV file: %w", err)
	}

	if len(rows) <= 1 {
		return nil, fmt.Errorf("CSV file has no data rows")
	}

	response := &models.ImportResponse{
		Success:   true,
		Timestamp: time.Now(),
		Errors:    make([]models.ImportRowError, 0),
	}

	target := strings.ToLower(strings.TrimSpace(opts.Target))
	if target == "" {
		target = "products" // Default CSV target
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		dataRows := rows[1:]
		sheetName := "CSV Import (" + target + ")"

		switch target {
		case "categories":
			s.importCategories(tx, sheetName, dataRows, response)
		case "toppings":
			s.importToppings(tx, sheetName, dataRows, response)
		case "products":
			s.importProducts(tx, sheetName, dataRows, opts.UpsertProducts, response)
		case "transactions":
			s.importTransactions(tx, sheetName, dataRows, opts.UpdateFunds, currentUserID, currentUsername, response)
		case "orders":
			s.importOrders(tx, sheetName, dataRows, currentUserID, currentUsername, response)
		default:
			return fmt.Errorf("unsupported CSV import target: %s", target)
		}

		s.resetSequences(tx)
		return nil
	})

	if err != nil {
		return nil, err
	}

	response.Stats.TotalErrors = len(response.Errors)
	response.Message = fmt.Sprintf("Nhập dữ liệu CSV (%s) hoàn tất.", target)
	return response, nil
}

// -------------------------------------------------------------
// SHEET PARSERS
// -------------------------------------------------------------

func (s *ImporterService) importCategories(tx *gorm.DB, sheet string, rows [][]string, res *models.ImportResponse) {
	for idx, row := range rows {
		rowNum := idx + 2
		if len(row) < 2 || strings.TrimSpace(row[1]) == "" {
			continue
		}

		name := strings.TrimSpace(row[1])
		displayOrder := 0
		if len(row) > 2 && row[2] != "" {
			displayOrder = parseInteger(row[2])
		}

		isActive := true
		if len(row) > 3 && row[3] != "" {
			isActive = parseBoolean(row[3])
		}

		imageURL := ""
		if len(row) > 4 {
			imageURL = strings.TrimSpace(row[4])
		}

		var cat models.Category
		err := tx.Where("LOWER(name) = LOWER(?)", name).First(&cat).Error
		if err != nil {
			// Create new
			cat = models.Category{
				Name:         name,
				DisplayOrder: displayOrder,
				IsActive:     isActive,
				ImageURL:     imageURL,
			}
			if err := tx.Create(&cat).Error; err != nil {
				res.Errors = append(res.Errors, models.ImportRowError{
					Sheet:   sheet,
					Row:     rowNum,
					Field:   "name",
					Message: "Lỗi tạo danh mục: " + err.Error(),
				})
				continue
			}
		} else {
			// Update existing
			cat.DisplayOrder = displayOrder
			cat.IsActive = isActive
			if imageURL != "" {
				cat.ImageURL = imageURL
			}
			tx.Save(&cat)
		}
		res.Stats.CategoriesCount++
	}
}

func (s *ImporterService) importToppings(tx *gorm.DB, sheet string, rows [][]string, res *models.ImportResponse) {
	for idx, row := range rows {
		rowNum := idx + 2
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" {
			continue
		}

		name := strings.TrimSpace(row[0])
		price := parsePrice(row[1])
		if price < 0 {
			res.Errors = append(res.Errors, models.ImportRowError{
				Sheet:   sheet,
				Row:     rowNum,
				Field:   "price",
				Message: "Giá bán topping không hợp lệ",
			})
			continue
		}

		cogs := 0.0
		if len(row) > 2 && row[2] != "" {
			cogs = parsePrice(row[2])
		}

		var categoryID *uint
		if len(row) > 3 && strings.TrimSpace(row[3]) != "" {
			catName := strings.TrimSpace(row[3])
			if !strings.EqualFold(catName, "tất cả") && !strings.EqualFold(catName, "áp dụng tất cả") {
				var cat models.Category
				if err := tx.Where("LOWER(name) = LOWER(?)", catName).First(&cat).Error; err == nil {
					categoryID = &cat.ID
				}
			}
		}

		isActive := true
		if len(row) > 4 && row[4] != "" {
			isActive = parseBoolean(row[4])
		}

		var topping models.Topping
		err := tx.Where("LOWER(name) = LOWER(?)", name).First(&topping).Error
		if err != nil {
			topping = models.Topping{
				Name:       name,
				Price:      price,
				Cogs:       cogs,
				CategoryID: categoryID,
				IsActive:   isActive,
			}
			if err := tx.Create(&topping).Error; err != nil {
				res.Errors = append(res.Errors, models.ImportRowError{
					Sheet:   sheet,
					Row:     rowNum,
					Field:   "name",
					Message: "Lỗi tạo topping: " + err.Error(),
				})
				continue
			}
		} else {
			topping.Price = price
			topping.Cogs = cogs
			topping.CategoryID = categoryID
			topping.IsActive = isActive
			tx.Save(&topping)
		}
		res.Stats.ToppingsCount++
	}
}

func (s *ImporterService) importProducts(tx *gorm.DB, sheet string, rows [][]string, upsert bool, res *models.ImportResponse) {
	// Cache categories for fast lookup
	categoryMap := make(map[string]uint)
	var categories []models.Category
	tx.Find(&categories)
	for _, c := range categories {
		categoryMap[strings.ToLower(strings.TrimSpace(c.Name))] = c.ID
	}

	for idx, row := range rows {
		rowNum := idx + 2
		if len(row) < 2 || strings.TrimSpace(row[0]) == "" {
			continue
		}

		prodName := strings.TrimSpace(row[0])
		catName := strings.TrimSpace(row[1])
		if catName == "" {
			catName = "Mặc định"
		}

		// Find or auto-create category
		catID, exists := categoryMap[strings.ToLower(catName)]
		if !exists {
			newCat := models.Category{Name: catName, IsActive: true}
			if err := tx.Create(&newCat).Error; err == nil {
				catID = newCat.ID
				categoryMap[strings.ToLower(catName)] = catID
				res.Stats.CategoriesCount++
			}
		}

		desc := ""
		if len(row) > 2 {
			desc = strings.TrimSpace(row[2])
		}

		tag := models.TagNone
		if len(row) > 3 {
			tStr := strings.ToLower(strings.TrimSpace(row[3]))
			if tStr == "best_seller" || tStr == "bestseller" || tStr == "bán chạy" {
				tag = models.TagBestSeller
			} else if tStr == "new" || tStr == "mới" {
				tag = models.TagNew
			}
		}

		variantName := "Mặc định"
		if len(row) > 4 && strings.TrimSpace(row[4]) != "" {
			variantName = strings.TrimSpace(row[4])
		}

		sku := ""
		if len(row) > 5 {
			sku = strings.TrimSpace(row[5])
		}

		cogs := 0.0
		if len(row) > 6 && row[6] != "" {
			cogs = parsePrice(row[6])
		}

		retailPrice := 0.0
		if len(row) > 7 && row[7] != "" {
			retailPrice = parsePrice(row[7])
		}

		isActive := true
		if len(row) > 8 && row[8] != "" {
			isActive = parseBoolean(row[8])
		}

		imageURL := ""
		if len(row) > 9 {
			imageURL = strings.TrimSpace(row[9])
		}

		// 1. Find or create Product
		var product models.Product
		err := tx.Where("LOWER(name) = LOWER(?)", prodName).First(&product).Error
		if err != nil {
			product = models.Product{
				CategoryID:  catID,
				Name:        prodName,
				Description: desc,
				Tag:         tag,
				ImageURL:    imageURL,
				IsActive:    isActive,
			}
			if err := tx.Create(&product).Error; err != nil {
				res.Errors = append(res.Errors, models.ImportRowError{
					Sheet:   sheet,
					Row:     rowNum,
					Field:   "product_name",
					Message: "Lỗi tạo món: " + err.Error(),
				})
				continue
			}
			res.Stats.ProductsCount++
		} else if upsert {
			if catID > 0 {
				product.CategoryID = catID
			}
			if desc != "" {
				product.Description = desc
			}
			if tag != models.TagNone {
				product.Tag = tag
			}
			if imageURL != "" {
				product.ImageURL = imageURL
			}
			product.IsActive = isActive
			tx.Save(&product)
		}

		// 2. Find or create ProductVariant
		var variant models.ProductVariant
		err = tx.Where("product_id = ? AND LOWER(variant_name) = LOWER(?)", product.ID, variantName).First(&variant).Error
		if err != nil {
			variant = models.ProductVariant{
				ProductID:   product.ID,
				VariantName: variantName,
				CogsPrice:   cogs,
				RetailPrice: retailPrice,
				SKU:         sku,
				IsActive:    isActive,
			}
			if err := tx.Create(&variant).Error; err != nil {
				res.Errors = append(res.Errors, models.ImportRowError{
					Sheet:   sheet,
					Row:     rowNum,
					Field:   "variant_name",
					Message: "Lỗi tạo biến thể: " + err.Error(),
				})
				continue
			}
			res.Stats.VariantsCount++
		} else if upsert {
			variant.CogsPrice = cogs
			variant.RetailPrice = retailPrice
			if sku != "" {
				variant.SKU = sku
			}
			variant.IsActive = isActive
			tx.Save(&variant)
			res.Stats.VariantsCount++
		}
	}
}

func (s *ImporterService) importTransactions(
	tx *gorm.DB,
	sheet string,
	rows [][]string,
	updateFunds bool,
	currentUserID *uint,
	currentUsername string,
	res *models.ImportResponse,
) {
	// Cache funds
	var funds []models.Fund
	tx.Find(&funds)
	fundMap := make(map[string]uint)
	for _, f := range funds {
		fundMap[strings.ToLower(strings.TrimSpace(f.Name))] = f.ID
		if f.FundType == models.FundTypeCash {
			fundMap["cash"] = f.ID
			fundMap["tiền mặt"] = f.ID
			fundMap["tien mat"] = f.ID
		} else if f.FundType == models.FundTypeBank {
			fundMap["bank"] = f.ID
			fundMap["chuyển khoản"] = f.ID
			fundMap["chuyen khoan"] = f.ID
			fundMap["vietqr"] = f.ID
		}
	}

	for idx, row := range rows {
		rowNum := idx + 2
		if len(row) < 4 || strings.TrimSpace(row[1]) == "" {
			continue
		}

		createdAt := parseTimestamp(row[0])
		txTypeStr := strings.ToLower(strings.TrimSpace(row[1]))
		var txType models.TransactionType
		if strings.Contains(txTypeStr, "thu") || strings.Contains(txTypeStr, "inflow") || strings.Contains(txTypeStr, "+") {
			txType = models.TxInflow
		} else {
			txType = models.TxOutflow
		}

		categoryName := strings.TrimSpace(row[2])
		if categoryName == "" {
			categoryName = "Khác"
		}

		amount := parsePrice(row[3])
		if amount <= 0 {
			res.Errors = append(res.Errors, models.ImportRowError{
				Sheet:   sheet,
				Row:     rowNum,
				Field:   "amount",
				Message: "Số tiền giao dịch phải lớn hơn 0",
			})
			continue
		}

		fundName := ""
		if len(row) > 4 {
			fundName = strings.ToLower(strings.TrimSpace(row[4]))
		}
		fundID, exists := fundMap[fundName]
		if !exists {
			// Fallback to first available fund
			if len(funds) > 0 {
				fundID = funds[0].ID
			} else {
				res.Errors = append(res.Errors, models.ImportRowError{
					Sheet:   sheet,
					Row:     rowNum,
					Field:   "fund",
					Message: "Không tìm thấy quỹ tiền phù hợp trong hệ thống",
				})
				continue
			}
		}

		cashierName := currentUsername
		if len(row) > 5 && strings.TrimSpace(row[5]) != "" {
			cashierName = strings.TrimSpace(row[5])
		}

		description := ""
		if len(row) > 6 {
			description = strings.TrimSpace(row[6])
		}

		// Map or create transaction category
		var txCategory models.TransactionCategory
		catType := "both"
		if txType == models.TxInflow {
			catType = "inflow"
		} else {
			catType = "outflow"
		}
		if err := tx.Where("LOWER(name) = LOWER(?)", categoryName).First(&txCategory).Error; err != nil {
			txCategory = models.TransactionCategory{
				Name:     categoryName,
				Type:     catType,
				IsSystem: false,
			}
			_ = tx.Create(&txCategory).Error
		}

		transaction := models.Transaction{
			FundID:          fundID,
			TransactionType: txType,
			Category:        categoryName,
			Amount:          amount,
			Description:     description,
			CreatedBy:       cashierName,
			CashierID:       currentUserID,
			CashierName:     cashierName,
			CreatedAt:       createdAt,
			UpdatedAt:       createdAt,
		}

		if err := tx.Create(&transaction).Error; err != nil {
			res.Errors = append(res.Errors, models.ImportRowError{
				Sheet:   sheet,
				Row:     rowNum,
				Field:   "transaction",
				Message: "Lỗi ghi nhận giao dịch: " + err.Error(),
			})
			continue
		}

		// Adjust fund balance
		if updateFunds {
			if txType == models.TxInflow {
				tx.Model(&models.Fund{}).Where("id = ?", fundID).UpdateColumn("current_balance", gorm.Expr("current_balance + ?", amount))
			} else {
				tx.Model(&models.Fund{}).Where("id = ?", fundID).UpdateColumn("current_balance", gorm.Expr("current_balance - ?", amount))
			}
		}

		res.Stats.TransactionsCount++
	}
}

func (s *ImporterService) importOrders(
	tx *gorm.DB,
	sheet string,
	rows [][]string,
	currentUserID *uint,
	currentUsername string,
	res *models.ImportResponse,
) {
	// Cache funds
	var funds []models.Fund
	tx.Find(&funds)
	fundMap := make(map[string]uint)
	for _, f := range funds {
		fundMap[strings.ToLower(strings.TrimSpace(f.Name))] = f.ID
		if f.FundType == models.FundTypeCash {
			fundMap["cash"] = f.ID
			fundMap["tiền mặt"] = f.ID
			fundMap["tien mat"] = f.ID
		} else if f.FundType == models.FundTypeBank {
			fundMap["bank"] = f.ID
			fundMap["chuyển khoản"] = f.ID
			fundMap["chuyen khoan"] = f.ID
			fundMap["vietqr"] = f.ID
		}
	}

	// Cache variants: map[LOWER(product_name + "_" + variant_name)] -> variant
	type VariantLookup struct {
		ID        uint
		UnitPrice float64
	}
	variantMap := make(map[string]VariantLookup)
	var variants []models.ProductVariant
	tx.Preload("Product").Find(&variants)
	for _, v := range variants {
		if v.ProductID > 0 {
			var prod models.Product
			if err := tx.First(&prod, v.ProductID).Error; err == nil {
				key := strings.ToLower(strings.TrimSpace(prod.Name)) + "_" + strings.ToLower(strings.TrimSpace(v.VariantName))
				variantMap[key] = VariantLookup{ID: v.ID, UnitPrice: v.RetailPrice}
				// Also add default fallback
				defaultKey := strings.ToLower(strings.TrimSpace(prod.Name)) + "_mặc định"
				if _, ok := variantMap[defaultKey]; !ok {
					variantMap[defaultKey] = VariantLookup{ID: v.ID, UnitPrice: v.RetailPrice}
				}
			}
		}
	}

	// Group rows by order code
	type OrderRowData struct {
		RowNum        int
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

	orderGroups := make(map[string][]OrderRowData)
	orderSequence := make([]string, 0)

	for idx, row := range rows {
		rowNum := idx + 2
		if len(row) < 4 || strings.TrimSpace(row[0]) == "" {
			continue
		}

		orderCode := strings.TrimSpace(row[0])
		createdAt := parseTimestamp(row[1])
		statusStr := strings.ToLower(strings.TrimSpace(row[2]))
		status := models.OrderStatusCompleted
		if statusStr == "cancelled" || statusStr == "đã hủy" || statusStr == "da huy" {
			status = models.OrderStatusCancelled
		}

		prodName := strings.TrimSpace(row[3])
		variantName := "Mặc định"
		if len(row) > 4 && strings.TrimSpace(row[4]) != "" {
			variantName = strings.TrimSpace(row[4])
		}

		qty := 1
		if len(row) > 5 && row[5] != "" {
			qty = parseInteger(row[5])
			if qty <= 0 {
				qty = 1
			}
		}

		unitPrice := 0.0
		if len(row) > 6 && row[6] != "" {
			unitPrice = parsePrice(row[6])
		}

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

		fundName := ""
		if len(row) > 13 {
			fundName = strings.ToLower(strings.TrimSpace(row[13]))
		}

		cashierName := currentUsername
		if len(row) > 14 && strings.TrimSpace(row[14]) != "" {
			cashierName = strings.TrimSpace(row[14])
		}

		note := ""
		if len(row) > 15 {
			note = strings.TrimSpace(row[15])
		}

		if _, ok := orderGroups[orderCode]; !ok {
			orderSequence = append(orderSequence, orderCode)
		}

		orderGroups[orderCode] = append(orderGroups[orderCode], OrderRowData{
			RowNum:        rowNum,
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

	// Insert orders and items
	for _, orderCode := range orderSequence {
		itemsData := orderGroups[orderCode]
		if len(itemsData) == 0 {
			continue
		}

		firstRow := itemsData[0]
		fundID, exists := fundMap[firstRow.FundName]
		if !exists {
			if len(funds) > 0 {
				fundID = funds[0].ID
			} else {
				fundID = 1
			}
		}

		var subtotal float64
		var totalDiscount float64 = firstRow.Discount
		var totalShipping float64 = firstRow.Shipping
		var totalSurcharge float64 = firstRow.Surcharge

		var orderItems []models.OrderItem

		for _, item := range itemsData {
			// Find or create product variant
			key := strings.ToLower(item.ProductName) + "_" + strings.ToLower(item.VariantName)
			vLookup, ok := variantMap[key]
			if !ok {
				// Try creating on the fly
				var prod models.Product
				if err := tx.Where("LOWER(name) = LOWER(?)", item.ProductName).First(&prod).Error; err != nil {
					prod = models.Product{CategoryID: 1, Name: item.ProductName, IsActive: true}
					_ = tx.Create(&prod).Error
				}
				newVariant := models.ProductVariant{
					ProductID:   prod.ID,
					VariantName: item.VariantName,
					RetailPrice: item.UnitPrice,
					IsActive:    true,
				}
				_ = tx.Create(&newVariant).Error
				vLookup = VariantLookup{ID: newVariant.ID, UnitPrice: item.UnitPrice}
				variantMap[key] = vLookup
			}

			unitPrice := item.UnitPrice
			if unitPrice <= 0 {
				unitPrice = vLookup.UnitPrice
			}
			lineTotal := (unitPrice * float64(item.Quantity)) + item.ToppingsPrice
			subtotal += lineTotal

			toppingsJSON := "[]"
			if item.ToppingsStr != "" {
				toppingSnapshots := []models.ToppingSnapshot{
					{Name: item.ToppingsStr, Price: item.ToppingsPrice},
				}
				b, _ := json.Marshal(toppingSnapshots)
				toppingsJSON = string(b)
			}

			orderItems = append(orderItems, models.OrderItem{
				ProductVariantID: vLookup.ID,
				Quantity:         item.Quantity,
				UnitPrice:        unitPrice,
				LineTotal:        lineTotal,
				SelectedToppings: toppingsJSON,
				ToppingsPrice:    item.ToppingsPrice,
				CreatedAt:        item.CreatedAt,
				UpdatedAt:        item.CreatedAt,
			})
		}

		calcTotal := subtotal - totalDiscount + totalShipping + totalSurcharge
		if firstRow.TotalAmount > 0 {
			calcTotal = firstRow.TotalAmount
		}

		var notePtr *string
		if firstRow.Note != "" {
			notePtr = &firstRow.Note
		}

		order := models.Order{
			OrderCode:      orderCode,
			Status:         firstRow.Status,
			Subtotal:       subtotal,
			DiscountAmount: totalDiscount,
			ShippingFee:    totalShipping,
			Surcharge:      totalSurcharge,
			TotalAmount:    calcTotal,
			FundID:         fundID,
			CreatedBy:      firstRow.CashierName,
			CashierID:      currentUserID,
			CashierName:    firstRow.CashierName,
			Note:           notePtr,
			CreatedAt:      firstRow.CreatedAt,
			UpdatedAt:      firstRow.CreatedAt,
		}

		// Upsert Order by order_code
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "order_code"}},
			DoUpdates: clause.AssignmentColumns([]string{"subtotal", "discount_amount", "shipping_fee", "surcharge", "total_amount", "status"}),
		}).Create(&order).Error; err != nil {
			res.Errors = append(res.Errors, models.ImportRowError{
				Sheet:   sheet,
				Row:     firstRow.RowNum,
				Field:   "order_code",
				Message: "Lỗi tạo đơn hàng " + orderCode + ": " + err.Error(),
			})
			continue
		}

		// Delete old items if re-importing
		tx.Where("order_id = ?", order.ID).Delete(&models.OrderItem{})

		for i := range orderItems {
			orderItems[i].OrderID = order.ID
			if err := tx.Create(&orderItems[i]).Error; err != nil {
				log.Printf("[IMPORT] Error creating order item: %v", err)
			} else {
				res.Stats.OrderItemsCount++
			}
		}

		res.Stats.OrdersCount++
	}
}

// -------------------------------------------------------------
// UTILITY HELPERS
// -------------------------------------------------------------

func findSheet(sheetList []string, aliases []string) string {
	for _, sName := range sheetList {
		norm := strings.ToLower(strings.TrimSpace(sName))
		for _, alias := range aliases {
			if strings.Contains(norm, alias) {
				return sName
			}
		}
	}
	return ""
}

func parsePrice(val string) float64 {
	clean := strings.ReplaceAll(val, "đ", "")
	clean = strings.ReplaceAll(clean, "VND", "")
	clean = strings.ReplaceAll(clean, "vnd", "")
	clean = strings.ReplaceAll(clean, ",", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.TrimSpace(clean)

	p, err := strconv.ParseFloat(clean, 64)
	if err != nil {
		return 0.0
	}
	return p
}

func parseInteger(val string) int {
	clean := strings.TrimSpace(val)
	i, err := strconv.Atoi(clean)
	if err != nil {
		// Try float parsing
		if f, err := strconv.ParseFloat(clean, 64); err == nil {
			return int(f)
		}
		return 0
	}
	return i
}

func parseBoolean(val string) bool {
	clean := strings.ToLower(strings.TrimSpace(val))
	switch clean {
	case "có", "co", "true", "1", "đang bán", "hoạt động", "active", "yes", "t":
		return true
	case "không", "khong", "false", "0", "tạm dừng", "ẩn", "inactive", "no", "f":
		return false
	default:
		return true
	}
}

func parseTimestamp(val string) time.Time {
	clean := strings.TrimSpace(val)
	if clean == "" {
		return time.Now()
	}

	formats := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"2006/01/02 15:04:05",
		"2006/01/02 15:04",
		"2006/01/02",
		time.RFC3339,
	}

	for _, layout := range formats {
		if t, err := time.ParseInLocation(layout, clean, time.Local); err == nil {
			return t
		}
	}

	return time.Now()
}

func (s *ImporterService) resetSequences(tx *gorm.DB) {
	tables := []string{
		"categories", "products", "product_variants", "variant_groups",
		"toppings", "funds", "transaction_categories", "transactions",
		"orders", "order_items",
	}
	for _, tbl := range tables {
		query := fmt.Sprintf(
			"SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1), (SELECT MAX(id) IS NOT NULL FROM %s))",
			tbl, tbl, tbl,
		)
		_ = tx.Exec(query).Error
	}
}
