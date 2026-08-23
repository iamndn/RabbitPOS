package database

import (
	"errors"
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB initializes GORM PostgreSQL connection and executes schema migrations
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetDSN()

	logLevel := logger.Warn
	if cfg.AppEnv == "development" {
		logLevel = logger.Info
	}

	gormConfig := &gorm.Config{
		Logger:      logger.Default.LogMode(logLevel),
		PrepareStmt: true,
	}

	var db *gorm.DB
	var err error

	// Retry connection up to 5 times for containerized startup synchronization
	for i := 1; i <= 5; i++ {
		db, err = gorm.Open(postgres.Open(dsn), gormConfig)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to PostgreSQL (attempt %d/5): %v. Retrying in 2s...", i, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, err
	}

	log.Println("Successfully connected to PostgreSQL database")

	// Configure PostgreSQL connection pool for production performance
	sqlDB, err := db.DB()
	if err != nil {
		log.Printf("Failed to get generic database object from GORM: %v", err)
		return nil, err
	}
	sqlDB.SetMaxOpenConns(30)
	sqlDB.SetMaxIdleConns(15)
	sqlDB.SetConnMaxLifetime(10 * time.Minute)
	sqlDB.SetConnMaxIdleTime(3 * time.Minute)

	// Auto-migrate domain models to ensure schema is always up-to-date
	err = db.AutoMigrate(
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
	)
	if err != nil {
		log.Printf("Warning: Failed during DB auto-migration: %v", err)
		return nil, err
	}

	// Ensure foreign key constraint fk_orders_promotion has ON DELETE SET NULL & ON UPDATE CASCADE
	db.Exec(`
		DO $$
		BEGIN
			IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_promotion') THEN
				ALTER TABLE orders DROP CONSTRAINT fk_orders_promotion;
			END IF;
			IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_promotion_id_fkey') THEN
				ALTER TABLE orders DROP CONSTRAINT orders_promotion_id_fkey;
			END IF;
			ALTER TABLE orders ADD CONSTRAINT fk_orders_promotion 
				FOREIGN KEY (promotion_id) REFERENCES promotions(id) 
				ON UPDATE CASCADE ON DELETE SET NULL;
		EXCEPTION
			WHEN others THEN NULL;
		END $$;
	`)

	// Phase 6: High Performance Composite Indexes for POS, Analytics & Financial Ledger
	db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders (created_at DESC, status);
		CREATE INDEX IF NOT EXISTS idx_transactions_created_type ON transactions (created_at DESC, transaction_type);
		CREATE INDEX IF NOT EXISTS idx_transactions_fund_created ON transactions (fund_id, created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
	`)

	log.Println("Database auto-migration and performance indexing completed successfully")

	// ── Essential Core Seeds (always run, all environments) ─────────────────
	// These are required for the application to function at all.
	// They are idempotent — only insert when the record/table is empty.
	seedUsers(db, cfg)
	seedFunds(db)
	seedSettings(db)
	seedTransactionCategories(db)

	// ── Development / Demo Seeds (controlled by ENABLE_SEEDING flag) ─────────
	// Sample catalog data (products, categories) helps developers get started
	// quickly but MUST NOT run in production to avoid polluting real data.
	if cfg.EnableSeeding {
		log.Println("[SEEDING] ENABLE_SEEDING=true — running demo catalog seed data...")
		seedDemoCatalog(db)
		log.Println("[SEEDING] Demo catalog seed completed.")
	} else {
		log.Println("[SEEDING] ENABLE_SEEDING=false — skipping demo catalog seed (production mode).")
	}

	return db, nil
}

// seedUsers manages initial accounts and ensures legacy default accounts are removed.
func seedUsers(db *gorm.DB, cfg *config.Config) {
	// Remove legacy default accounts 'admin' and 'staff' if they exist
	if result := db.Where("username IN ?", []string{"admin", "staff"}).Delete(&models.User{}); result.Error == nil && result.RowsAffected > 0 {
		log.Printf("[SEED] Removed %d legacy default user account(s) (admin/staff).", result.RowsAffected)
	}

	// Mandatory cashier accounts: NDN, NHUNG, DAT
	// These are seeded with needs_password_setup=true — users MUST change their password on first login.
	// Temporary password is the username itself (lowercase) — e.g. "ndn", "nhung", "dat"
	mandatoryCashiers := []struct {
		Username string
		TempPass string
	}{
		{"NDN", "ndn"},
		{"NHUNG", "nhung"},
		{"DAT", "dat"},
	}

	for _, cashier := range mandatoryCashiers {
		var existingUser models.User
		cashierErr := db.Where("username = ?", cashier.Username).First(&existingUser).Error
		if errors.Is(cashierErr, gorm.ErrRecordNotFound) {
			tempHash, hashErr := bcrypt.GenerateFromPassword([]byte(cashier.TempPass), bcrypt.DefaultCost)
			if hashErr != nil {
				log.Printf("[SEED] ERROR: Failed to hash temp password for '%s': %v", cashier.Username, hashErr)
				continue
			}
			newCashier := models.User{
				Username:           cashier.Username,
				PasswordHash:       string(tempHash),
				Role:               models.RoleAdmin,
				IsActive:           true,
				NeedsPasswordSetup: true,
			}
			if result := db.Create(&newCashier); result.Error != nil {
				log.Printf("[SEED] ERROR: Failed to create cashier account '%s': %v", cashier.Username, result.Error)
			} else {
				log.Printf("[SEED] Cashier account '%s' created (needs_password_setup=true).", cashier.Username)
			}
		} else if cashierErr == nil {
			log.Printf("[SEED] Cashier account '%s' already exists — skipping.", cashier.Username)
		} else {
			log.Printf("[SEED] ERROR: Failed to check cashier '%s': %v", cashier.Username, cashierErr)
		}
	}
}

// seedFunds creates the essential payment fund accounts if none exist.
// These are required for POS checkout to function in any environment.
func seedFunds(db *gorm.DB) {
	var count int64
	db.Model(&models.Fund{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("[SEED] No funds found — seeding essential payment funds...")

	defaultFunds := []models.Fund{
		{
			Name:           "Tiền mặt",
			FundType:       models.FundTypeCash,
			CurrentBalance: 0.00,
			IsActive:       true,
		},
		{
			Name:           "Chuyển khoản",
			FundType:       models.FundTypeBank,
			CurrentBalance: 0.00,
			IsActive:       true,
		},
	}

	for _, fund := range defaultFunds {
		if result := db.Create(&fund); result.Error != nil {
			log.Printf("[SEED] ERROR: Failed to seed fund '%s': %v", fund.Name, result.Error)
		} else {
			log.Printf("[SEED] Payment fund '%s' (%s) seeded successfully.", fund.Name, fund.FundType)
		}
	}
}

// seedSettings creates default system configuration if the settings table is empty.
// Settings keys are essential application configuration — not demo data.
func seedSettings(db *gorm.DB) {
	var count int64
	db.Model(&models.Setting{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("[SEED] No settings found — seeding default system configuration...")
	now := time.Now()
	defaultSettings := []models.Setting{
		{Key: "store_name", Value: "Tho Juice & Coffee", UpdatedAt: now},
		{Key: "store_address", Value: "Số 72 Ngõ 245 Định Công, P.Định Công, Hà Nội", UpdatedAt: now},
		{Key: "store_phone", Value: "0869910956", UpdatedAt: now},
		{Key: "currency_code", Value: "VND", UpdatedAt: now},
		{Key: "currency_symbol", Value: "đ", UpdatedAt: now},
		{Key: "currency_position", Value: "suffix", UpdatedAt: now},
		{Key: "vietqr_bank_id", Value: "MB", UpdatedAt: now},
		{Key: "vietqr_account_no", Value: "0298618519999", UpdatedAt: now},
		{Key: "vietqr_account_name", Value: "TRAN THI HONG NHUNG", UpdatedAt: now},
		{Key: "store_logo_url", Value: "", UpdatedAt: now},
	}

	for _, s := range defaultSettings {
		if result := db.Create(&s); result.Error != nil {
			log.Printf("[SEED] ERROR: Failed to seed setting '%s': %v", s.Key, result.Error)
		}
	}
	log.Println("[SEED] Default system settings seeded successfully.")

	// Ensure store_logo_url exists even if settings were already seeded previously
	var logoSetting models.Setting
	if err := db.Where("key = ?", "store_logo_url").First(&logoSetting).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			db.Create(&models.Setting{Key: "store_logo_url", Value: "", UpdatedAt: now})
			log.Println("[SEED] Setting 'store_logo_url' added to existing settings.")
		}
	}

	// Ensure Google Sheets sync settings exist even if settings were already seeded previously
	googleSheetsDefaults := []models.Setting{
		{Key: "google_sheets_sync_enabled", Value: "false", UpdatedAt: now},
		{Key: "google_sheets_spreadsheet_id", Value: "", UpdatedAt: now},
		{Key: "google_sheets_service_account_json", Value: "", UpdatedAt: now},
		{Key: "google_sheets_auto_realtime_sync", Value: "true", UpdatedAt: now},
		{Key: "google_sheets_last_synced_at", Value: "", UpdatedAt: now},
		{Key: "google_sheets_last_sync_status", Value: "idle", UpdatedAt: now},
		{Key: "google_sheets_last_sync_error", Value: "", UpdatedAt: now},
	}
	for _, gs := range googleSheetsDefaults {
		var s models.Setting
		if err := db.Where("key = ?", gs.Key).First(&s).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				db.Create(&gs)
				log.Printf("[SEED] Setting '%s' added to existing settings.", gs.Key)
			}
		}
	}
}

// seedDemoCatalog inserts sample products and categories for development/demo purposes.
// This function is ONLY called when cfg.EnableSeeding is true.
// It is completely skipped in production to prevent polluting real store data.
func seedDemoCatalog(db *gorm.DB) {
	var catCount int64
	db.Model(&models.Category{}).Count(&catCount)
	if catCount > 0 {
		log.Println("[SEED] Demo catalog: categories already exist — skipping.")
		return
	}

	log.Println("[SEED] Inserting demo catalog: categories, products, and variants...")

	// Insert demo categories
	categories := []models.Category{
		{Name: "Cà phê", DisplayOrder: 1, IsActive: true},
		{Name: "Nước ép tươi", DisplayOrder: 2, IsActive: true},
		{Name: "Trà & Trà sữa", DisplayOrder: 3, IsActive: true},
	}
	if err := db.Create(&categories).Error; err != nil {
		log.Printf("[SEED] ERROR: Failed to seed demo categories: %v", err)
		return
	}

	// Map category names to IDs for product association
	catMap := map[string]uint{}
	for _, c := range categories {
		catMap[c.Name] = c.ID
	}

	// Insert demo products with embedded variants
	type demoProduct struct {
		name        string
		categoryKey string
		description string
		imageURL    string
		tag         models.ProductTag
		variants    []models.ProductVariant
	}

	demoProducts := []demoProduct{
		{
			name: "Cà phê Đen Đá", categoryKey: "Cà phê",
			description: "Cà phê Robusta Đắk Lắk pha phin truyền thống đậm đà",
			imageURL:    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M", CogsPrice: 8000, RetailPrice: 20000, SKU: "CF-DEN-M", IsActive: true},
				{VariantName: "Size L", CogsPrice: 10000, RetailPrice: 25000, SKU: "CF-DEN-L", IsActive: true},
			},
		},
		{
			name: "Cà phê Sữa Đá", categoryKey: "Cà phê",
			description: "Cà phê phin hòa quyện sữa đặc béo ngậy thơm ngon",
			imageURL:    "https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M", CogsPrice: 10000, RetailPrice: 25000, SKU: "CF-SUA-M", IsActive: true},
				{VariantName: "Size L", CogsPrice: 12000, RetailPrice: 30000, SKU: "CF-SUA-L", IsActive: true},
			},
		},
		{
			name: "Bạc Xỉu", categoryKey: "Cà phê",
			description: "Nhiều sữa ít cà phê ngọt dịu êm ái",
			imageURL:    "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500",
			tag:         models.TagNew,
			variants: []models.ProductVariant{
				{VariantName: "Size M", CogsPrice: 11000, RetailPrice: 29000, SKU: "CF-BAC-M", IsActive: true},
				{VariantName: "Size L", CogsPrice: 14000, RetailPrice: 35000, SKU: "CF-BAC-L", IsActive: true},
			},
		},
		{
			name: "Nước ép Cam Cà Rốt", categoryKey: "Nước ép tươi",
			description: "100% cam sành vắt tươi kết hợp cà rốt giàu vitamin A & C",
			imageURL:    "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M (350ml)", CogsPrice: 15000, RetailPrice: 35000, SKU: "NE-CAM-M", IsActive: true},
				{VariantName: "Size L (500ml)", CogsPrice: 18000, RetailPrice: 42000, SKU: "NE-CAM-L", IsActive: true},
			},
		},
		{
			name: "Nước ép Táo Dứa", categoryKey: "Nước ép tươi",
			description: "Táo xanh giòn ngọt thanh mát hòa quyện dứa tươi chua nhẹ",
			imageURL:    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500",
			tag:         models.TagNew,
			variants: []models.ProductVariant{
				{VariantName: "Size M (350ml)", CogsPrice: 16000, RetailPrice: 39000, SKU: "NE-TAO-M", IsActive: true},
				{VariantName: "Size L (500ml)", CogsPrice: 20000, RetailPrice: 46000, SKU: "NE-TAO-L", IsActive: true},
			},
		},
		{
			name: "Nước ép Ổi Hồng", categoryKey: "Nước ép tươi",
			description: "Ổi hồng tươi thơm lừng, bổ sung vitamin tự nhiên mỗi ngày",
			imageURL:    "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M (350ml)", CogsPrice: 14000, RetailPrice: 35000, SKU: "NE-OI-M", IsActive: true},
				{VariantName: "Size L (500ml)", CogsPrice: 17000, RetailPrice: 42000, SKU: "NE-OI-L", IsActive: true},
			},
		},
		{
			name: "Trà Sữa Trân Châu", categoryKey: "Trà & Trà sữa",
			description: "Trà đen hảo hạng quyện sữa béo cùng trân châu dai giòn",
			imageURL:    "https://images.unsplash.com/photo-1558857563-b371033873b8?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M", CogsPrice: 14000, RetailPrice: 35000, SKU: "TS-TC-M", IsActive: true},
				{VariantName: "Size L", CogsPrice: 18000, RetailPrice: 45000, SKU: "TS-TC-L", IsActive: true},
			},
		},
	}

	for _, dp := range demoProducts {
		catID, ok := catMap[dp.categoryKey]
		if !ok {
			continue
		}

		product := models.Product{
			CategoryID:  catID,
			Name:        dp.name,
			Description: dp.description,
			ImageURL:    dp.imageURL,
			Tag:         dp.tag,
			IsActive:    true,
		}

		if err := db.Create(&product).Error; err != nil {
			log.Printf("[SEED] ERROR: Failed to seed demo product '%s': %v", dp.name, err)
			continue
		}

		// Associate variants with the newly created product
		for i := range dp.variants {
			dp.variants[i].ProductID = product.ID
		}
		if err := db.Create(&dp.variants).Error; err != nil {
			log.Printf("[SEED] ERROR: Failed to seed variants for '%s': %v", dp.name, err)
		}
	}

	log.Println("[SEED] Demo catalog seeded successfully.")
}

// seedTransactionCategories initializes default system transaction categories if table is empty
func seedTransactionCategories(db *gorm.DB) {
	var count int64
	db.Model(&models.TransactionCategoryItem{}).Count(&count)
	if count > 0 {
		return
	}

	defaultCategories := []models.TransactionCategoryItem{
		{Name: "Mua nguyên liệu", Type: "outflow", Code: "ingredient_purchase", IsDefault: true, IsSystem: false},
		{Name: "Chi phí vận hành", Type: "outflow", Code: "utility_bill", IsDefault: false, IsSystem: false},
		{Name: "Chi phí khác", Type: "outflow", Code: "other", IsDefault: false, IsSystem: false},
		{Name: "Doanh thu bán hàng", Type: "inflow", Code: "sale", IsDefault: true, IsSystem: false},
		{Name: "Thu nhập khác", Type: "inflow", Code: "other", IsDefault: false, IsSystem: false},
		{Name: "Chênh lệch đối soát", Type: "both", Code: "reconciliation_variance", IsDefault: false, IsSystem: false},
	}

	for _, cat := range defaultCategories {
		if err := db.Create(&cat).Error; err != nil {
			log.Printf("[SEED] Failed to seed transaction category %s: %v", cat.Name, err)
		}
	}
	log.Println("[SEED] Default transaction categories initialized successfully.")
}

