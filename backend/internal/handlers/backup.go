package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// previewSession stores metadata of a dry-run preview for single-use restore token verification
type previewSession struct {
	Token     string
	DataHash  string
	Payload   models.BackupPayload
	ExpiresAt time.Time
	IsV1      bool
	Warnings  []string
}

type BackupHandler struct {
	db       *gorm.DB
	caches   []*cache.TTLCache
	mu       sync.RWMutex
	sessions map[string]previewSession
}

func NewBackupHandler(db *gorm.DB, caches ...*cache.TTLCache) *BackupHandler {
	h := &BackupHandler{
		db:       db,
		caches:   caches,
		sessions: make(map[string]previewSession),
	}
	// Start background cleanup of expired sessions
	go h.cleanupExpiredSessions()
	return h
}

func (h *BackupHandler) cleanupExpiredSessions() {
	ticker := time.NewTicker(2 * time.Minute)
	for range ticker.C {
		h.mu.Lock()
		now := time.Now()
		for token, sess := range h.sessions {
			if now.After(sess.ExpiresAt) {
				delete(h.sessions, token)
			}
		}
		h.mu.Unlock()
	}
}

// ExportBackup generates a complete JSON snapshot of all 16 database entities (Admin only)
// GET /api/v1/backup/export
func (h *BackupHandler) ExportBackup(c *gin.Context) {
	var payload models.BackupPayload
	payload.App = "RabbitPOS"
	payload.FormatVersion = "2.0"
	payload.SchemaVersion = "1.19"
	payload.ExportedAt = time.Now().UTC()
	payload.ChecksumAlgorithm = "sha256"

	// Fetch all 16 tables in topological order
	if err := h.db.Find(&payload.Data.Settings).Error; err != nil {
		models.SendInternalError(c, "Failed to export settings: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Users).Error; err != nil {
		models.SendInternalError(c, "Failed to export users: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Funds).Error; err != nil {
		models.SendInternalError(c, "Failed to export funds: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.TransactionCategories).Error; err != nil {
		models.SendInternalError(c, "Failed to export transaction categories: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Categories).Error; err != nil {
		models.SendInternalError(c, "Failed to export categories: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Ingredients).Error; err != nil {
		models.SendInternalError(c, "Failed to export ingredients: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Products).Error; err != nil {
		models.SendInternalError(c, "Failed to export products: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Toppings).Error; err != nil {
		models.SendInternalError(c, "Failed to export toppings: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.ProductVariants).Error; err != nil {
		models.SendInternalError(c, "Failed to export product variants: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.VariantGroups).Error; err != nil {
		models.SendInternalError(c, "Failed to export variant groups: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Promotions).Error; err != nil {
		models.SendInternalError(c, "Failed to export promotions: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.RecipeItems).Error; err != nil {
		models.SendInternalError(c, "Failed to export recipe items: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Orders).Error; err != nil {
		models.SendInternalError(c, "Failed to export orders: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.OrderItems).Error; err != nil {
		models.SendInternalError(c, "Failed to export order items: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Transactions).Error; err != nil {
		models.SendInternalError(c, "Failed to export transactions: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.PurchaseItems).Error; err != nil {
		models.SendInternalError(c, "Failed to export purchase items: "+err.Error())
		return
	}

	// Calculate statistics across all 16 tables
	payload.Stats = models.BackupStats{
		Settings:              len(payload.Data.Settings),
		Categories:            len(payload.Data.Categories),
		Products:              len(payload.Data.Products),
		ProductVariants:       len(payload.Data.ProductVariants),
		VariantGroups:         len(payload.Data.VariantGroups),
		Toppings:              len(payload.Data.Toppings),
		Funds:                 len(payload.Data.Funds),
		TransactionCategories: len(payload.Data.TransactionCategories),
		Transactions:          len(payload.Data.Transactions),
		Promotions:            len(payload.Data.Promotions),
		Orders:                len(payload.Data.Orders),
		OrderItems:            len(payload.Data.OrderItems),
		Users:                 len(payload.Data.Users),
		Ingredients:           len(payload.Data.Ingredients),
		PurchaseItems:         len(payload.Data.PurchaseItems),
		RecipeItems:           len(payload.Data.RecipeItems),
	}

	// Compute stable SHA-256 checksum on data payload BEFORE encryption
	checksum, err := utils.ComputeSHA256Checksum(payload.Data)
	if err != nil {
		models.SendInternalError(c, "Failed to compute checksum: "+err.Error())
		return
	}
	payload.Checksum = checksum

	// Check if encryption is requested (via query param `encrypt=true` or header `X-Encrypt-Backup: true`)
	encryptRequested := c.Query("encrypt") == "true" || c.GetHeader("X-Encrypt-Backup") == "true"
	encKeySecret := os.Getenv("BACKUP_ENCRYPTION_KEY")
	if encKeySecret == "" {
		encKeySecret = os.Getenv("APP_ENCRYPTION_KEY")
	}

	if encryptRequested {
		if encKeySecret == "" {
			models.SendError(c, http.StatusBadRequest, "Encryption requested but BACKUP_ENCRYPTION_KEY / APP_ENCRYPTION_KEY is not configured on server")
			return
		}

		key := utils.DeriveKeyFromSecret(encKeySecret)
		dataBytes, err := json.Marshal(payload.Data)
		if err != nil {
			models.SendInternalError(c, "Failed to serialize data for encryption: "+err.Error())
			return
		}

		cipherB64, nonceB64, err := utils.EncryptAESGCM(dataBytes, key)
		if err != nil {
			models.SendInternalError(c, "Failed to encrypt backup data: "+err.Error())
			return
		}

		payload.IsEncrypted = true
		payload.EncryptionMeta = &models.EncryptionMeta{
			Algorithm: "AES-256-GCM",
			Nonce:     nonceB64,
		}
		payload.EncryptedData = cipherB64
		// Clear raw data from response to ensure zero plaintext leakage
		payload.Data = models.BackupData{}
	}

	// Provide download attachment filename header
	ext := "json"
	if payload.IsEncrypted {
		ext = "enc"
	}
	filename := fmt.Sprintf("rabbitpos_backup_v2_%s.%s", time.Now().Format("20060102_150405"), ext)
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "application/json")

	models.SendSuccess(c, http.StatusOK, payload, "Database backup V2 exported successfully")
}

// PreviewBackup parses, validates, and dry-runs a backup file without modifying the database (Admin only)
// POST /api/v1/backup/preview
func (h *BackupHandler) PreviewBackup(c *gin.Context) {
	payload, err := h.parseBackupPayload(c)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, err.Error())
		return
	}

	// 1. Check Format Version (V2.0 vs Legacy V1.0)
	var warnings []string
	isV1 := false

	if payload.FormatVersion == "" || payload.FormatVersion == "1.0" || payload.Version == "1.0" {
		isV1 = true
		payload.FormatVersion = "1.0"
		warnings = append(warnings, "CẢNH BÁO: Đây là bản sao lưu phiên bản cũ (V1.0). File này KHÔNG chứa dữ liệu Nguyên Vật Liệu (Ingredients), Chi Tiết Nhập Hàng (Purchase Items) và Công Thức Định Lượng (Recipe Items/BOM). Hãy cân nhắc kỹ trước khi khôi phục.")
	}

	// 2. Checksum verification
	checksumValid := false
	if payload.Checksum != "" {
		calculatedChecksum, err := utils.ComputeSHA256Checksum(payload.Data)
		if err == nil {
			if calculatedChecksum == payload.Checksum {
				checksumValid = true
			} else {
				models.SendError(c, http.StatusBadRequest, "Bản sao lưu bị lỗi hoặc đã bị can thiệp (Mã Checksum SHA-256 không khớp với dữ liệu)")
				return
			}
		}
	} else if isV1 {
		warnings = append(warnings, "Bản sao lưu V1 không có chữ ký toàn vẹn Checksum SHA-256.")
	}

	// Recalculate stats accurately from parsed data
	stats := models.BackupStats{
		Settings:              len(payload.Data.Settings),
		Categories:            len(payload.Data.Categories),
		Products:              len(payload.Data.Products),
		ProductVariants:       len(payload.Data.ProductVariants),
		VariantGroups:         len(payload.Data.VariantGroups),
		Toppings:              len(payload.Data.Toppings),
		Funds:                 len(payload.Data.Funds),
		TransactionCategories: len(payload.Data.TransactionCategories),
		Transactions:          len(payload.Data.Transactions),
		Promotions:            len(payload.Data.Promotions),
		Orders:                len(payload.Data.Orders),
		OrderItems:            len(payload.Data.OrderItems),
		Users:                 len(payload.Data.Users),
		Ingredients:           len(payload.Data.Ingredients),
		PurchaseItems:         len(payload.Data.PurchaseItems),
		RecipeItems:           len(payload.Data.RecipeItems),
	}
	payload.Stats = stats

	// 3. Dry-run Foreign Key Reference Integrity Check (in memory)
	refWarnings := h.validateReferentialIntegrity(&payload.Data)
	warnings = append(warnings, refWarnings...)

	// Count non-empty tables
	tableCount := 0
	if stats.Settings > 0 {
		tableCount++
	}
	if stats.Categories > 0 {
		tableCount++
	}
	if stats.Products > 0 {
		tableCount++
	}
	if stats.ProductVariants > 0 {
		tableCount++
	}
	if stats.VariantGroups > 0 {
		tableCount++
	}
	if stats.Toppings > 0 {
		tableCount++
	}
	if stats.Funds > 0 {
		tableCount++
	}
	if stats.TransactionCategories > 0 {
		tableCount++
	}
	if stats.Transactions > 0 {
		tableCount++
	}
	if stats.Promotions > 0 {
		tableCount++
	}
	if stats.Orders > 0 {
		tableCount++
	}
	if stats.OrderItems > 0 {
		tableCount++
	}
	if stats.Users > 0 {
		tableCount++
	}
	if stats.Ingredients > 0 {
		tableCount++
	}
	if stats.PurchaseItems > 0 {
		tableCount++
	}
	if stats.RecipeItems > 0 {
		tableCount++
	}

	// 4. Generate Single-Use Secure Restore Token (valid for 10 minutes)
	restoreToken, err := utils.GenerateSecureToken(32)
	if err != nil {
		models.SendInternalError(c, "Failed to generate restore token: "+err.Error())
		return
	}

	dataBytes, _ := json.Marshal(payload.Data)
	dataHash := utils.ComputeBytesSHA256(dataBytes)

	expiresAt := time.Now().Add(10 * time.Minute)

	h.mu.Lock()
	h.sessions[restoreToken] = previewSession{
		Token:     restoreToken,
		DataHash:  dataHash,
		Payload:   *payload,
		ExpiresAt: expiresAt,
		IsV1:      isV1,
		Warnings:  warnings,
	}
	h.mu.Unlock()

	resp := models.BackupPreviewResponse{
		FormatVersion:     payload.FormatVersion,
		SchemaVersion:     payload.SchemaVersion,
		ExportedAt:        payload.ExportedAt,
		ChecksumAlgorithm: payload.ChecksumAlgorithm,
		Checksum:          payload.Checksum,
		ChecksumValid:     checksumValid,
		IsEncrypted:       payload.IsEncrypted,
		Stats:             stats,
		Warnings:          warnings,
		TableCount:        tableCount,
		RestoreToken:      restoreToken,
		ExpiresAt:         expiresAt,
		Message:           "Backup file validated successfully. Token generated for confirmation.",
	}

	models.SendSuccess(c, http.StatusOK, resp, "Backup preview generated successfully")
}

// RestoreBackup restores database tables from an uploaded JSON backup file using a valid restore token (Admin only)
// POST /api/v1/backup/restore
func (h *BackupHandler) RestoreBackup(c *gin.Context) {
	// Extract Restore Token
	token := c.GetHeader("X-Restore-Token")
	if token == "" {
		token = c.Query("restore_token")
	}

	var reqBody models.RestoreRequest
	var payload *models.BackupPayload

	// Try reading token and payload from JSON body if present
	if err := c.ShouldBindJSON(&reqBody); err == nil {
		if reqBody.RestoreToken != "" {
			token = reqBody.RestoreToken
		}
		if reqBody.BackupPayload != nil {
			payload = reqBody.BackupPayload
		}
	}

	if token == "" {
		models.SendError(c, http.StatusBadRequest, "Restore token is required. Please preview the backup file first.")
		return
	}

	// Verify and Consume Token atomically (Single-Use Token Enforcement)
	h.mu.Lock()
	sess, exists := h.sessions[token]
	if !exists {
		h.mu.Unlock()
		models.SendError(c, http.StatusBadRequest, "Invalid or expired restore token. Please preview the backup file again.")
		return
	}
	if time.Now().After(sess.ExpiresAt) {
		delete(h.sessions, token)
		h.mu.Unlock()
		models.SendError(c, http.StatusBadRequest, "Restore token has expired. Please preview the backup file again.")
		return
	}

	// Immediately delete token to enforce single-use
	delete(h.sessions, token)
	h.mu.Unlock()

	// Use validated payload from session if not supplied in body
	if payload == nil || len(payload.Data.Categories) == 0 && len(payload.Data.Products) == 0 && len(payload.Data.Settings) == 0 {
		payload = &sess.Payload
	}

	// If payload in body was passed, verify data hash against session data hash to prevent tampering
	if payload != nil {
		bodyDataBytes, _ := json.Marshal(payload.Data)
		bodyHash := utils.ComputeBytesSHA256(bodyDataBytes)
		if bodyHash != sess.DataHash && sess.DataHash != "" {
			// Fall back to session's validated payload for security
			payload = &sess.Payload
		}
	}

	// Execute Transactional Restoration in Strict Topological Foreign-Key Dependency Order
	var restoredStats models.BackupStats

	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Clear existing records in REVERSE dependency order
		tablesToClear := []string{
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
		for _, tbl := range tablesToClear {
			if err := tx.Exec("DELETE FROM " + tbl).Error; err != nil {
				return fmt.Errorf("failed to clear table %s: %w", tbl, err)
			}
		}

		// 2. Insert records in strict TOPOLOGICAL dependency order
		// Level 0: Independent tables
		if len(payload.Data.Settings) > 0 {
			if err := tx.Create(&payload.Data.Settings).Error; err != nil {
				return fmt.Errorf("failed to restore settings: %w", err)
			}
			restoredStats.Settings = len(payload.Data.Settings)
		}

		if len(payload.Data.Users) > 0 {
			if err := tx.Create(&payload.Data.Users).Error; err != nil {
				return fmt.Errorf("failed to restore users: %w", err)
			}
			restoredStats.Users = len(payload.Data.Users)
		}

		if len(payload.Data.Funds) > 0 {
			if err := tx.Create(&payload.Data.Funds).Error; err != nil {
				return fmt.Errorf("failed to restore funds: %w", err)
			}
			restoredStats.Funds = len(payload.Data.Funds)
		}

		if len(payload.Data.TransactionCategories) > 0 {
			if err := tx.Create(&payload.Data.TransactionCategories).Error; err != nil {
				return fmt.Errorf("failed to restore transaction categories: %w", err)
			}
			restoredStats.TransactionCategories = len(payload.Data.TransactionCategories)
		}

		if len(payload.Data.Categories) > 0 {
			if err := tx.Create(&payload.Data.Categories).Error; err != nil {
				return fmt.Errorf("failed to restore categories: %w", err)
			}
			restoredStats.Categories = len(payload.Data.Categories)
		}

		if len(payload.Data.Ingredients) > 0 {
			if err := tx.Create(&payload.Data.Ingredients).Error; err != nil {
				return fmt.Errorf("failed to restore ingredients: %w", err)
			}
			restoredStats.Ingredients = len(payload.Data.Ingredients)
		}

		// Level 1: Depends on Level 0
		if len(payload.Data.Products) > 0 {
			for i := range payload.Data.Products {
				payload.Data.Products[i].Variants = nil
				payload.Data.Products[i].VariantGroups = nil
				payload.Data.Products[i].Category = nil
			}
			if err := tx.Create(&payload.Data.Products).Error; err != nil {
				return fmt.Errorf("failed to restore products: %w", err)
			}
			restoredStats.Products = len(payload.Data.Products)
		}

		if len(payload.Data.Toppings) > 0 {
			for i := range payload.Data.Toppings {
				payload.Data.Toppings[i].Category = nil
			}
			if err := tx.Create(&payload.Data.Toppings).Error; err != nil {
				return fmt.Errorf("failed to restore toppings: %w", err)
			}
			restoredStats.Toppings = len(payload.Data.Toppings)
		}

		// Level 2: Depends on Level 1
		if len(payload.Data.ProductVariants) > 0 {
			for i := range payload.Data.ProductVariants {
				payload.Data.ProductVariants[i].Product = nil
			}
			if err := tx.Create(&payload.Data.ProductVariants).Error; err != nil {
				return fmt.Errorf("failed to restore product variants: %w", err)
			}
			restoredStats.ProductVariants = len(payload.Data.ProductVariants)
		}

		if len(payload.Data.VariantGroups) > 0 {
			if err := tx.Create(&payload.Data.VariantGroups).Error; err != nil {
				return fmt.Errorf("failed to restore variant groups: %w", err)
			}
			restoredStats.VariantGroups = len(payload.Data.VariantGroups)
		}

		// Level 3: Depends on Level 2
		if len(payload.Data.Promotions) > 0 {
			for i := range payload.Data.Promotions {
				payload.Data.Promotions[i].GiftVariant = nil
			}
			if err := tx.Create(&payload.Data.Promotions).Error; err != nil {
				return fmt.Errorf("failed to restore promotions: %w", err)
			}
			restoredStats.Promotions = len(payload.Data.Promotions)
		}

		if len(payload.Data.RecipeItems) > 0 {
			for i := range payload.Data.RecipeItems {
				payload.Data.RecipeItems[i].ProductVariant = nil
				payload.Data.RecipeItems[i].Topping = nil
				payload.Data.RecipeItems[i].Ingredient = nil
			}
			if err := tx.Create(&payload.Data.RecipeItems).Error; err != nil {
				return fmt.Errorf("failed to restore recipe items: %w", err)
			}
			restoredStats.RecipeItems = len(payload.Data.RecipeItems)
		}

		// Level 4: Orders & Ledger
		if len(payload.Data.Orders) > 0 {
			for i := range payload.Data.Orders {
				payload.Data.Orders[i].Items = nil
				payload.Data.Orders[i].Fund = nil
				payload.Data.Orders[i].Promotion = nil
			}
			if err := tx.Create(&payload.Data.Orders).Error; err != nil {
				return fmt.Errorf("failed to restore orders: %w", err)
			}
			restoredStats.Orders = len(payload.Data.Orders)
		}

		// Level 5: Order Items & Transactions
		if len(payload.Data.OrderItems) > 0 {
			for i := range payload.Data.OrderItems {
				payload.Data.OrderItems[i].Variant = nil
			}
			if err := tx.Create(&payload.Data.OrderItems).Error; err != nil {
				return fmt.Errorf("failed to restore order items: %w", err)
			}
			restoredStats.OrderItems = len(payload.Data.OrderItems)
		}

		if len(payload.Data.Transactions) > 0 {
			for i := range payload.Data.Transactions {
				payload.Data.Transactions[i].Fund = nil
				payload.Data.Transactions[i].ReferenceOrder = nil
				payload.Data.Transactions[i].PurchaseItems = nil
			}
			if err := tx.Create(&payload.Data.Transactions).Error; err != nil {
				return fmt.Errorf("failed to restore transactions: %w", err)
			}
			restoredStats.Transactions = len(payload.Data.Transactions)
		}

		// Level 6: Purchase Items (depends on Transactions and Ingredients)
		if len(payload.Data.PurchaseItems) > 0 {
			for i := range payload.Data.PurchaseItems {
				payload.Data.PurchaseItems[i].Ingredient = nil
			}
			if err := tx.Create(&payload.Data.PurchaseItems).Error; err != nil {
				return fmt.Errorf("failed to restore purchase items: %w", err)
			}
			restoredStats.PurchaseItems = len(payload.Data.PurchaseItems)
		}

		// 3. Reset PostgreSQL sequence auto-increments for all serial tables
		serialTables := []string{
			"categories", "products", "product_variants", "variant_groups",
			"toppings", "funds", "transaction_categories", "transactions",
			"promotions", "orders", "order_items", "users",
			"ingredients", "purchase_items", "recipe_items",
		}
		for _, tbl := range serialTables {
			query := fmt.Sprintf(
				"SELECT setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 1), (SELECT MAX(id) IS NOT NULL FROM %s))",
				tbl, tbl, tbl,
			)
			if err := tx.Exec(query).Error; err != nil {
				log.Printf("[RESTORE] Note: sequence reset for %s: %v", tbl, err)
			}
		}

		return nil
	})

	if err != nil {
		models.SendInternalError(c, "Database restore failed and was fully rolled back: "+err.Error())
		return
	}

	// Invalidate all In-Memory TTL caches across application
	for _, cch := range h.caches {
		if cch != nil {
			cch.Clear()
		}
	}

	res := models.RestoreResponse{
		RestoredAt:    time.Now(),
		RestoredStats: restoredStats,
		Message:       "Database restored successfully from backup V2",
	}

	models.SendSuccess(c, http.StatusOK, res, "Database restored successfully")
}

// parseBackupPayload extracts BackupPayload from either multipart file or raw JSON body, handling decryption if required
func (h *BackupHandler) parseBackupPayload(c *gin.Context) (*models.BackupPayload, error) {
	var payload models.BackupPayload

	file, fileErr := c.FormFile("backup_file")
	if fileErr == nil && file != nil {
		src, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open uploaded backup file: %w", err)
		}
		defer src.Close()

		rawBytes, err := io.ReadAll(src)
		if err != nil {
			return nil, fmt.Errorf("failed to read backup file: %w", err)
		}

		if err := json.Unmarshal(rawBytes, &payload); err != nil {
			return nil, fmt.Errorf("invalid JSON format in backup file: %w", err)
		}
	} else {
		// Read from raw JSON body
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read request body: %w", err)
		}
		if len(bodyBytes) == 0 {
			return nil, fmt.Errorf("empty backup payload or no backup file provided")
		}
		if err := json.Unmarshal(bodyBytes, &payload); err != nil {
			return nil, fmt.Errorf("invalid JSON payload: %w", err)
		}
	}

	// App check
	if payload.App != "RabbitPOS" && payload.App != "" {
		return nil, fmt.Errorf("incompatible backup format: expected RabbitPOS backup, got %q", payload.App)
	}

	// Handle Decryption if Encrypted
	if payload.IsEncrypted && payload.EncryptedData != "" {
		if payload.EncryptionMeta == nil || payload.EncryptionMeta.Nonce == "" {
			return nil, fmt.Errorf("missing encryption metadata (nonce) in encrypted backup")
		}

		keySecret := c.GetHeader("X-Backup-Key")
		if keySecret == "" {
			keySecret = c.Query("encryption_key")
		}
		if keySecret == "" {
			keySecret = os.Getenv("BACKUP_ENCRYPTION_KEY")
		}
		if keySecret == "" {
			keySecret = os.Getenv("APP_ENCRYPTION_KEY")
		}

		if keySecret == "" {
			return nil, fmt.Errorf("file sao lưu đã được mã hóa. Vui lòng cung cấp mật khẩu hoặc khóa mã hóa để giải mã")
		}

		key := utils.DeriveKeyFromSecret(keySecret)
		decryptedBytes, err := utils.DecryptAESGCM(payload.EncryptedData, payload.EncryptionMeta.Nonce, key)
		if err != nil {
			return nil, fmt.Errorf("giải mã thất bại: Khóa mã hóa không đúng hoặc file đã bị sửa đổi (%v)", err)
		}

		if err := json.Unmarshal(decryptedBytes, &payload.Data); err != nil {
			return nil, fmt.Errorf("failed to unmarshal decrypted backup data: %w", err)
		}
	}

	return &payload, nil
}

// validateReferentialIntegrity checks relational references in memory without touching the DB
func (h *BackupHandler) validateReferentialIntegrity(data *models.BackupData) []string {
	var warnings []string

	categoryIDs := make(map[uint]bool)
	for _, c := range data.Categories {
		categoryIDs[c.ID] = true
	}

	productIDs := make(map[uint]bool)
	for _, p := range data.Products {
		productIDs[p.ID] = true
		if p.CategoryID > 0 && !categoryIDs[p.CategoryID] {
			warnings = append(warnings, fmt.Sprintf("Sản phẩm ID %d (%s) tham chiếu đến Danh mục ID %d không tồn tại trong file", p.ID, p.Name, p.CategoryID))
		}
	}

	variantIDs := make(map[uint]bool)
	for _, v := range data.ProductVariants {
		variantIDs[v.ID] = true
		if v.ProductID > 0 && !productIDs[v.ProductID] {
			warnings = append(warnings, fmt.Sprintf("Biến thể ID %d (%s) tham chiếu đến Sản phẩm ID %d không tồn tại trong file", v.ID, v.VariantName, v.ProductID))
		}
	}

	ingredientIDs := make(map[uint]bool)
	for _, ing := range data.Ingredients {
		ingredientIDs[ing.ID] = true
	}

	for _, ri := range data.RecipeItems {
		if ri.IngredientID > 0 && !ingredientIDs[ri.IngredientID] {
			warnings = append(warnings, fmt.Sprintf("Công thức định lượng ID %d tham chiếu đến Nguyên vật liệu ID %d không tồn tại trong file", ri.ID, ri.IngredientID))
		}
	}

	return warnings
}
