package main

import (
	"fmt"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load("/opt/RabbitPOS/.env")
	cfg, _ := config.LoadConfig()
	cfg.DBHost = "localhost"
	db, _ := database.InitDB(cfg)

	now := time.Now()
	fmt.Printf("Go runtime time: %s, location: %s\n", now.Format("2006-01-02 15:04:05"), now.Location().String())

	// Check min and max order dates in DB
	var minDate, maxDate time.Time
	db.Model(&models.Order{}).Select("MIN(created_at)").Scan(&minDate)
	db.Model(&models.Order{}).Select("MAX(created_at)").Scan(&maxDate)
	fmt.Printf("DB Order Date Range: %s -> %s\n", minDate.Format("2006-01-02 15:04:05"), maxDate.Format("2006-01-02 15:04:05"))

	// Test Date queries
	testRanges := []struct {
		name string
		from time.Time
		to   time.Time
	}{
		{"All August 2026 (Month)", time.Date(2026, 8, 1, 0, 0, 0, 0, time.Local), time.Date(2026, 8, 31, 23, 59, 59, 999999999, time.Local)},
		{"July 2026", time.Date(2026, 7, 1, 0, 0, 0, 0, time.Local), time.Date(2026, 7, 31, 23, 59, 59, 999999999, time.Local)},
		{"2026-08-20 (Today/Yesterday)", time.Date(2026, 8, 20, 0, 0, 0, 0, time.Local), time.Date(2026, 8, 20, 23, 59, 59, 999999999, time.Local)},
	}

	for _, tr := range testRanges {
		var count int64
		var sumTotal float64
		db.Model(&models.Order{}).Where("created_at >= ? AND created_at <= ?", tr.from, tr.to).Count(&count)
		db.Model(&models.Order{}).Where("created_at >= ? AND created_at <= ?", tr.from, tr.to).Select("COALESCE(SUM(total_amount), 0)").Scan(&sumTotal)
		fmt.Printf("Range [%s]: %d orders, Total revenue: %.0f VND\n", tr.name, count, sumTotal)
	}
}
