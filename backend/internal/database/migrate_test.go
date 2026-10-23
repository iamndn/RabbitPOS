package database

import (
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/migrations"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var scratchCounter int64

// newScratchDB creates an isolated empty database on the server in TEST_DATABASE_URL.
// It skips when the variable is unset so tests can never touch dev/production databases by default.
func newScratchDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
	}
	admin, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Skipf("test database unreachable: %v", err)
	}
	name := fmt.Sprintf("scratch_%d_%d", time.Now().UnixNano()%1_000_000_000, atomic.AddInt64(&scratchCounter, 1))
	if err := admin.Exec("CREATE DATABASE " + name).Error; err != nil {
		t.Fatalf("create scratch db: %v", err)
	}
	// Replace dbname in a key=value DSN.
	parts := strings.Fields(dsn)
	for i, p := range parts {
		if strings.HasPrefix(p, "dbname=") {
			parts[i] = "dbname=" + name
		}
	}
	db, err := gorm.Open(postgres.Open(strings.Join(parts, " ")), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatalf("open scratch db: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
		admin.Exec("DROP DATABASE IF EXISTS " + name + " WITH (FORCE)")
		if sqlDB, err := admin.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func allModels() []interface{} {
	return []interface{}{
		&models.Category{}, &models.Product{}, &models.ProductVariant{}, &models.VariantGroup{},
		&models.Fund{}, &models.Promotion{}, &models.Order{}, &models.OrderItem{}, &models.Transaction{},
		&models.User{}, &models.Setting{}, &models.Topping{}, &models.TransactionCategoryItem{},
		&models.Ingredient{}, &models.PurchaseItem{}, &models.RecipeItem{}, &models.IdempotencyRecord{},
		&models.AuditLog{}, &models.RevokedToken{}, &models.FundReconciliation{},
		&models.Store{}, &models.UserStore{}, &models.StoreSetting{},
	}
}

// makeLegacyDB builds a pre-multi-store database: current schema, then the 000020 down script,
// then legacy sample data.
func makeLegacyDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := newScratchDB(t)
	if err := db.AutoMigrate(allModels()...); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	down, err := migrations.FS.ReadFile("000020_multi_store_foundation.down.sql")
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	if _, err := sqlDB.Exec(string(down)); err != nil {
		t.Fatalf("apply down script: %v", err)
	}
	exec := func(q string, args ...interface{}) {
		if err := db.Exec(q, args...).Error; err != nil {
			t.Fatalf("seed legacy: %v\n%s", err, q)
		}
	}
	exec(`INSERT INTO users (username, password_hash, email, role, is_active, needs_password_setup, token_version, created_at, updated_at)
		VALUES ('ndn','x','','admin',TRUE,FALSE,1,NOW(),NOW()), ('nhung','x','','admin',TRUE,FALSE,1,NOW(),NOW()), ('staff1','x','','staff',TRUE,FALSE,1,NOW(),NOW())`)
	exec(`INSERT INTO funds (name, fund_type, current_balance, is_active, created_at, updated_at) VALUES ('Tiền mặt','cash',123456,TRUE,NOW(),NOW())`)
	exec(`INSERT INTO categories (name, is_active, created_at, updated_at) VALUES ('Cà phê',TRUE,NOW(),NOW())`)
	exec(`INSERT INTO settings (key, value) VALUES ('store_name','Thỏ Juice & Coffee'), ('currency_symbol','đ')`)
	return db
}

func TestRunSQLMigrations_LegacyBaseline(t *testing.T) {
	db := makeLegacyDB(t)
	if err := RunSQLMigrations(db, migrations.FS); err != nil {
		t.Fatalf("RunSQLMigrations: %v", err)
	}

	var storeName string
	if err := db.Raw("SELECT name FROM stores WHERE id = 1").Scan(&storeName).Error; err != nil || storeName == "" {
		t.Fatalf("store 1 missing: %v %q", err, storeName)
	}
	var balance float64
	db.Raw("SELECT current_balance FROM funds LIMIT 1").Scan(&balance)
	if balance != 123456 {
		t.Errorf("fund balance changed: %v", balance)
	}
	var wrong int64
	db.Raw("SELECT COUNT(*) FROM categories WHERE store_id <> 1").Scan(&wrong)
	if wrong != 0 {
		t.Errorf("categories not in store 1: %d", wrong)
	}
	var members int64
	db.Raw("SELECT COUNT(*) FROM user_stores WHERE store_id = 1").Scan(&members)
	if members != 3 {
		t.Errorf("expected 3 memberships, got %d", members)
	}
	var adminRoles int64
	db.Raw("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&adminRoles)
	if adminRoles != 2 {
		t.Errorf("legacy admin roles must be untouched (D-4), got %d", adminRoles)
	}

	var versions int64
	db.Raw("SELECT COUNT(*) FROM schema_migrations").Scan(&versions)
	if versions < 2 {
		t.Errorf("expected baseline + 000020 recorded, got %d rows", versions)
	}

	// Idempotent re-run.
	if err := RunSQLMigrations(db, migrations.FS); err != nil {
		t.Fatalf("second run: %v", err)
	}
	var after int64
	db.Raw("SELECT COUNT(*) FROM schema_migrations").Scan(&after)
	if after != versions {
		t.Errorf("re-run changed schema_migrations: %d -> %d", versions, after)
	}

	// AutoMigrate afterwards must keep the default and not bring back global unique indexes.
	if err := db.AutoMigrate(allModels()...); err != nil {
		t.Fatalf("post automigrate: %v", err)
	}
	var idx int64
	db.Raw(`SELECT COUNT(*) FROM pg_indexes WHERE indexname IN ('idx_ingredients_name') AND indexdef LIKE 'CREATE UNIQUE%' AND indexdef NOT LIKE '%store_id%'`).Scan(&idx)
	if idx != 0 {
		t.Errorf("global unique ingredient index resurrected")
	}
	if err := db.Exec(`INSERT INTO categories (name, is_active, created_at, updated_at) VALUES ('X',TRUE,NOW(),NOW())`).Error; err != nil {
		t.Errorf("store_id default 1 lost: %v", err)
	}
}

func TestRunSQLMigrations_FreshDB(t *testing.T) {
	db := newScratchDB(t)
	if err := RunSQLMigrations(db, migrations.FS); err != nil {
		t.Fatalf("fresh run: %v", err)
	}
	var n int64
	db.Raw("SELECT COUNT(*) FROM schema_migrations WHERE baseline = TRUE").Scan(&n)
	if n == 0 {
		t.Errorf("fresh DB should baseline all versions")
	}
	// No stores table should exist: 000020 is baselined, AutoMigrate builds it later.
	var exists bool
	db.Raw("SELECT to_regclass('stores') IS NOT NULL").Scan(&exists)
	if exists {
		t.Errorf("000020 must not execute on a fresh DB")
	}
	if err := RunSQLMigrations(db, migrations.FS); err != nil {
		t.Fatalf("idempotent run: %v", err)
	}
}
