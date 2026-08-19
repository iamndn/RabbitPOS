package models

import "time"

// BackupStats summarizes record counts in a backup snapshot
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
}

// BackupData contains all raw relational tables exported from PostgreSQL
type BackupData struct {
	Settings              []Setting             `json:"settings"`
	Categories            []Category            `json:"categories"`
	Products              []Product             `json:"products"`
	ProductVariants       []ProductVariant      `json:"product_variants"`
	VariantGroups         []VariantGroup        `json:"variant_groups"`
	Toppings              []Topping             `json:"toppings"`
	Funds                 []Fund                `json:"funds"`
	TransactionCategories []TransactionCategory `json:"transaction_categories"`
	Transactions          []Transaction         `json:"transactions"`
	Promotions            []Promotion           `json:"promotions"`
	Orders                []Order               `json:"orders"`
	OrderItems            []OrderItem           `json:"order_items"`
	Users                 []User                `json:"users"`
}

// BackupPayload is the root JSON structure for exported database backups
type BackupPayload struct {
	App        string      `json:"app"`
	Version    string      `json:"version"`
	ExportedAt time.Time   `json:"exported_at"`
	Stats      BackupStats `json:"stats"`
	Data       BackupData  `json:"data"`
}

// RestoreResponse details the outcome of a manual backup restoration
type RestoreResponse struct {
	RestoredAt    time.Time   `json:"restored_at"`
	RestoredStats BackupStats `json:"restored_stats"`
	Message       string      `json:"message"`
}
