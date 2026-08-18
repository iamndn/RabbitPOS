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
		&models.Topping{},
	)
	if err != nil {
		log.Printf("Warning: Failed during DB auto-migration: %v", err)
		return nil, err
	}

	log.Println("Database auto-migration completed successfully")

	// ── Essential Core Seeds (always run, all environments) ─────────────────
	// These are required for the application to function at all.
	// They are idempotent — only insert when the record/table is empty.
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

// seedUsers creates the initial admin (and optionally staff) account if they do not exist.
// Credentials are injected from environment variables — no hardcoded passwords.
func seedUsers(db *gorm.DB, cfg *config.Config) {
	// Admin account: ensure initial admin exists regardless of other users or ENABLE_SEEDING setting
	if cfg.InitialAdminUsername != "" {
		var adminUser models.User
		err := db.Where("username = ?", cfg.InitialAdminUsername).First(&adminUser).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if cfg.InitialAdminPassword != "" {
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
				log.Printf("[SEED] WARNING: INITIAL_ADMIN_PASSWORD not set — skipping admin account creation for '%s'.", cfg.InitialAdminUsername)
			}
		} else if err == nil && cfg.InitialAdminPassword != "" {
			// Update password hash to ensure admin password is in sync
			adminHash, err := bcrypt.GenerateFromPassword([]byte(cfg.InitialAdminPassword), bcrypt.DefaultCost)
			if err == nil {
				db.Model(&adminUser).Update("password_hash", string(adminHash))
			}
		} else if err != nil {
			log.Printf("[SEED] ERROR: Failed to check admin user existence: %v", err)
		}
	} else {
		log.Println("[SEED] WARNING: INITIAL_ADMIN_USERNAME not set — skipping admin account creation.")
	}

	// Staff account: ensure staff user exists for testing and multi-role operations
	var staffUser models.User
	staffUsername := cfg.InitialStaffUsername
	if staffUsername == "" {
		staffUsername = "staff"
	}
	staffPassword := cfg.InitialStaffPassword
	if staffPassword == "" {
		staffPassword = "staff123"
	}
	err := db.Where("username = ?", staffUsername).First(&staffUser).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		staffHash, err := bcrypt.GenerateFromPassword([]byte(staffPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Printf("[SEED] ERROR: Failed to hash staff password: %v", err)
		} else {
			staff := models.User{
				Username:     staffUsername,
				PasswordHash: string(staffHash),
				Role:         models.RoleStaff,
				IsActive:     true,
			}
			if result := db.Create(&staff); result.Error != nil {
				log.Printf("[SEED] ERROR: Failed to create staff user: %v", result.Error)
			} else {
				log.Printf("[SEED] Staff account '%s' created successfully.", staffUsername)
			}
		}
	} else if err == nil {
		staffHash, err := bcrypt.GenerateFromPassword([]byte(staffPassword), bcrypt.DefaultCost)
		if err == nil {
			db.Model(&staffUser).Update("password_hash", string(staffHash))
		}
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
			Name:           "Tiền mặt tại quầy",
			FundType:       models.FundTypeCash,
			CurrentBalance: 0.00,
			IsActive:       true,
		},
		{
			Name:           "Chuyển khoản VietQR",
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
		{Key: "store_name", Value: "Thỏ Juice & Coffee", UpdatedAt: now},
		{Key: "store_address", Value: "123 Vo Van Kiet, D1, HCMC", UpdatedAt: now},
		{Key: "store_phone", Value: "0901234567", UpdatedAt: now},
		{Key: "currency_code", Value: "VND", UpdatedAt: now},
		{Key: "currency_symbol", Value: "đ", UpdatedAt: now},
		{Key: "currency_position", Value: "suffix", UpdatedAt: now},
		{Key: "vietqr_bank_id", Value: "MB", UpdatedAt: now},
		{Key: "vietqr_account_no", Value: "123456789", UpdatedAt: now},
		{Key: "vietqr_account_name", Value: "THO JUICE AND COFFEE", UpdatedAt: now},
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
