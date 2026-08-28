package testutils

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// TestFixtures holds seeded IDs and references for test cases
type TestFixtures struct {
	AdminUser      models.User
	StaffUser      models.User
	CashFund       models.Fund
	BankFund       models.Fund
	Category       models.Category
	Product        models.Product
	Variant        models.ProductVariant
	Topping        models.Topping
	Ingredient     models.Ingredient
	TransactionCat models.TransactionCategoryItem
}

// GetTestDB connects to the test database specified via TEST_DATABASE_URL or default local PostgreSQL
// If the database is not available, it calls t.Skip() to prevent test failures on environments without DB.
func GetTestDB(t *testing.T) *gorm.DB {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=admin password=password123 dbname=rabbitpos port=5432 sslmode=disable connect_timeout=2"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Skipf("PostgreSQL test database not available (%v), skipping database integration test.", err)
		return nil
	}

	if err := AutoMigrateAll(db); err != nil {
		t.Fatalf("Failed to auto-migrate test schema: %v", err)
	}

	return db
}

// AutoMigrateAll migrates all 16 GORM models in RabbitPOS
func AutoMigrateAll(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Category{},
		&models.Product{},
		&models.ProductVariant{},
		&models.VariantGroup{},
		&models.Fund{},
		&models.Promotion{},
		&models.Order{},
		&models.OrderItem{},
		&models.Transaction{},
		&models.User{},
		&models.Setting{},
		&models.Topping{},
		&models.TransactionCategoryItem{},
		&models.Ingredient{},
		&models.PurchaseItem{},
		&models.RecipeItem{},
		&models.IdempotencyRecord{},
		&models.AuditLog{},
		&models.RevokedToken{},
	)
}

// CleanTables deletes all records from all tables in reverse dependency order
func CleanTables(db *gorm.DB) error {
	tables := []string{
		"audit_logs",
		"revoked_tokens",
		"idempotency_records",
		"purchase_items",
		"order_items",
		"transactions",
		"orders",
		"recipe_items",
		"promotions",
		"variant_groups",
		"product_variants",
		"toppings",
		"products",
		"ingredients",
		"categories",
		"transaction_categories",
		"funds",
		"users",
		"settings",
	}

	for _, tbl := range tables {
		if err := db.Exec(fmt.Sprintf("DELETE FROM %s", tbl)).Error; err != nil {
			return err
		}
	}
	return nil
}

// SeedMinimalFixtures inserts standard minimal baseline records for tests
func SeedMinimalFixtures(db *gorm.DB) (*TestFixtures, error) {
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

	admin := models.User{
		Username:           "test_admin",
		PasswordHash:       string(hashedPassword),
		Role:               models.RoleAdmin,
		Email:              "admin@test.local",
		IsActive:           true,
		NeedsPasswordSetup: false,
	}
	staff := models.User{
		Username:           "test_staff",
		PasswordHash:       string(hashedPassword),
		Role:               models.RoleStaff,
		Email:              "staff@test.local",
		IsActive:           true,
		NeedsPasswordSetup: false,
	}

	cashFund := models.Fund{
		Name:           "Tiền mặt Test",
		FundType:       models.FundTypeCash,
		CurrentBalance: 1000000,
		IsActive:       true,
	}
	bankFund := models.Fund{
		Name:           "Ngân hàng Test",
		FundType:       models.FundTypeBank,
		CurrentBalance: 5000000,
		IsActive:       true,
	}

	cat := models.Category{
		Name:         "Cà Phê Test",
		DisplayOrder: 1,
		IsActive:     true,
	}

	ing := models.Ingredient{
		Name:                 "Hạt cà phê Robusta Test",
		Category:             "ingredient",
		Unit:                 "g",
		BaseUnit:             "g",
		LatestPurchasePrice:  180,
		AveragePurchasePrice: 180,
		YieldRate:            1.0,
		LossRate:             0.0,
	}

	txCat := models.TransactionCategoryItem{
		Name:         "Doanh thu bán hàng POS",
		Type:         "inflow",
		Code:         "POS_SALE",
		IsSystem:     true,
		DisplayOrder: 1,
	}

	var prod models.Product
	var variant models.ProductVariant
	var topping models.Topping

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&admin).Error; err != nil {
			return err
		}
		if err := tx.Create(&staff).Error; err != nil {
			return err
		}
		if err := tx.Create(&cashFund).Error; err != nil {
			return err
		}
		if err := tx.Create(&bankFund).Error; err != nil {
			return err
		}
		if err := tx.Create(&cat).Error; err != nil {
			return err
		}
		if err := tx.Create(&ing).Error; err != nil {
			return err
		}
		if err := tx.Create(&txCat).Error; err != nil {
			return err
		}

		prod = models.Product{
			CategoryID: cat.ID,
			Name:       "Cà Phê Sữa Đá Test",
			Tag:        models.TagBestSeller,
			IsActive:   true,
		}
		if err := tx.Create(&prod).Error; err != nil {
			return err
		}

		variant = models.ProductVariant{
			ProductID:   prod.ID,
			VariantName: "Size M",
			RetailPrice: 25000,
			CogsPrice:   8000,
			IsActive:    true,
		}
		if err := tx.Create(&variant).Error; err != nil {
			return err
		}

		topping = models.Topping{
			Name:       "Thạch Cà Phê Test",
			Price:      5000,
			COGS:       1500,
			CategoryID: &cat.ID,
			IsActive:   true,
		}
		if err := tx.Create(&topping).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &TestFixtures{
		AdminUser:      admin,
		StaffUser:      staff,
		CashFund:       cashFund,
		BankFund:       bankFund,
		Category:       cat,
		Product:        prod,
		Variant:        variant,
		Topping:        topping,
		Ingredient:     ing,
		TransactionCat: txCat,
	}, nil
}

// MakeMockTimestamp returns a fixed point in time for deterministic tests
func MakeMockTimestamp() time.Time {
	return time.Date(2026, time.August, 28, 12, 0, 0, 0, time.UTC)
}
