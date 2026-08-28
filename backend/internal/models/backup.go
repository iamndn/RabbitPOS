package models

import "time"

// BackupStats summarizes record counts in a backup snapshot for all 16 database tables
type BackupStats struct {
	Settings              int `json:"settings"`
	Categories            int `json:"categories"`
	Products              int `json:"products"`
	ProductVariants       int `json:"product_variants"`
	VariantGroups         int `json:"variant_groups"`
	Toppings              int `json:"toppings"`
	Funds                 int `json:"funds"`
	TransactionCategories int `json:"transaction_categories"`
	Transactions          int `json:"transactions"`
	Promotions            int `json:"promotions"`
	Orders                int `json:"orders"`
	OrderItems            int `json:"order_items"`
	Users                 int `json:"users"`
	Ingredients           int `json:"ingredients"`
	PurchaseItems         int `json:"purchase_items"`
	RecipeItems           int `json:"recipe_items"`
}

// BackupData contains all raw relational tables exported from PostgreSQL (16 tables)
type BackupData struct {
	Settings              []Setting                 `json:"settings"`
	Categories            []Category                `json:"categories"`
	Products              []Product                 `json:"products"`
	ProductVariants       []ProductVariant          `json:"product_variants"`
	VariantGroups         []VariantGroup            `json:"variant_groups"`
	Toppings              []Topping                 `json:"toppings"`
	Funds                 []Fund                    `json:"funds"`
	TransactionCategories []TransactionCategoryItem `json:"transaction_categories"`
	Transactions          []Transaction             `json:"transactions"`
	Promotions            []Promotion               `json:"promotions"`
	Orders                []Order                   `json:"orders"`
	OrderItems            []OrderItem               `json:"order_items"`
	Users                 []User                    `json:"users"`
	Ingredients           []Ingredient              `json:"ingredients"`
	PurchaseItems         []PurchaseItem            `json:"purchase_items"`
	RecipeItems           []RecipeItem              `json:"recipe_items"`
}

// EncryptionMeta details cryptographic metadata if backup payload is encrypted
type EncryptionMeta struct {
	Algorithm string `json:"algorithm"` // e.g. "AES-256-GCM"
	Nonce     string `json:"nonce"`     // Base64-encoded initialization nonce
}

// BackupPayload is the root JSON structure for exported database backups (V2.0 & V1.0 compatible)
type BackupPayload struct {
	App               string          `json:"app"`
	FormatVersion     string          `json:"format_version"` // "2.0" (or legacy "1.0")
	SchemaVersion     string          `json:"schema_version"` // "1.19"
	ExportedAt        time.Time       `json:"exported_at"`
	ChecksumAlgorithm string          `json:"checksum_algorithm"` // "sha256"
	Checksum          string          `json:"checksum"`
	IsEncrypted       bool            `json:"is_encrypted"`
	EncryptionMeta    *EncryptionMeta `json:"encryption_meta,omitempty"`
	Stats             BackupStats     `json:"stats"`
	Data              BackupData      `json:"data"`
	EncryptedData     string          `json:"encrypted_data,omitempty"` // Base64 ciphertext when is_encrypted is true
	Version           string          `json:"version,omitempty"`        // Kept for backward compatibility with V1.0 backups
}

// BackupPreviewResponse returns dry-run inspection results and a short-lived single-use restore token
type BackupPreviewResponse struct {
	FormatVersion     string      `json:"format_version"`
	SchemaVersion     string      `json:"schema_version"`
	ExportedAt        time.Time   `json:"exported_at"`
	ChecksumAlgorithm string      `json:"checksum_algorithm"`
	Checksum          string      `json:"checksum"`
	ChecksumValid     bool        `json:"checksum_valid"`
	IsEncrypted       bool        `json:"is_encrypted"`
	Stats             BackupStats `json:"stats"`
	Warnings          []string    `json:"warnings"`
	TableCount        int         `json:"table_count"`
	RestoreToken      string      `json:"restore_token"`
	ExpiresAt         time.Time   `json:"expires_at"`
	Message           string      `json:"message"`
}

// RestoreRequest payload when confirming execution of backup restore
type RestoreRequest struct {
	RestoreToken  string         `json:"restore_token"`
	BackupPayload *BackupPayload `json:"backup_payload,omitempty"`
	EncryptionKey string         `json:"encryption_key,omitempty"`
}

// RestoreResponse details the outcome of a manual backup restoration
type RestoreResponse struct {
	RestoredAt    time.Time   `json:"restored_at"`
	RestoredStats BackupStats `json:"restored_stats"`
	Message       string      `json:"message"`
}
