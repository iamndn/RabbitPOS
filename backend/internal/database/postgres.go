package database

import (
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

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
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

	// Auto-migrate domain models to ensure schema is always up-to-date
	err = db.AutoMigrate(
		&models.Category{},
		&models.Product{},
		&models.ProductVariant{},
		&models.VariantGroup{},
		&models.Fund{},
		&models.Order{},
		&models.OrderItem{},
		&models.Transaction{},
		&models.User{},
		&models.Setting{},
	)
	if err != nil {
		log.Printf("Warning: Failed during DB auto-migration: %v", err)
		return nil, err
	}

	log.Println("Database auto-migration completed successfully")

	// ── Essential Core Seeds (always run, all environments) ─────────────────
	// These are required for the application to function at all.
	// They are idempotent — only insert when the table is empty.
	seedUsers(db, cfg)
	seedFunds(db)
	seedSettings(db)

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

// seedUsers creates the initial admin (and optionally staff) account if no users exist.
// Credentials are injected from environment variables — no hardcoded passwords.
func seedUsers(db *gorm.DB, cfg *config.Config) {
	var count int64
	db.Model(&models.User{}).Count(&count)
	if count > 0 {
		return
	}

	log.Println("[SEED] No users found — seeding initial user accounts...")

	// Admin account: always created if credentials are available
	if cfg.InitialAdminUsername != "" && cfg.InitialAdminPassword != "" {
		adminHash, err := bcrypt.GenerateFromPassword([]byte(cfg.InitialAdminPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("[SEED] ERROR: Failed to hash admin password: %v", err)
		} else {
			admin := models.User{
				Username:     cfg.InitialAdminUsername,
				PasswordHash: string(adminHash),
				Role:         models.RoleAdmin,
				IsActive:     true,
			}
			if result := db.Create(&admin); result.Error != nil {
				log.Printf("[SEED] ERROR: Failed to create admin user: %v", result.Error)
			} else {
				log.Printf("[SEED] Admin account '%s' created successfully.", cfg.InitialAdminUsername)
			}
		}
	} else {
		log.Println("[SEED] WARNING: INITIAL_ADMIN_USERNAME or INITIAL_ADMIN_PASSWORD not set — skipping admin account creation.")
	}

	// Staff account: only created when seeding is enabled (development mode)
	if cfg.EnableSeeding && cfg.InitialStaffUsername != "" && cfg.InitialStaffPassword != "" {
		staffHash, err := bcrypt.GenerateFromPassword([]byte(cfg.InitialStaffPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("[SEED] ERROR: Failed to hash staff password: %v", err)
		} else {
			staff := models.User{
				Username:     cfg.InitialStaffUsername,
				PasswordHash: string(staffHash),
				Role:         models.RoleStaff,
				IsActive:     true,
			}
			if result := db.Create(&staff); result.Error != nil {
				log.Printf("[SEED] ERROR: Failed to create staff user: %v", result.Error)
			} else {
				log.Printf("[SEED] Staff account '%s' created successfully.", cfg.InitialStaffUsername)
			}
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
			Name:           "Cash Drawer",
			FundType:       models.FundTypeCash,
			CurrentBalance: 0.00,
			IsActive:       true,
		},
		{
			Name:           "Bank Transfer",
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
		{Key: "store_address", Value: "", UpdatedAt: now},
		{Key: "store_phone", Value: "", UpdatedAt: now},
		{Key: "currency_code", Value: "VND", UpdatedAt: now},
		{Key: "currency_symbol", Value: "đ", UpdatedAt: now},
		{Key: "currency_position", Value: "suffix", UpdatedAt: now},
		{Key: "vietqr_bank_id", Value: "", UpdatedAt: now},
		{Key: "vietqr_account_no", Value: "", UpdatedAt: now},
		{Key: "vietqr_account_name", Value: "", UpdatedAt: now},
	}

	for _, s := range defaultSettings {
		if result := db.Create(&s); result.Error != nil {
			log.Printf("[SEED] ERROR: Failed to seed setting '%s': %v", s.Key, result.Error)
		}
	}
	log.Println("[SEED] Default system settings seeded successfully.")
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
		{Name: "Coffee", DisplayOrder: 1, IsActive: true},
		{Name: "Fruit Juices", DisplayOrder: 2, IsActive: true},
		{Name: "Tea & Milk Tea", DisplayOrder: 3, IsActive: true},
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
			name: "Espresso", categoryKey: "Coffee",
			description: "Rich and bold single origin dark roast espresso",
			imageURL:    "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M (Single Shot)", CogsPrice: 0.80, RetailPrice: 2.50, SKU: "COF-ESP-M", IsActive: true},
				{VariantName: "Size L (Double Shot)", CogsPrice: 1.10, RetailPrice: 3.20, SKU: "COF-ESP-L", IsActive: true},
			},
		},
		{
			name: "Orange Juice", categoryKey: "Fruit Juices",
			description: "100% pure freshly squeezed navel orange juice",
			imageURL:    "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Size M (350ml)", CogsPrice: 1.00, RetailPrice: 3.00, SKU: "JUC-ORG-M", IsActive: true},
				{VariantName: "Size L (500ml)", CogsPrice: 1.40, RetailPrice: 4.00, SKU: "JUC-ORG-L", IsActive: true},
			},
		},
		{
			name: "Avocado Smoothie", categoryKey: "Fruit Juices",
			description: "Creamy fresh avocado blended with condensed milk",
			imageURL:    "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500",
			tag:         models.TagNew,
			variants: []models.ProductVariant{
				{VariantName: "Size M (350ml)", CogsPrice: 1.50, RetailPrice: 4.00, SKU: "JUC-AVO-M", IsActive: true},
				{VariantName: "Size L (500ml)", CogsPrice: 2.00, RetailPrice: 5.00, SKU: "JUC-AVO-L", IsActive: true},
			},
		},
		{
			name: "Milk Tea Boba", categoryKey: "Tea & Milk Tea",
			description: "Classic black milk tea with chewy tapioca pearls",
			imageURL:    "https://images.unsplash.com/photo-1558857563-b371033873b8?w=500",
			tag:         models.TagBestSeller,
			variants: []models.ProductVariant{
				{VariantName: "Regular (Size M)", CogsPrice: 1.20, RetailPrice: 3.50, SKU: "TEA-BOB-REG", IsActive: true},
				{VariantName: "Large w/ Cream Cheese", CogsPrice: 1.80, RetailPrice: 4.80, SKU: "TEA-BOB-LRG", IsActive: true},
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
