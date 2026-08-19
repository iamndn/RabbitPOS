package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
)

func main() {
	filePath := flag.String("file", "", "Path to the Excel (.xlsx) or CSV file to import")
	target := flag.String("target", "all", "Target domain to import (all, categories, toppings, products, transactions, orders)")
	upsert := flag.Bool("upsert", true, "Upsert existing records if duplicate name/SKU is found")
	updateFunds := flag.Bool("funds", true, "Update fund balance on transaction import")
	flag.Parse()

	if *filePath == "" {
		fmt.Println("Usage: go run ./cmd/import/main.go -file=/path/to/Mau_Nhap_Du_Lieu_RabbitPOS.xlsx [-target=all] [-upsert=true] [-funds=true]")
		os.Exit(1)
	}

	log.Printf("Starting RabbitPOS CLI Data Import for file: %s", *filePath)

	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	file, err := os.Open(*filePath)
	if err != nil {
		log.Fatalf("Failed to open input file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		log.Fatalf("Failed to get file info: %v", err)
	}

	importerSvc := services.NewImporterService(db)
	opts := models.ImportOptions{
		Target:         *target,
		UpsertProducts: *upsert,
		UpdateFunds:    *updateFunds,
	}

	var response *models.ImportResponse
	lowerPath := strings.ToLower(*filePath)

	if strings.HasSuffix(lowerPath, ".xlsx") || strings.HasSuffix(lowerPath, ".xls") {
		response, err = importerSvc.ImportExcel(file, fileInfo.Size(), opts, nil, "CLI_Importer")
	} else if strings.HasSuffix(lowerPath, ".csv") {
		response, err = importerSvc.ImportCSV(file, opts, nil, "CLI_Importer")
	} else {
		log.Fatalf("Unsupported file format. Please provide a .xlsx or .csv file.")
	}

	if err != nil {
		log.Fatalf("Data import failed with fatal error: %v", err)
	}

	fmt.Println("\n=======================================================")
	fmt.Println("             RABBITPOS DATA IMPORT SUMMARY             ")
	fmt.Println("=======================================================")
	fmt.Printf("• Danh mục (Categories):     %d\n", response.Stats.CategoriesCount)
	fmt.Printf("• Topping:                   %d\n", response.Stats.ToppingsCount)
	fmt.Printf("• Sản phẩm (Products):       %d\n", response.Stats.ProductsCount)
	fmt.Printf("• Biến thể (Variants):       %d\n", response.Stats.VariantsCount)
	fmt.Printf("• Giao dịch (Transactions):  %d\n", response.Stats.TransactionsCount)
	fmt.Printf("• Đơn hàng (Orders):         %d\n", response.Stats.OrdersCount)
	fmt.Printf("• Chi tiết món (Order Items): %d\n", response.Stats.OrderItemsCount)
	fmt.Printf("• Tổng số lỗi (Row Errors):  %d\n", response.Stats.TotalErrors)
	fmt.Println("=======================================================")

	if len(response.Errors) > 0 {
		fmt.Println("\nDANH SÁCH LỖI THEO DÒNG:")
		for i, e := range response.Errors {
			fmt.Printf("  [%d] Sheet: %-25s | Dòng: %-4d | Lỗi: %s\n", i+1, e.Sheet, e.Row, e.Message)
		}
	}

	fmt.Println("\n✅ Quá trình nhập dữ liệu đã hoàn tất thành công!")
}
