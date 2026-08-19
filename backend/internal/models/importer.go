package models

import "time"

// ImportOptions defines configurable parameters for data ingestion
type ImportOptions struct {
	Target         string `json:"target" form:"target"`                   // "all", "categories", "toppings", "products", "transactions", "orders"
	UpsertProducts bool   `json:"upsert_products" form:"upsert_products"` // Upsert product & variant if already exists
	UpdateFunds    bool   `json:"update_funds" form:"update_funds"`       // Adjust fund balance on transaction import
}

// ImportRowError details an issue encountered in a specific sheet row
type ImportRowError struct {
	Sheet   string `json:"sheet"`
	Row     int    `json:"row"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
	RawData string `json:"raw_data,omitempty"`
}

// ImportStats summarizes record counts successfully ingested
type ImportStats struct {
	CategoriesCount   int `json:"categories_count"`
	ToppingsCount     int `json:"toppings_count"`
	ProductsCount     int `json:"products_count"`
	VariantsCount     int `json:"variants_count"`
	TransactionsCount int `json:"transactions_count"`
	OrdersCount       int `json:"orders_count"`
	OrderItemsCount   int `json:"order_items_count"`
	TotalErrors       int `json:"total_errors"`
}

// ImportResponse is the API response payload returned to the client
type ImportResponse struct {
	Success   bool             `json:"success"`
	Message   string           `json:"message"`
	Stats     ImportStats      `json:"stats"`
	Errors    []ImportRowError `json:"errors,omitempty"`
	Timestamp time.Time        `json:"timestamp"`
}
