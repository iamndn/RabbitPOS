package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type BackupHandler struct {
	db *gorm.DB
}

func NewBackupHandler(db *gorm.DB) *BackupHandler {
	return &BackupHandler{db: db}
}

// ExportBackup generates a complete JSON snapshot of all database entities (Admin only)
// GET /api/v1/backup/export
func (h *BackupHandler) ExportBackup(c *gin.Context) {
	var payload models.BackupPayload
	payload.App = "RabbitPOS"
	payload.Version = "1.0"
	payload.ExportedAt = time.Now()

	// Fetch all tables
	if err := h.db.Find(&payload.Data.Settings).Error; err != nil {
		models.SendInternalError(c, "Failed to export settings: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Categories).Error; err != nil {
		models.SendInternalError(c, "Failed to export categories: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Products).Error; err != nil {
		models.SendInternalError(c, "Failed to export products: "+err.Error())
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
	if err := h.db.Find(&payload.Data.Toppings).Error; err != nil {
		models.SendInternalError(c, "Failed to export toppings: "+err.Error())
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
	if err := h.db.Find(&payload.Data.Transactions).Error; err != nil {
		models.SendInternalError(c, "Failed to export transactions: "+err.Error())
		return
	}
	if err := h.db.Find(&payload.Data.Promotions).Error; err != nil {
		models.SendInternalError(c, "Failed to export promotions: "+err.Error())
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
	if err := h.db.Find(&payload.Data.Users).Error; err != nil {
		models.SendInternalError(c, "Failed to export users: "+err.Error())
		return
	}

	// Calculate statistics
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
	}

	// Provide download attachment filename header
	filename := fmt.Sprintf("rabbitpos_backup_%s.json", time.Now().Format("20060102_150405"))
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Header("Content-Type", "application/json")

	models.SendSuccess(c, http.StatusOK, payload, "Database backup exported successfully")
}

// RestoreBackup restores database tables from an uploaded JSON backup file (Admin only)
// POST /api/v1/backup/restore
func (h *BackupHandler) RestoreBackup(c *gin.Context) {
	var payload models.BackupPayload

	// Check if uploaded as multipart file or raw JSON body
	file, fileErr := c.FormFile("backup_file")
	if fileErr == nil && file != nil {
		src, err := file.Open()
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Failed to open uploaded backup file: "+err.Error())
			return
		}
		defer src.Close()

		bytes, err := io.ReadAll(src)
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Failed to read backup file contents: "+err.Error())
			return
		}
		if err := json.Unmarshal(bytes, &payload); err != nil {
			models.SendError(c, http.StatusBadRequest, "Invalid JSON format in backup file: "+err.Error())
			return
		}
	} else {
		// Try parsing from request body
		if err := c.ShouldBindJSON(&payload); err != nil {
			models.SendError(c, http.StatusBadRequest, "Invalid backup JSON payload: "+err.Error())
			return
		}
	}

	// Validation
	if payload.App != "RabbitPOS" && payload.App != "" {
		models.SendError(c, http.StatusBadRequest, "Incompatible backup format: expected RabbitPOS backup")
		return
	}

	// Transactional restoration
	var restoredStats models.BackupStats
	err := h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Clear existing records in reverse dependency order
		tablesToClear := []string{
			"order_items",
			"orders",
			"transactions",
			"funds",
			"transaction_categories",
			"toppings",
			"variant_groups",
			"product_variants",
			"products",
			"categories",
			"promotions",
			"settings",
		}
		for _, tbl := range tablesToClear {
			if err := tx.Exec("DELETE FROM " + tbl).Error; err != nil {
				return fmt.Errorf("failed to clear table %s: %w", tbl, err)
			}
		}

		if len(payload.Data.Users) > 0 {
			if err := tx.Exec("DELETE FROM users").Error; err != nil {
				return fmt.Errorf("failed to clear users: %w", err)
			}
		}

		// 2. Insert records in strict foreign-key dependency order
		if len(payload.Data.Settings) > 0 {
			if err := tx.Create(&payload.Data.Settings).Error; err != nil {
				return fmt.Errorf("failed to restore settings: %w", err)
			}
			restoredStats.Settings = len(payload.Data.Settings)
		}

		if len(payload.Data.Categories) > 0 {
			if err := tx.Create(&payload.Data.Categories).Error; err != nil {
				return fmt.Errorf("failed to restore categories: %w", err)
			}
			restoredStats.Categories = len(payload.Data.Categories)
		}

		if len(payload.Data.Products) > 0 {
			// Strip nested slice references to avoid duplicate insert attempts by GORM
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

		if len(payload.Data.ProductVariants) > 0 {
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

		if len(payload.Data.Toppings) > 0 {
			if err := tx.Create(&payload.Data.Toppings).Error; err != nil {
				return fmt.Errorf("failed to restore toppings: %w", err)
			}
			restoredStats.Toppings = len(payload.Data.Toppings)
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

		if len(payload.Data.Transactions) > 0 {
			for i := range payload.Data.Transactions {
				payload.Data.Transactions[i].Fund = nil
			}
			if err := tx.Create(&payload.Data.Transactions).Error; err != nil {
				return fmt.Errorf("failed to restore transactions: %w", err)
			}
			restoredStats.Transactions = len(payload.Data.Transactions)
		}

		if len(payload.Data.Promotions) > 0 {
			if err := tx.Create(&payload.Data.Promotions).Error; err != nil {
				return fmt.Errorf("failed to restore promotions: %w", err)
			}
			restoredStats.Promotions = len(payload.Data.Promotions)
		}

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

		if len(payload.Data.OrderItems) > 0 {
			for i := range payload.Data.OrderItems {
				payload.Data.OrderItems[i].Variant = nil
			}
			if err := tx.Create(&payload.Data.OrderItems).Error; err != nil {
				return fmt.Errorf("failed to restore order items: %w", err)
			}
			restoredStats.OrderItems = len(payload.Data.OrderItems)
		}

		if len(payload.Data.Users) > 0 {
			if err := tx.Create(&payload.Data.Users).Error; err != nil {
				return fmt.Errorf("failed to restore users: %w", err)
			}
			restoredStats.Users = len(payload.Data.Users)
		}

		// 3. Reset PostgreSQL sequence auto-increments
		serialTables := []string{
			"categories", "products", "product_variants", "variant_groups",
			"toppings", "funds", "transaction_categories", "transactions",
			"promotions", "orders", "order_items", "users",
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
		models.SendInternalError(c, "Database restore failed: "+err.Error())
		return
	}

	res := models.RestoreResponse{
		RestoredAt:    time.Now(),
		RestoredStats: restoredStats,
		Message:       "Database restored successfully",
	}

	models.SendSuccess(c, http.StatusOK, res, "Database restored successfully")
}
