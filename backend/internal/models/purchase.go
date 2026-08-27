package models

import "time"

// IngredientConversionPreset represents a saved packaging specification for purchasing an ingredient
type IngredientConversionPreset struct {
	ID           string  `json:"id,omitempty"`
	Label        string  `json:"label,omitempty"`
	PurchaseUnit string  `json:"purchase_unit"`
	PackQty      float64 `json:"pack_qty"`
	PackUnit     string  `json:"pack_unit"`
	CapacityQty  float64 `json:"capacity_qty"`
	CapacityUnit string  `json:"capacity_unit"`
	LossRate     float64 `json:"loss_rate"`
}

// Ingredient represents a raw material, fresh produce, beverage supply, or packaging
type Ingredient struct {
	ID                   uint      `gorm:"primaryKey" json:"id"`
	Name                 string    `gorm:"type:varchar(150);not null;uniqueIndex" json:"name"`
	Category             string    `gorm:"type:varchar(50);not null;default:'fruit'" json:"category"` // 'fruit', 'ingredient', 'packaging', 'other'
	Unit                 string    `gorm:"type:varchar(20);not null" json:"unit"`                     // Legacy field, synced with BaseUnit
	BaseUnit             string    `gorm:"type:varchar(20);not null;default:'ml'" json:"base_unit"`  // 'ml', 'g', 'cái', 'quả', 'viên', 'lon', 'hộp', 'lít', 'kg'
	LossRate             float64   `gorm:"type:decimal(5,4);not null;default:0.0000" json:"loss_rate"` // e.g. 0.05 for 5% waste
	LatestPurchasePrice  float64   `gorm:"type:decimal(15,2);not null;default:0.00" json:"latest_purchase_price"`  // Effective base price per BaseUnit
	AveragePurchasePrice float64   `gorm:"type:decimal(15,2);not null;default:0.00" json:"average_purchase_price"` // Effective weighted average base price per BaseUnit
	YieldRate            float64   `gorm:"type:decimal(5,4);not null;default:1.0000" json:"yield_rate"`            // Legacy field: 1.0 - LossRate
	DefaultPurchaseUnit  string    `gorm:"type:varchar(50);not null;default:''" json:"default_purchase_unit"`      // e.g. 'Chai', 'Thùng', 'Túi'
	DefaultPackQty       float64   `gorm:"type:decimal(10,3);not null;default:1.000" json:"default_pack_qty"`      // e.g. 12 (chai per thùng)
	DefaultPackUnit      string    `gorm:"type:varchar(50);not null;default:''" json:"default_pack_unit"`          // e.g. 'Chai'
	DefaultCapacityQty   float64   `gorm:"type:decimal(10,3);not null;default:1.000" json:"default_capacity_qty"`  // e.g. 1000
	DefaultCapacityUnit  string    `gorm:"type:varchar(20);not null;default:''" json:"default_capacity_unit"`      // e.g. 'ml'
	SavedConversions     string    `gorm:"type:jsonb;not null;default:'[]'" json:"saved_conversions"`              // JSON string of []IngredientConversionPreset
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// PurchaseItem represents an itemized line item inside an outflow transaction (Expense / Purchase)
type PurchaseItem struct {
	ID                    uint        `gorm:"primaryKey" json:"id"`
	TransactionID         uint        `gorm:"not null;index" json:"transaction_id"`
	IngredientID          uint        `gorm:"not null;index" json:"ingredient_id"`
	Ingredient            *Ingredient `gorm:"foreignKey:IngredientID" json:"ingredient,omitempty"`
	Quantity              float64     `gorm:"type:decimal(10,3);not null" json:"quantity"` // Legacy field: total_base_quantity or purchase_quantity
	UnitPrice             float64     `gorm:"type:decimal(15,2);not null;default:0.00" json:"unit_price"` // Legacy field
	Subtotal              float64     `gorm:"type:decimal(15,2);not null;default:0.00" json:"subtotal"`
	PurchaseUnit          string      `gorm:"type:varchar(50);not null;default:''" json:"purchase_unit"`
	PurchaseQuantity      float64     `gorm:"type:decimal(10,3);not null;default:0.000" json:"purchase_quantity"`
	PurchaseUnitPrice     float64     `gorm:"type:decimal(15,2);not null;default:0.00" json:"purchase_unit_price"`
	PackQty               float64     `gorm:"type:decimal(10,3);not null;default:1.000" json:"pack_qty"`
	PackUnit              string      `gorm:"type:varchar(50);not null;default:''" json:"pack_unit"`
	CapacityQty           float64     `gorm:"type:decimal(10,3);not null;default:1.000" json:"capacity_qty"`
	CapacityUnit          string      `gorm:"type:varchar(20);not null;default:''" json:"capacity_unit"`
	ConversionRate        float64     `gorm:"type:decimal(15,4);not null;default:1.0000" json:"conversion_rate"`
	TotalBaseQuantity     float64     `gorm:"type:decimal(15,3);not null;default:0.000" json:"total_base_quantity"`
	BaseUnit              string      `gorm:"type:varchar(20);not null;default:''" json:"base_unit"`
	BaseUnitPrice         float64     `gorm:"type:decimal(15,4);not null;default:0.0000" json:"base_unit_price"`
	LossRate              float64     `gorm:"type:decimal(5,4);not null;default:0.0000" json:"loss_rate"`
	EffectiveBaseQuantity float64     `gorm:"type:decimal(15,3);not null;default:0.000" json:"effective_base_quantity"`
	EffectiveBasePrice    float64     `gorm:"type:decimal(15,4);not null;default:0.0000" json:"effective_base_price"`
	ConversionSpec        string      `gorm:"type:varchar(255);not null;default:''" json:"conversion_spec"`
	CreatedAt             time.Time   `json:"created_at"`
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
	UsageQuantity    float64         `gorm:"type:decimal(10,3);not null" json:"usage_quantity"` // In Ingredient's BaseUnit (e.g. 60 ml, 30 g, 1 cái)
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
}

// DTOs for API requests and responses

// PurchaseItemInput is submitted when creating a transaction with itemized purchases
type PurchaseItemInput struct {
	IngredientName        string  `json:"ingredient_name"`
	IngredientID          *uint   `json:"ingredient_id"`
	Category              string  `json:"category"`
	Quantity              float64 `json:"quantity"`
	UnitPrice             float64 `json:"unit_price"`
	Unit                  string  `json:"unit"`
	PurchaseUnit          string  `json:"purchase_unit"`
	PurchaseQuantity      float64 `json:"purchase_quantity"`
	PurchaseUnitPrice     float64 `json:"purchase_unit_price"`
	PackQty               float64 `json:"pack_qty"`
	PackUnit              string  `json:"pack_unit"`
	CapacityQty           float64 `json:"capacity_qty"`
	CapacityUnit          string  `json:"capacity_unit"`
	ConversionRate        float64 `json:"conversion_rate"`
	TotalBaseQuantity     float64 `json:"total_base_quantity"`
	BaseUnit              string  `json:"base_unit"`
	BaseUnitPrice         float64 `json:"base_unit_price"`
	LossRate              float64 `json:"loss_rate"`
	EffectiveBaseQuantity float64 `json:"effective_base_quantity"`
	EffectiveBasePrice    float64 `json:"effective_base_price"`
	ConversionSpec        string  `json:"conversion_spec"`
}

// CreateOrUpdateIngredientRequest is for managing the ingredient catalog
type CreateOrUpdateIngredientRequest struct {
	Name                string   `json:"name" binding:"required"`
	Category            string   `json:"category"`
	Unit                string   `json:"unit"`
	BaseUnit            string   `json:"base_unit"`
	LossRate            float64  `json:"loss_rate"`
	YieldRate           float64  `json:"yield_rate"`
	LatestPurchasePrice *float64 `json:"latest_purchase_price"`
	DefaultPurchaseUnit string   `json:"default_purchase_unit"`
	DefaultPackQty      float64  `json:"default_pack_qty"`
	DefaultPackUnit     string   `json:"default_pack_unit"`
	DefaultCapacityQty  float64  `json:"default_capacity_qty"`
	DefaultCapacityUnit string   `json:"default_capacity_unit"`
	SavedConversions    string   `json:"saved_conversions"`
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
	EstimatedCOGS        float64            `json:"estimated_cogs"`     // Based on latest effective purchase price per base unit
	EstimatedCOGSAvg     float64            `json:"estimated_cogs_avg"` // Based on weighted average effective purchase price per base unit
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
	BaseUnit            string  `json:"base_unit"`
	UsageQuantity       float64 `json:"usage_quantity"`
	LossRate            float64 `json:"loss_rate"`
	YieldRate           float64 `json:"yield_rate"`
	LatestPurchasePrice float64 `json:"latest_purchase_price"` // Price per base unit
	EffectiveUnitCost   float64 `json:"effective_unit_cost"`   // Effective price per base unit
	LineCost            float64 `json:"line_cost"`             // UsageQuantity * EffectiveUnitCost
}

// ApplyCostItem is for single or bulk menu cost update
type ApplyCostItem struct {
	TargetType string  `json:"target_type"` // 'variant' | 'topping'
	TargetID   uint    `json:"target_id"`
	NewCost    float64 `json:"new_cost" binding:"gte=0"`
}

type ApplyCostRequest struct {
	TargetType string          `json:"target_type"` // Optional single item
	TargetID   uint            `json:"target_id"`   // Optional single item
	NewCost    *float64        `json:"new_cost"`    // Optional single item
	Items      []ApplyCostItem `json:"items"`       // Bulk items
}
