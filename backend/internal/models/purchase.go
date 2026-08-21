package models

import "time"

// Ingredient represents a raw material, fresh produce (fruit), beverage supply, or packaging
type Ingredient struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	Name                 string    `gorm:"type:varchar(150);not null;uniqueIndex" json:"name"`
	Category             string    `gorm:"type:varchar(50);not null;default:'fruit'" json:"category"` // 'fruit', 'ingredient', 'packaging', 'other'
	Unit                 string    `gorm:"type:varchar(20);not null" json:"unit"`                     // 'kg', 'lít', 'lon', 'hộp', 'cái', 'túi'
	LatestPurchasePrice  float64   `gorm:"type:decimal(15,2);not null;default:0.00" json:"latest_purchase_price"`
	AveragePurchasePrice float64   `gorm:"type:decimal(15,2);not null;default:0.00" json:"average_purchase_price"`
	YieldRate            float64   `gorm:"type:decimal(5,4);not null;default:1.0000" json:"yield_rate"` // e.g. 0.45 for orange juice, 0.55 for carrot, 1.0 for milk/cups
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// PurchaseItem represents an itemized line item inside an outflow transaction (Expense)
type PurchaseItem struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	TransactionID uint        `gorm:"not null;index" json:"transaction_id"`
	IngredientID  uint        `gorm:"not null;index" json:"ingredient_id"`
	Ingredient    *Ingredient `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`
	Quantity      float64     `gorm:"type:decimal(10,3);not null" json:"quantity"`
	UnitPrice     float64     `gorm:"type:decimal(15,2);not null;default:0.00" json:"unit_price"`
	Subtotal      float64     `gorm:"type:decimal(15,2);not null;default:0.00" json:"subtotal"`
	CreatedAt     time.Time   `json:"created_at"`
}

// RecipeItem represents the quantity of an ingredient required to prepare a product variant or topping (BOM)
type RecipeItem struct {
	ID               uint            `gorm:"primaryKey" json:"id"`
	ProductVariantID *uint           `gorm:"index" json:"product_variant_id,omitempty"`
	ProductVariant   *ProductVariant `gorm:"foreignKey:ProductVariantID" json:"product_variant,omitempty"`
	ToppingID        *uint           `gorm:"index" json:"topping_id,omitempty"`
	Topping          *Topping        `gorm:"foreignKey:ToppingID" json:"topping,omitempty"`
	IngredientID     uint            `gorm:"not null;index" json:"ingredient_id"`
	Ingredient       *Ingredient     `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`
	UsageQuantity    float64         `gorm:"type:decimal(10,3);not null" json:"usage_quantity"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// DTOs for API requests and responses

// PurchaseItemInput is submitted when creating a transaction with itemized purchases
type PurchaseItemInput struct {
	IngredientName string  `json:"ingredient_name"`
	IngredientID   *uint   `json:"ingredient_id"`
	Category       string  `json:"category"`
	Quantity       float64 `json:"quantity" binding:"required,gt=0"`
	UnitPrice      float64 `json:"unit_price" binding:"required,gte=0"`
	Unit           string  `json:"unit"`
}

// CreateOrUpdateIngredientRequest is for managing the ingredient catalog
type CreateOrUpdateIngredientRequest struct {
	Name      string  `json:"name" binding:"required"`
	Category  string  `json:"category"`
	Unit      string  `json:"unit" binding:"required"`
	YieldRate float64 `json:"yield_rate"`
}

// RecipeItemInput represents a single ingredient specification in a recipe
type RecipeItemInput struct {
	IngredientID  uint    `json:"ingredient_id" binding:"required"`
	UsageQuantity float64 `json:"usage_quantity" binding:"required,gt=0"`
}

// SaveRecipeRequest saves all recipe ingredients for a variant or topping
type SaveRecipeRequest struct {
	Items []RecipeItemInput `json:"items" binding:"required"`
}

// CostComparisonItem represents a menu item variant or topping with theoretical vs actual COGS
type CostComparisonItem struct {
	TargetType           string             `json:"target_type"` // 'variant' | 'topping'
	TargetID             uint               `json:"target_id"`
	ProductID            *uint              `json:"product_id,omitempty"`
	ProductName          string             `json:"product_name"`
	VariantName          string             `json:"variant_name"`
	CategoryName         string             `json:"category_name"`
	ImageURL             string             `json:"image_url"`
	RetailPrice          float64            `json:"retail_price"`
	CurrentCOGS          float64            `json:"current_cogs"`
	EstimatedCOGS        float64            `json:"estimated_cogs"`     // Based on latest purchase price
	EstimatedCOGSAvg     float64            `json:"estimated_cogs_avg"` // Based on weighted average purchase price
	Difference           float64            `json:"difference"`         // EstimatedCOGS - CurrentCOGS
	MarginPercentage     float64            `json:"margin_percentage"`  // (RetailPrice - EstimatedCOGS) / RetailPrice * 100
	RecipeItemCount      int                `json:"recipe_item_count"`
	RecipeDetails        []RecipeDetailItem `json:"recipe_details,omitempty"`
}

// RecipeDetailItem provides breakdown per ingredient in the recipe
type RecipeDetailItem struct {
	IngredientID        uint    `json:"ingredient_id"`
	IngredientName      string  `json:"ingredient_name"`
	Category            string  `json:"category"`
	Unit                string  `json:"unit"`
	UsageQuantity       float64 `json:"usage_quantity"`
	YieldRate           float64 `json:"yield_rate"`
	LatestPurchasePrice float64 `json:"latest_purchase_price"`
	EffectiveUnitCost   float64 `json:"effective_unit_cost"` // LatestPurchasePrice / YieldRate
	LineCost            float64 `json:"line_cost"`           // UsageQuantity * (LatestPurchasePrice / YieldRate)
}

// ApplyCostItem is for single or bulk menu cost update
type ApplyCostItem struct {
	TargetType string  `json:"target_type"` // 'variant' | 'topping'
	TargetID   uint    `json:"target_id"`
	NewCost    float64 `json:"new_cost" binding:"gte=0"`
}

type ApplyCostRequest struct {
	Items []ApplyCostItem `json:"items" binding:"required"`
}
