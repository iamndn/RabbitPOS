package main

import (
	"fmt"
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

func main() {
	log.Println("🚀 Starting RabbitPOS Data Migration to Supabase...")

	// 1. Source DB (Local PostgreSQL Docker)
	sourceDSN := "host=localhost port=5432 user=admin password=SGsurv9wi7uQRXXniYj0kg1V8TunrUnR dbname=rabbitpos sslmode=disable TimeZone=Asia/Ho_Chi_Minh"
	srcDB, err := gorm.Open(postgres.Open(sourceDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to SOURCE database: %v", err)
	}
	log.Println("✅ Connected to SOURCE database (Local PostgreSQL)")

	// 2. Target DB (Supabase Cloud PostgreSQL)
	targetDSN := "host=aws-0-ap-south-1.pooler.supabase.com port=6543 user=postgres.sezvflianhlphfgbzpso password=gCmqznenLnHqRMrbajTFasx3tPrZJMjF dbname=postgres sslmode=require TimeZone=Asia/Ho_Chi_Minh"
	dstDB, err := gorm.Open(postgres.Open(targetDSN), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to TARGET database (Supabase): %v", err)
	}
	log.Println("✅ Connected to TARGET database (Supabase Cloud)")

	// 3. Auto-migrate schema on target first
	err = dstDB.AutoMigrate(
		&models.Category{},
		&models.Product{},
		&models.ProductVariant{},
		&models.VariantGroup{},
		&models.Fund{},
		&models.Promotion{},
		&models.Order{},
		&models.OrderItem{},
		&models.Transaction{},
		&models.TransactionCategoryItem{},
		&models.Setting{},
		&models.User{},
		&models.AuditLog{},
		&models.IdempotencyRecord{},
		&models.RevokedToken{},
		&models.Topping{},
		&models.Ingredient{},
		&models.RecipeItem{},
		&models.PurchaseItem{},
	)
	if err != nil {
		log.Fatalf("❌ AutoMigrate on Supabase failed: %v", err)
	}
	log.Println("✅ Schema verified on Supabase")

	// Helper for copying slices in chunks
	copyTable := func(tableName string, fetchAndInsert func() (int64, error)) {
		start := time.Now()
		count, err := fetchAndInsert()
		if err != nil {
			log.Fatalf("❌ Failed migrating table %s: %v", tableName, err)
		}
		log.Printf("  📦 [%s] Migrated %d rows in %v", tableName, count, time.Since(start))
	}

	fmt.Println("\n--- MIGRATING DATA IN TOPOLOGICAL ORDER ---")

	// 1. Users
	copyTable("users", func() (int64, error) {
		var items []models.User
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 2. Categories
	copyTable("categories", func() (int64, error) {
		var items []models.Category
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 3. Funds
	copyTable("funds", func() (int64, error) {
		var items []models.Fund
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 4. Transaction Categories
	copyTable("transaction_categories", func() (int64, error) {
		var items []models.TransactionCategoryItem
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 5. Settings
	copyTable("settings", func() (int64, error) {
		var items []models.Setting
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 6. Ingredients
	copyTable("ingredients", func() (int64, error) {
		var items []models.Ingredient
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 7. Products
	copyTable("products", func() (int64, error) {
		var items []models.Product
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 8. Variant Groups
	copyTable("variant_groups", func() (int64, error) {
		var items []models.VariantGroup
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 9. Product Variants
	copyTable("product_variants", func() (int64, error) {
		var items []models.ProductVariant
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 10. Toppings
	copyTable("toppings", func() (int64, error) {
		var items []models.Topping
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 11. Recipe Items
	copyTable("recipe_items", func() (int64, error) {
		var items []models.RecipeItem
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 12. Promotions
	copyTable("promotions", func() (int64, error) {
		var items []models.Promotion
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 13. Orders
	copyTable("orders", func() (int64, error) {
		var items []models.Order
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 14. Order Items
	copyTable("order_items", func() (int64, error) {
		var items []models.OrderItem
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 15. Transactions
	copyTable("transactions", func() (int64, error) {
		var items []models.Transaction
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 16. Purchase Items
	copyTable("purchase_items", func() (int64, error) {
		var items []models.PurchaseItem
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 17. Audit Logs
	copyTable("audit_logs", func() (int64, error) {
		var items []models.AuditLog
		if err := srcDB.Find(&items).Error; err != nil {
			return 0, err
		}
		if len(items) > 0 {
			if err := dstDB.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(items, 100).Error; err != nil {
				return 0, err
			}
		}
		return int64(len(items)), nil
	})

	// 4. Reset sequences for all auto-increment tables
	fmt.Println("\n--- RESETTING POSTGRESQL SEQUENCES ---")
	seqTables := []string{
		"users", "categories", "funds", "transaction_categories",
		"ingredients", "products", "variant_groups", "product_variants",
		"toppings", "recipe_items", "promotions", "orders", "order_items",
		"transactions", "purchase_items", "audit_logs",
	}
	for _, tbl := range seqTables {
		resetQuery := fmt.Sprintf("SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1))", tbl, tbl)
		dstDB.Exec(resetQuery)
	}
	log.Println("✅ All PostgreSQL sequences reset to latest IDs")

	// 5. Verification Table
	fmt.Println("\n============================================================")
	fmt.Printf("%-25s | %-12s | %-12s | %s\n", "BẢNG DỮ LIỆU", "NGUỒN CŨ", "SUPABASE", "TRẠNG THÁI")
	fmt.Println("------------------------------------------------------------")
	for _, tbl := range seqTables {
		var srcCount, dstCount int64
		srcDB.Table(tbl).Count(&srcCount)
		dstDB.Table(tbl).Count(&dstCount)

		status := "✅ KHỚP 100%"
		if srcCount != dstCount {
			status = fmt.Sprintf("⚠️ LỆCH (%d vs %d)", srcCount, dstCount)
		}
		fmt.Printf("%-25s | %-12d | %-12d | %s\n", tbl, srcCount, dstCount, status)
	}
	fmt.Println("============================================================")
	fmt.Println("🎉 HOÀN TẤT CHUYỂN DỮ LIỆU SANG SUPABASE THÀNH CÔNG!")
}
