package database

import (
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// storeRootTables are the tenant-scoped tables that carry a store_id column.
var storeRootTables = []string{
	"categories", "products", "toppings", "promotions", "funds",
	"orders", "transactions", "transaction_categories", "ingredients",
	"audit_logs", "idempotency_records",
}

// storeIndexStatements are non-structural composite indexes for the hot POS, ledger and analytics paths.
// They are idempotent and applied on every boot so legacy and fresh databases end up identical.
var storeIndexStatements = []string{
	`CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders (store_id, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_orders_store_status_created ON orders (store_id, status, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_store_created ON transactions (store_id, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_transactions_store_fund_created ON transactions (store_id, fund_id, created_at DESC)`,
	`CREATE INDEX IF NOT EXISTS idx_products_store_category ON products (store_id, category_id, is_active)`,
	`CREATE INDEX IF NOT EXISTS idx_categories_store_order ON categories (store_id, display_order)`,
	`CREATE INDEX IF NOT EXISTS idx_toppings_store_active ON toppings (store_id, is_active, display_order)`,
	`CREATE INDEX IF NOT EXISTS idx_promotions_store_active ON promotions (store_id, is_active, display_order)`,
	`CREATE INDEX IF NOT EXISTS idx_funds_store_active ON funds (store_id, is_active)`,
	`CREATE INDEX IF NOT EXISTS idx_txcat_store_type ON transaction_categories (store_id, type)`,
	`CREATE INDEX IF NOT EXISTS idx_ingredients_store_category ON ingredients (store_id, category)`,
	`CREATE INDEX IF NOT EXISTS idx_audit_logs_store_created ON audit_logs (store_id, created_at DESC)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_stores_code ON stores (lower(code))`,
	`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_stores_one_default ON user_stores (user_id) WHERE is_default`,
}

// ensureStoreIndexes creates the composite tenant indexes if they are missing.
func ensureStoreIndexes(db *gorm.DB) {
	for _, stmt := range storeIndexStatements {
		if err := db.Exec(stmt).Error; err != nil {
			log.Printf("[DB] WARNING: failed to ensure store index: %v", err)
		}
	}
}

// ensureStoreForeignKeys adds fk_<table>_store where missing. On legacy databases migration 000020
// already created them; on fresh databases AutoMigrate does not (there is no relation field).
func ensureStoreForeignKeys(db *gorm.DB) {
	for _, table := range storeRootTables {
		name := "fk_" + table + "_store"
		var exists bool
		if err := db.Raw(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ?)`, name).Scan(&exists).Error; err != nil {
			log.Printf("[DB] WARNING: failed to check %s: %v", name, err)
			continue
		}
		if exists {
			continue
		}
		stmt := fmt.Sprintf(`ALTER TABLE %s ADD CONSTRAINT %s FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT`, table, name)
		if err := db.Exec(stmt).Error; err != nil {
			log.Printf("[DB] WARNING: failed to add %s: %v", name, err)
		}
	}
}

// EnsureDefaultStore guarantees at least one store exists and returns the default (lowest id) store id.
// Legacy databases already got Store #1 from migration 000020; fresh databases get it here, named from
// INITIAL_STORE_NAME / INITIAL_STORE_CODE (no brand is hardcoded).
func EnsureDefaultStore(db *gorm.DB, cfg *config.Config) (uint, error) {
	var existing models.Store
	err := db.Order("id ASC").First(&existing).Error
	if err == nil {
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	code := cfg.InitialStoreCode
	if !models.StoreCodePattern.MatchString(code) {
		code = "main"
	}
	name := cfg.InitialStoreName
	if name == "" {
		name = "My Store"
	}

	store := models.Store{
		ID:               1,
		Code:             code,
		Name:             name,
		BusinessType:     "fnb",
		CurrencyCode:     "VND",
		CurrencySymbol:   "đ",
		CurrencyPosition: "suffix",
		Timezone:         "Asia/Ho_Chi_Minh",
		IsActive:         true,
	}
	if err := db.Create(&store).Error; err != nil {
		return 0, fmt.Errorf("create default store: %w", err)
	}
	if err := db.Exec(`SELECT setval(pg_get_serial_sequence('stores', 'id'), GREATEST(1, (SELECT MAX(id) FROM stores)))`).Error; err != nil {
		return 0, fmt.Errorf("reset stores sequence: %w", err)
	}
	log.Printf("[SEED] Default store #%d '%s' (%s) created.", store.ID, store.Name, store.Code)
	return store.ID, nil
}

// DefaultTransactionCategories returns the system template copied into every new store.
func DefaultTransactionCategories(storeID uint) []models.TransactionCategoryItem {
	return []models.TransactionCategoryItem{
		{StoreID: storeID, Name: "Mua nguyên liệu", Type: "outflow", Code: "ingredient_purchase", IsDefault: true},
		{StoreID: storeID, Name: "Chi phí vận hành", Type: "outflow", Code: "utility_bill"},
		{StoreID: storeID, Name: "Chi phí khác", Type: "outflow", Code: "other"},
		{StoreID: storeID, Name: "Doanh thu bán hàng POS", Type: "inflow", Code: "sale", IsDefault: true},
		{StoreID: storeID, Name: "Thu nhập khác", Type: "inflow", Code: "other"},
		{StoreID: storeID, Name: "Chênh lệch đối soát", Type: "both", Code: "reconciliation_variance"},
	}
}

// defaultStoreSettings are the per-store keys initialized for every new store.
func defaultStoreSettings() map[string]string {
	return map[string]string{
		"enable_daily_email_report":          "false",
		"daily_report_time":                  "22:30",
		"report_recipient_emails":            "",
		"google_sheets_sync_enabled":         "false",
		"google_sheets_spreadsheet_id":       "",
		"google_sheets_service_account_json": "",
		"google_sheets_auto_realtime_sync":   "true",
		"google_sheets_last_synced_at":       "",
		"google_sheets_last_sync_status":     "idle",
		"google_sheets_last_sync_error":      "",
	}
}

// SeedStoreDefaults provisions the essentials of one store: payment funds, transaction categories
// and per-store settings. It is idempotent per component and must run inside the caller's transaction.
// Fund names are Vietnamese to stay consistent with Store #1 (decision Q2).
func SeedStoreDefaults(tx *gorm.DB, storeID uint) error {
	var fundCount int64
	if err := tx.Model(&models.Fund{}).Scopes(ScopeByStore(storeID)).Count(&fundCount).Error; err != nil {
		return err
	}
	if fundCount == 0 {
		funds := []models.Fund{
			{StoreID: storeID, Name: "Tiền mặt", FundType: models.FundTypeCash, IsActive: true},
			{StoreID: storeID, Name: "Chuyển khoản", FundType: models.FundTypeBank, IsActive: true},
		}
		if err := tx.Create(&funds).Error; err != nil {
			return fmt.Errorf("seed funds: %w", err)
		}
	}

	var catCount int64
	if err := tx.Model(&models.TransactionCategoryItem{}).Scopes(ScopeByStore(storeID)).Count(&catCount).Error; err != nil {
		return err
	}
	if catCount == 0 {
		cats := DefaultTransactionCategories(storeID)
		for i := range cats {
			cats[i].DisplayOrder = i + 1
		}
		if err := tx.Create(&cats).Error; err != nil {
			return fmt.Errorf("seed transaction categories: %w", err)
		}
	}

	now := time.Now()
	for key, value := range defaultStoreSettings() {
		row := models.StoreSetting{StoreID: storeID, Key: key, Value: value, UpdatedAt: now}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return fmt.Errorf("seed store setting %s: %w", key, err)
		}
	}
	return nil
}

// mirrorStoreToLegacySettings keeps the global settings table populated for the legacy (not yet
// store-aware) handlers on a FRESH database. It only inserts missing keys and never overwrites.
// Removed together with the legacy settings reads in Phase 2.
func mirrorStoreToLegacySettings(db *gorm.DB, store models.Store) {
	now := time.Now()
	rows := []models.Setting{
		{Key: "store_name", Value: store.Name, UpdatedAt: now},
		{Key: "store_address", Value: store.Address, UpdatedAt: now},
		{Key: "store_phone", Value: store.Phone, UpdatedAt: now},
		{Key: "store_logo_url", Value: store.LogoURL, UpdatedAt: now},
		{Key: "currency_code", Value: store.CurrencyCode, UpdatedAt: now},
		{Key: "currency_symbol", Value: store.CurrencySymbol, UpdatedAt: now},
		{Key: "currency_position", Value: store.CurrencyPosition, UpdatedAt: now},
		{Key: "vietqr_bank_id", Value: store.VietQRBankID, UpdatedAt: now},
		{Key: "vietqr_account_no", Value: store.VietQRAccountNo, UpdatedAt: now},
		{Key: "vietqr_account_name", Value: store.VietQRAccountName, UpdatedAt: now},
	}
	for _, row := range rows {
		if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			log.Printf("[SEED] ERROR: failed to mirror setting '%s': %v", row.Key, err)
		}
	}
}

// assignSeedMembership gives a freshly seeded user a default membership in the default store.
func assignSeedMembership(db *gorm.DB, user models.User, storeID uint) {
	role := models.StoreRoleStaff
	if user.Role.IsSuperAdmin() {
		role = models.StoreRoleStoreAdmin
	}
	row := models.UserStore{UserID: user.ID, StoreID: storeID, Role: role, IsDefault: true}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
		log.Printf("[SEED] ERROR: failed to assign '%s' to store %d: %v", user.Username, storeID, err)
	}
}
