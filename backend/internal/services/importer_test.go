package services

import (
	"bytes"
	"os"
	"testing"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/xuri/excelize/v2"
)

func TestImporterService_GenerateTemplateAndImport(t *testing.T) {
	cfg, err := config.LoadConfig()
	if err != nil {
		t.Skipf("Skipping integration test: cannot load config: %v", err)
	}

	// Only run if DB is accessible
	db, err := database.InitDB(cfg)
	if err != nil {
		t.Skipf("Skipping integration test: database unavailable: %v", err)
	}

	svc := NewImporterService(db)

	// 1. Test Generate Template
	data, err := svc.GenerateExcelTemplate()
	if err != nil {
		t.Fatalf("GenerateExcelTemplate failed: %v", err)
	}

	if len(data) == 0 {
		t.Fatalf("Generated template data is empty")
	}

	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("Failed to open generated Excel: %v", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	expectedSheets := []string{"📁 Danh Mục", "🧋 Topping", "🍹 Sản Phẩm & Biến Thể", "💸 Sổ Thu Chi", "🧾 Lịch Sử Đơn Hàng"}
	for _, expected := range expectedSheets {
		found := false
		for _, sheet := range sheets {
			if sheet == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected sheet %q not found in %v", expected, sheets)
		}
	}

	// 2. Save template to test file
	tmpPath := "/tmp/Mau_Nhap_Du_Lieu_RabbitPOS.xlsx"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		t.Fatalf("Failed to write template file: %v", err)
	}

	// 3. Test Import Excel
	opts := models.ImportOptions{
		Target:         "all",
		UpsertProducts: true,
		UpdateFunds:    true,
	}

	res, err := svc.ImportExcel(bytes.NewReader(data), int64(len(data)), opts, nil, "UnitTest")
	if err != nil {
		t.Fatalf("ImportExcel failed: %v", err)
	}

	if !res.Success {
		t.Fatalf("ImportExcel returned success=false: %s", res.Message)
	}

	t.Logf("Import completed successfully:")
	t.Logf("  Categories: %d", res.Stats.CategoriesCount)
	t.Logf("  Toppings: %d", res.Stats.ToppingsCount)
	t.Logf("  Products: %d", res.Stats.ProductsCount)
	t.Logf("  Variants: %d", res.Stats.VariantsCount)
	t.Logf("  Transactions: %d", res.Stats.TransactionsCount)
	t.Logf("  Orders: %d", res.Stats.OrdersCount)
	t.Logf("  OrderItems: %d", res.Stats.OrderItemsCount)
	t.Logf("  Errors: %d", res.Stats.TotalErrors)

	if res.Stats.CategoriesCount == 0 {
		t.Errorf("Expected at least 1 category imported from sample data")
	}
	if res.Stats.ProductsCount == 0 {
		t.Errorf("Expected at least 1 product imported from sample data")
	}
}
