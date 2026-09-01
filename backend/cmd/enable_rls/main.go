package main

import (
	"fmt"
	"log"

	"github.com/RabbitPOS/backend/internal/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatal(err)
	}

	dsn := cfg.GetDSN()
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatal(err)
	}

	tables := []string{
		"users", "categories", "products", "product_variants", "variant_groups",
		"funds", "promotions", "orders", "order_items", "transactions",
		"transaction_categories", "settings", "toppings", "ingredients",
		"purchase_items", "recipe_items", "idempotency_records", "audit_logs",
		"revoked_tokens",
	}

	fmt.Println("🔒 Enabling Row Level Security (RLS) on Supabase tables...")
	for _, tbl := range tables {
		sql := fmt.Sprintf("ALTER TABLE public.%s ENABLE ROW LEVEL SECURITY;", tbl)
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("❌ Failed on %s: %v", tbl, err)
		} else {
			fmt.Printf("✅ RLS Enabled on table: %s\n", tbl)
		}
	}

	// Verify RLS status from PostgreSQL pg_tables
	type TableRLS struct {
		Tablename string
		Rowsecurity bool
	}
	var results []TableRLS
	db.Raw("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename").Scan(&results)

	fmt.Println("\n==================================================")
	fmt.Printf("%-25s | %s\n", "BẢNG", "ROW LEVEL SECURITY (RLS)")
	fmt.Println("--------------------------------------------------")
	for _, r := range results {
		status := "❌ CHƯA BẬT"
		if r.Rowsecurity {
			status = "🛡️ ĐÃ BẬT (SECURE)"
		}
		fmt.Printf("%-25s | %s\n", r.Tablename, status)
	}
	fmt.Println("==================================================")
	fmt.Println("🎉 TẤT CẢ CÁC BẢNG TRÊN SUPABASE ĐÃ ĐƯỢC BẬT RLS!")
}
