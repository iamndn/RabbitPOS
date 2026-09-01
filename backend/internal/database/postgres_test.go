package database

import (
	"fmt"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
)

func TestSupabaseConnection(t *testing.T) {
	cfg, err := config.LoadConfig()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	t.Logf("Testing connection to host=%s port=%s db=%s user=%s sslmode=%s",
		cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser, cfg.DBSSLMode)

	start := time.Now()
	db, err := InitDB(cfg)
	if err != nil {
		t.Fatalf("❌ FAILED to connect to Supabase: %v", err)
	}
	latency := time.Since(start)

	var version string
	if err := db.Raw("SELECT version()").Scan(&version).Error; err != nil {
		t.Fatalf("❌ Connected but failed to execute query: %v", err)
	}

	// Query table names to see migrated tables
	var tableCount int64
	db.Raw("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'").Scan(&tableCount)

	var tables []string
	db.Raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name LIMIT 10").Scan(&tables)

	t.Logf("✅ SUCCESS! Connected to Supabase PostgreSQL in %v", latency)
	t.Logf("PostgreSQL Version: %s", version)
	t.Logf("Total Public Tables: %d", tableCount)
	t.Logf("Sample Tables: %v", tables)
	fmt.Printf("\n========================================\n")
	fmt.Printf("✅ KẾT NỐI SUPABASE THÀNH CÔNG (Ping: %v)\n", latency)
	fmt.Printf("Phiên bản DB: %s\n", version)
	fmt.Printf("Tổng số bảng: %d\n", tableCount)
	fmt.Printf("========================================\n\n")
}
