package handlers

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PurchaseHandler struct {
	db           *gorm.DB
	productCache *cache.TTLCache
	toppingCache *cache.TTLCache
}

func NewPurchaseHandler(db *gorm.DB, productCache *cache.TTLCache, toppingCache *cache.TTLCache) *PurchaseHandler {
	return &PurchaseHandler{
		db:           db,
		productCache: productCache,
		toppingCache: toppingCache,
	}
}

// ── Ingredients Management ──────────────────────────────────────────────────

// ListIngredients returns all registered raw materials, produce, and packaging items
func (h *PurchaseHandler) ListIngredients(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	query := h.db.Scopes(database.ScopeByStore(storeID)).Model(&models.Ingredient{})

	if cat := c.Query("category"); cat != "" && cat != "all" {
		query = query.Where("category = ?", cat)
	}

	if q := strings.TrimSpace(c.Query("q")); q != "" {
		query = query.Where("LOWER(name) LIKE LOWER(?)", "%"+q+"%")
	}

	var ingredients []models.Ingredient
	if err := query.Order("category ASC, name ASC").Find(&ingredients).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve ingredients", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, ingredients, "Ingredients retrieved successfully")
}

// CreateIngredient creates a new ingredient manually
func (h *PurchaseHandler) CreateIngredient(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req models.CreateOrUpdateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		models.SendError(c, http.StatusBadRequest, "Ingredient name is required")
		return
	}

	// Check duplicate name within store
	var existing models.Ingredient
	if err := h.db.Scopes(database.ScopeByStore(storeID)).Where("LOWER(name) = LOWER(?)", name).First(&existing).Error; err == nil {
		models.SendError(c, http.StatusConflict, "An ingredient with this name already exists in this store")
		return
	}

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "fruit"
	}
	baseUnit := strings.TrimSpace(req.BaseUnit)
	if baseUnit == "" {
		baseUnit = strings.TrimSpace(req.Unit)
	}
	if baseUnit == "" {
		baseUnit = "ml"
	}

	lossRate := req.LossRate
	if lossRate < 0 || lossRate >= 1.0 {
		if req.YieldRate > 0 && req.YieldRate <= 1.0 {
			lossRate = 1.0 - req.YieldRate
		} else {
			lossRate = 0.0
		}
	}
	yieldRate := 1.0 - lossRate
	if yieldRate <= 0 {
		yieldRate = 1.0
	}

	packQty := req.DefaultPackQty
	if packQty <= 0 {
		packQty = 1.0
	}
	capQty := req.DefaultCapacityQty
	if capQty <= 0 {
		capQty = 1.0
	}

	savedConversions := strings.TrimSpace(req.SavedConversions)
	if savedConversions == "" {
		savedConversions = "[]"
	}

	initPrice := 0.0
	if req.LatestPurchasePrice != nil && *req.LatestPurchasePrice >= 0 {
		initPrice = *req.LatestPurchasePrice
	}

	avgPrice := initPrice
	if req.AveragePurchasePrice != nil && *req.AveragePurchasePrice >= 0 {
		avgPrice = *req.AveragePurchasePrice
	}

	ingredient := models.Ingredient{
		StoreID:              storeID,
		Name:                 name,
		Category:             category,
		Unit:                 baseUnit,
		BaseUnit:             baseUnit,
		LossRate:             lossRate,
		YieldRate:            yieldRate,
		LatestPurchasePrice:  initPrice,
		AveragePurchasePrice: avgPrice,
		DefaultPurchaseUnit:  strings.TrimSpace(req.DefaultPurchaseUnit),
		DefaultPackQty:       packQty,
		DefaultPackUnit:      strings.TrimSpace(req.DefaultPackUnit),
		DefaultCapacityQty:   capQty,
		DefaultCapacityUnit:  strings.TrimSpace(req.DefaultCapacityUnit),
		SavedConversions:     savedConversions,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	if err := h.db.Create(&ingredient).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to create ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusCreated, ingredient, "Ingredient created successfully")
}

// UpdateIngredient updates an existing ingredient
func (h *PurchaseHandler) UpdateIngredient(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var ingredient models.Ingredient
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&ingredient, id).Error; err != nil {
		models.SendError(c, http.StatusNotFound, "Ingredient not found")
		return
	}

	var req models.CreateOrUpdateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	name := strings.TrimSpace(req.Name)
	if name != "" && name != ingredient.Name {
		var existing models.Ingredient
		if err := h.db.Scopes(database.ScopeByStore(storeID)).Where("id != ? AND LOWER(name) = LOWER(?)", id, name).First(&existing).Error; err == nil {
			models.SendError(c, http.StatusConflict, "Another ingredient with this name already exists in this store")
			return
		}
		ingredient.Name = name
	}

	if cat := strings.TrimSpace(req.Category); cat != "" {
		ingredient.Category = cat
	}
	if bu := strings.TrimSpace(req.BaseUnit); bu != "" {
		ingredient.BaseUnit = bu
		ingredient.Unit = bu
	} else if u := strings.TrimSpace(req.Unit); u != "" {
		ingredient.BaseUnit = u
		ingredient.Unit = u
	}

	if req.LossRate >= 0 && req.LossRate < 1.0 {
		ingredient.LossRate = req.LossRate
		ingredient.YieldRate = 1.0 - req.LossRate
	} else if req.YieldRate > 0 && req.YieldRate <= 1.0 {
		ingredient.YieldRate = req.YieldRate
		ingredient.LossRate = 1.0 - req.YieldRate
	}

	if req.LatestPurchasePrice != nil && *req.LatestPurchasePrice >= 0 {
		ingredient.LatestPurchasePrice = *req.LatestPurchasePrice
	}
	if req.AveragePurchasePrice != nil && *req.AveragePurchasePrice >= 0 {
		ingredient.AveragePurchasePrice = *req.AveragePurchasePrice
	}

	if dpu := strings.TrimSpace(req.DefaultPurchaseUnit); dpu != "" {
		ingredient.DefaultPurchaseUnit = dpu
	}
	if req.DefaultPackQty > 0 {
		ingredient.DefaultPackQty = req.DefaultPackQty
	}
	if dpu := strings.TrimSpace(req.DefaultPackUnit); dpu != "" {
		ingredient.DefaultPackUnit = dpu
	}
	if req.DefaultCapacityQty > 0 {
		ingredient.DefaultCapacityQty = req.DefaultCapacityQty
	}
	if dcu := strings.TrimSpace(req.DefaultCapacityUnit); dcu != "" {
		ingredient.DefaultCapacityUnit = dcu
	}
	if sc := strings.TrimSpace(req.SavedConversions); sc != "" {
		ingredient.SavedConversions = sc
	}

	ingredient.UpdatedAt = time.Now()

	if err := h.db.Save(&ingredient).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, ingredient, "Ingredient updated successfully")
}

// DeleteIngredient deletes an ingredient if not referenced in any recipe
func (h *PurchaseHandler) DeleteIngredient(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var ingredient models.Ingredient
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&ingredient, id).Error; err != nil {
		models.SendError(c, http.StatusNotFound, "Ingredient not found")
		return
	}

	// Check if ingredient is used in any recipes
	var recipeCount int64
	h.db.Model(&models.RecipeItem{}).Where("ingredient_id = ?", id).Count(&recipeCount)
	if recipeCount > 0 {
		models.SendError(c, http.StatusBadRequest, "Cannot delete ingredient referenced by active recipes")
		return
	}

	if err := h.db.Scopes(database.ScopeByStore(storeID)).Delete(&ingredient).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"id": id}, "Ingredient deleted successfully")
}

// GetIngredientHistory returns purchase records for an ingredient with full conversion metrics
func (h *PurchaseHandler) GetIngredientHistory(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var ingredient models.Ingredient
	if err := h.db.Scopes(database.ScopeByStore(storeID)).First(&ingredient, id).Error; err != nil {
		models.SendError(c, http.StatusNotFound, "Ingredient not found")
		return
	}

	type HistoryItem struct {
		ID                    uint      `json:"id"`
		TransactionID         uint      `json:"transaction_id"`
		Quantity              float64   `json:"quantity"`
		UnitPrice             float64   `json:"unit_price"`
		Subtotal              float64   `json:"subtotal"`
		PurchaseUnit          string    `json:"purchase_unit"`
		PurchaseQuantity      float64   `json:"purchase_quantity"`
		PurchaseUnitPrice     float64   `json:"purchase_unit_price"`
		PackQty               float64   `json:"pack_qty"`
		PackUnit              string    `json:"pack_unit"`
		CapacityQty           float64   `json:"capacity_qty"`
		CapacityUnit          string    `json:"capacity_unit"`
		ConversionRate        float64   `json:"conversion_rate"`
		TotalBaseQuantity     float64   `json:"total_base_quantity"`
		BaseUnit              string    `json:"base_unit"`
		BaseUnitPrice         float64   `json:"base_unit_price"`
		LossRate              float64   `json:"loss_rate"`
		EffectiveBaseQuantity float64   `json:"effective_base_quantity"`
		EffectiveBasePrice    float64   `json:"effective_base_price"`
		ConversionSpec        string    `json:"conversion_spec"`
		CreatedAt             time.Time `json:"created_at"`
		FundName              string    `json:"fund_name"`
		CashierName           string    `json:"cashier_name"`
		Description           string    `json:"description"`
	}

	var history []HistoryItem
	h.db.Table("purchase_items").
		Select(`purchase_items.id, purchase_items.transaction_id, purchase_items.quantity, purchase_items.unit_price, 
			purchase_items.subtotal, purchase_items.purchase_unit, purchase_items.purchase_quantity, purchase_items.purchase_unit_price,
			purchase_items.pack_qty, purchase_items.pack_unit, purchase_items.capacity_qty, purchase_items.capacity_unit,
			purchase_items.conversion_rate, purchase_items.total_base_quantity, purchase_items.base_unit, purchase_items.base_unit_price,
			purchase_items.loss_rate, purchase_items.effective_base_quantity, purchase_items.effective_base_price, purchase_items.conversion_spec,
			COALESCE(NULLIF(purchase_items.created_at, '0001-01-01 00:00:00+00'), transactions.created_at) as created_at, 
			funds.name as fund_name, transactions.cashier_name, transactions.description`).
		Joins("JOIN transactions ON transactions.id = purchase_items.transaction_id").
		Joins("LEFT JOIN funds ON funds.id = transactions.fund_id").
		Where("purchase_items.ingredient_id = ? AND transactions.store_id = ?", id, storeID).
		Order("created_at DESC, purchase_items.id DESC").
		Scan(&history)

	models.SendSuccess(c, http.StatusOK, gin.H{
		"ingredient": ingredient,
		"history":    history,
	}, "Purchase history retrieved successfully")
}

// GetAllPurchaseHistory returns all chronological purchase records across transactions with conversion details
func (h *PurchaseHandler) GetAllPurchaseHistory(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	type PurchaseRecord struct {
		ID                    uint      `json:"id"`
		TransactionID         uint      `json:"transaction_id"`
		IngredientID          *uint     `json:"ingredient_id"`
		IngredientName        string    `json:"ingredient_name"`
		Category              string    `json:"category"`
		Quantity              float64   `json:"quantity"`
		UnitPrice             float64   `json:"unit_price"`
		Subtotal              float64   `json:"subtotal"`
		PurchaseUnit          string    `json:"purchase_unit"`
		PurchaseQuantity      float64   `json:"purchase_quantity"`
		PurchaseUnitPrice     float64   `json:"purchase_unit_price"`
		PackQty               float64   `json:"pack_qty"`
		PackUnit              string    `json:"pack_unit"`
		CapacityQty           float64   `json:"capacity_qty"`
		CapacityUnit          string    `json:"capacity_unit"`
		TotalBaseQuantity     float64   `json:"total_base_quantity"`
		BaseUnit              string    `json:"base_unit"`
		BaseUnitPrice         float64   `json:"base_unit_price"`
		LossRate              float64   `json:"loss_rate"`
		EffectiveBaseQuantity float64   `json:"effective_base_quantity"`
		EffectiveBasePrice    float64   `json:"effective_base_price"`
		ConversionSpec        string    `json:"conversion_spec"`
		CreatedAt             time.Time `json:"created_at"`
		FundName              string    `json:"fund_name"`
		CashierName           string    `json:"cashier_name"`
		Description           string    `json:"description"`
	}

	var records []PurchaseRecord
	h.db.Table("purchase_items").
		Select(`purchase_items.id, purchase_items.transaction_id, purchase_items.ingredient_id,
			COALESCE(ingredients.name, '') as ingredient_name,
			COALESCE(ingredients.category, 'ingredient') as category,
			purchase_items.quantity, purchase_items.unit_price, purchase_items.subtotal,
			purchase_items.purchase_unit, purchase_items.purchase_quantity, purchase_items.purchase_unit_price,
			purchase_items.pack_qty, purchase_items.pack_unit, purchase_items.capacity_qty, purchase_items.capacity_unit,
			purchase_items.total_base_quantity, purchase_items.base_unit, purchase_items.base_unit_price,
			purchase_items.loss_rate, purchase_items.effective_base_quantity, purchase_items.effective_base_price,
			purchase_items.conversion_spec,
			COALESCE(NULLIF(purchase_items.created_at, '0001-01-01 00:00:00+00'), transactions.created_at) as created_at,
			funds.name as fund_name, transactions.cashier_name, transactions.description`).
		Joins("JOIN transactions ON transactions.id = purchase_items.transaction_id").
		Joins("LEFT JOIN ingredients ON ingredients.id = purchase_items.ingredient_id").
		Joins("LEFT JOIN funds ON funds.id = transactions.fund_id").
		Where("transactions.store_id = ?", storeID).
		Order("created_at DESC, purchase_items.id DESC").
		Limit(500).
		Scan(&records)

	// Retrieve un-itemized legacy outflow/expense transactions so past purchases are not missed
	type UnitemizedTx struct {
		ID          uint      `json:"id"`
		FundID      uint      `json:"fund_id"`
		FundName    string    `json:"fund_name"`
		Category    string    `json:"category"`
		Amount      float64   `json:"amount"`
		Description string    `json:"description"`
		CashierName string    `json:"cashier_name"`
		CreatedAt   time.Time `json:"created_at"`
	}
	var legacyTxs []UnitemizedTx
	h.db.Table("transactions").
		Select("transactions.id, transactions.fund_id, funds.name as fund_name, transactions.category, transactions.amount, transactions.description, transactions.cashier_name, transactions.created_at").
		Joins("LEFT JOIN funds ON funds.id = transactions.fund_id").
		Where("transactions.store_id = ? AND transactions.transaction_type = 'outflow'", storeID).
		Where("transactions.id NOT IN (SELECT DISTINCT transaction_id FROM purchase_items WHERE transaction_id IS NOT NULL)").
		Order("transactions.created_at DESC, transactions.id DESC").
		Limit(300).
		Scan(&legacyTxs)

	for _, tx := range legacyTxs {
		ingName := strings.TrimSpace(tx.Description)
		if ingName == "" {
			ingName = string(tx.Category)
		}
		if ingName == "" {
			ingName = "Chi phí mua hàng"
		}

		spec := "Phiếu chi: " + tx.Description
		if strings.TrimSpace(tx.Description) == "" {
			spec = "Phiếu chi " + string(tx.Category)
		}

		records = append(records, PurchaseRecord{
			ID:                    tx.ID,
			TransactionID:         tx.ID,
			IngredientID:          nil,
			IngredientName:        ingName,
			Category:              string(tx.Category),
			Quantity:              1,
			UnitPrice:             tx.Amount,
			Subtotal:              tx.Amount,
			PurchaseUnit:          "Đợt nhập",
			PurchaseQuantity:      1,
			PurchaseUnitPrice:     tx.Amount,
			PackQty:               1,
			PackUnit:              "",
			CapacityQty:           1,
			CapacityUnit:          "lần",
			TotalBaseQuantity:     1,
			BaseUnit:              "lần",
			BaseUnitPrice:         tx.Amount,
			LossRate:              0,
			EffectiveBaseQuantity: 1,
			EffectiveBasePrice:    tx.Amount,
			ConversionSpec:        spec,
			CreatedAt:             tx.CreatedAt,
			FundName:              tx.FundName,
			CashierName:           tx.CashierName,
			Description:           tx.Description,
		})
	}

	// Sort combined list by CreatedAt DESC
	sort.Slice(records, func(i, j int) bool {
		return records[i].CreatedAt.After(records[j].CreatedAt)
	})

	var totalSpend float64 = 0
	for _, r := range records {
		totalSpend += r.Subtotal
	}

	models.SendSuccess(c, http.StatusOK, gin.H{
		"items":       records,
		"total_spend": totalSpend,
		"count":       len(records),
	}, "All purchase history retrieved successfully")
}

// ── Recipe BOM & Cost Calculation ──────────────────────────────────────────

// GetCostComparison computes real-time recipe theoretical COGS vs active menu COGS
func (h *PurchaseHandler) GetCostComparison(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	// 1. Fetch all product variants with Product and Category for active store
	var products []models.Product
	if err := h.db.Scopes(database.ScopeByStore(storeID)).Preload("Category").Preload("Variants", "is_active = true").Where("is_active = true").Find(&products).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load products for cost comparison", err)
		return
	}

	// 2. Fetch all RecipeItems with preloaded Ingredient belonging to active store
	var allRecipeItems []models.RecipeItem
	if err := h.db.Joins("JOIN ingredients ON ingredients.id = recipe_items.ingredient_id").
		Where("ingredients.store_id = ?", storeID).
		Preload("Ingredient").Find(&allRecipeItems).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load recipe items", err)
		return
	}

	// Group recipe items by variant ID and topping ID
	variantRecipes := make(map[uint][]models.RecipeItem)
	toppingRecipes := make(map[uint][]models.RecipeItem)

	for _, item := range allRecipeItems {
		if item.ProductVariantID != nil {
			variantRecipes[*item.ProductVariantID] = append(variantRecipes[*item.ProductVariantID], item)
		} else if item.ToppingID != nil {
			toppingRecipes[*item.ToppingID] = append(toppingRecipes[*item.ToppingID], item)
		}
	}

	var results []models.CostComparisonItem

	// 3. Process Product Variants
	for _, p := range products {
		catName := ""
		if p.Category != nil {
			catName = p.Category.Name
		}

		for _, v := range p.Variants {
			var estimatedLatest float64 = 0.0
			var estimatedAvg float64 = 0.0
			var recipeDetails []models.RecipeDetailItem

			recipes := variantRecipes[v.ID]
			for _, r := range recipes {
				if r.Ingredient == nil {
					continue
				}

				effectiveLatest := r.Ingredient.LatestPurchasePrice
				lineCostLatest := math.Round(r.UsageQuantity*effectiveLatest*100) / 100
				estimatedLatest += lineCostLatest

				effectiveAvg := r.Ingredient.AveragePurchasePrice
				lineCostAvg := math.Round(r.UsageQuantity*effectiveAvg*100) / 100
				estimatedAvg += lineCostAvg

				recipeDetails = append(recipeDetails, models.RecipeDetailItem{
					IngredientID:        r.Ingredient.ID,
					IngredientName:      r.Ingredient.Name,
					Category:            r.Ingredient.Category,
					Unit:                r.Ingredient.Unit,
					BaseUnit:            r.Ingredient.BaseUnit,
					UsageQuantity:       r.UsageQuantity,
					LossRate:            r.Ingredient.LossRate,
					YieldRate:           r.Ingredient.YieldRate,
					LatestPurchasePrice: r.Ingredient.LatestPurchasePrice,
					EffectiveUnitCost:   math.Round(effectiveLatest*100) / 100,
					LineCost:            lineCostLatest,
				})
			}

			estimatedLatest = math.Round(estimatedLatest*100) / 100
			estimatedAvg = math.Round(estimatedAvg*100) / 100

			diff := estimatedLatest - v.CogsPrice
			var marginPct float64 = 0.0
			if v.RetailPrice > 0 {
				costForMargin := estimatedLatest
				if costForMargin <= 0 {
					costForMargin = v.CogsPrice
				}
				marginPct = math.Round(((v.RetailPrice-costForMargin)/v.RetailPrice)*1000) / 10
			}

			results = append(results, models.CostComparisonItem{
				TargetType:       "variant",
				TargetID:         v.ID,
				ProductID:        &p.ID,
				ProductName:      p.Name,
				VariantName:      v.VariantName,
				CategoryName:     catName,
				ImageURL:         p.ImageURL,
				RetailPrice:      v.RetailPrice,
				CurrentCOGS:      v.CogsPrice,
				EstimatedCOGS:    estimatedLatest,
				EstimatedCOGSAvg: estimatedAvg,
				Difference:       diff,
				MarginPercentage: marginPct,
				RecipeItemCount:  len(recipes),
				RecipeDetails:    recipeDetails,
			})
		}
	}

	// 4. Process Toppings scoped to active store
	var toppings []models.Topping
	if err := h.db.Scopes(database.ScopeByStore(storeID)).Preload("Category").Where("is_active = true").Find(&toppings).Error; err == nil {
		for _, tp := range toppings {
			catName := "Topping toàn cục"
			if tp.Category != nil {
				catName = tp.Category.Name
			}

			var estimatedLatest float64 = 0.0
			var estimatedAvg float64 = 0.0
			var recipeDetails []models.RecipeDetailItem

			recipes := toppingRecipes[tp.ID]
			for _, r := range recipes {
				if r.Ingredient == nil {
					continue
				}

				effectiveLatest := r.Ingredient.LatestPurchasePrice
				lineCostLatest := math.Round(r.UsageQuantity*effectiveLatest*100) / 100
				estimatedLatest += lineCostLatest

				effectiveAvg := r.Ingredient.AveragePurchasePrice
				lineCostAvg := math.Round(r.UsageQuantity*effectiveAvg*100) / 100
				estimatedAvg += lineCostAvg

				recipeDetails = append(recipeDetails, models.RecipeDetailItem{
					IngredientID:        r.Ingredient.ID,
					IngredientName:      r.Ingredient.Name,
					Category:            r.Ingredient.Category,
					Unit:                r.Ingredient.Unit,
					BaseUnit:            r.Ingredient.BaseUnit,
					UsageQuantity:       r.UsageQuantity,
					LossRate:            r.Ingredient.LossRate,
					YieldRate:           r.Ingredient.YieldRate,
					LatestPurchasePrice: r.Ingredient.LatestPurchasePrice,
					EffectiveUnitCost:   math.Round(effectiveLatest*100) / 100,
					LineCost:            lineCostLatest,
				})
			}

			estimatedLatest = math.Round(estimatedLatest*100) / 100
			estimatedAvg = math.Round(estimatedAvg*100) / 100

			diff := estimatedLatest - tp.COGS
			var marginPct float64 = 0.0
			if tp.Price > 0 {
				costForMargin := estimatedLatest
				if costForMargin <= 0 {
					costForMargin = tp.COGS
				}
				marginPct = math.Round(((tp.Price-costForMargin)/tp.Price)*1000) / 10
			}

			results = append(results, models.CostComparisonItem{
				TargetType:       "topping",
				TargetID:         tp.ID,
				ProductName:      tp.Name,
				VariantName:      "Topping",
				CategoryName:     catName,
				RetailPrice:      tp.Price,
				CurrentCOGS:      tp.COGS,
				EstimatedCOGS:    estimatedLatest,
				EstimatedCOGSAvg: estimatedAvg,
				Difference:       diff,
				MarginPercentage: marginPct,
				RecipeItemCount:  len(recipes),
				RecipeDetails:    recipeDetails,
			})
		}
	}

	models.SendSuccess(c, http.StatusOK, results, "Cost comparison generated successfully")
}

// ApplyCostToMenu updates the menu COGS (cogs_price for product_variant, cogs for topping)
func (h *PurchaseHandler) ApplyCostToMenu(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	var req models.ApplyCostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	itemsToApply := req.Items
	if len(itemsToApply) == 0 && req.TargetType != "" && req.TargetID > 0 && req.NewCost != nil {
		itemsToApply = append(itemsToApply, models.ApplyCostItem{
			TargetType: req.TargetType,
			TargetID:   req.TargetID,
			NewCost:    *req.NewCost,
		})
	}

	if len(itemsToApply) == 0 {
		models.SendError(c, http.StatusBadRequest, "No items provided to apply cost")
		return
	}

	appliedCount := 0
	err := h.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range itemsToApply {
			if item.TargetType == "topping" {
				if err := database.AssertOwned(tx, &models.Topping{}, item.TargetID, storeID); err != nil {
					return err
				}
				if err := tx.Scopes(database.ScopeByStore(storeID)).Model(&models.Topping{}).Where("id = ?", item.TargetID).Update("cogs", item.NewCost).Error; err != nil {
					return err
				}
				appliedCount++
			} else {
				// Default to variant: verify parent product ownership
				if err := database.AssertVariantOwned(tx, item.TargetID, storeID); err != nil {
					return err
				}
				if err := tx.Model(&models.ProductVariant{}).Where("id = ?", item.TargetID).Update("cogs_price", item.NewCost).Error; err != nil {
					return err
				}
				appliedCount++
			}
		}
		return nil
	})

	if err != nil {
		if errors.Is(err, database.ErrNotInStore) {
			models.SendError(c, http.StatusNotFound, "Một hoặc nhiều món không thuộc cửa hàng này")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to apply new costs to menu", err)
		return
	}

	if h.productCache != nil {
		h.productCache.Invalidate(fmt.Sprintf("s%d:products:list", storeID))
	}
	if h.toppingCache != nil {
		h.toppingCache.Invalidate(fmt.Sprintf("s%d:toppings:list", storeID))
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"applied_count": appliedCount}, "Menu costs updated successfully")
}

// GetRecipe retrieves recipe items for a product variant or topping
func (h *PurchaseHandler) GetRecipe(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	targetType := c.Param("target_type") // 'variant' or 'topping'
	targetIDStr := c.Param("target_id")
	targetID, err := strconv.ParseUint(targetIDStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid target ID")
		return
	}

	var items []models.RecipeItem
	query := h.db.Preload("Ingredient")
	if targetType == "topping" {
		if err := database.AssertOwned(h.db, &models.Topping{}, uint(targetID), storeID); err != nil {
			models.SendError(c, http.StatusNotFound, "Topping not found in active store")
			return
		}
		query = query.Where("topping_id = ?", targetID)
	} else {
		if err := database.AssertVariantOwned(h.db, uint(targetID), storeID); err != nil {
			models.SendError(c, http.StatusNotFound, "Product variant not found in active store")
			return
		}
		query = query.Where("product_variant_id = ?", targetID)
	}

	if err := query.Find(&items).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve recipe", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, items, "Recipe retrieved successfully")
}

// SaveRecipe replaces all recipe items for a product variant or topping
func (h *PurchaseHandler) SaveRecipe(c *gin.Context) {
	storeID := middleware.MustGetStoreID(c)
	if storeID == 0 {
		return
	}

	targetType := c.Param("target_type") // 'variant' or 'topping'
	targetIDStr := c.Param("target_id")
	targetID, err := strconv.ParseUint(targetIDStr, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid target ID")
		return
	}

	var req models.SaveRecipeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// 1. Verify target ownership
		if targetType == "topping" {
			if err := database.AssertOwned(tx, &models.Topping{}, uint(targetID), storeID); err != nil {
				return err
			}
			if err := tx.Where("topping_id = ?", targetID).Delete(&models.RecipeItem{}).Error; err != nil {
				return err
			}
		} else {
			if err := database.AssertVariantOwned(tx, uint(targetID), storeID); err != nil {
				return err
			}
			if err := tx.Where("product_variant_id = ?", targetID).Delete(&models.RecipeItem{}).Error; err != nil {
				return err
			}
		}

		// 2. Verify all ingredient IDs belong to active store
		var ingIDs []uint
		for _, item := range req.Items {
			if item.IngredientID > 0 {
				ingIDs = append(ingIDs, item.IngredientID)
			}
		}
		if err := database.AssertOwnedIDs(tx, &models.Ingredient{}, ingIDs, storeID); err != nil {
			return err
		}

		// 3. Insert new recipe items
		for _, item := range req.Items {
			if item.UsageQuantity <= 0 {
				continue
			}

			recipeItem := models.RecipeItem{
				IngredientID:  item.IngredientID,
				UsageQuantity: item.UsageQuantity,
				CreatedAt:     time.Now(),
				UpdatedAt:     time.Now(),
			}
			if targetType == "topping" {
				tID := uint(targetID)
				recipeItem.ToppingID = &tID
			} else {
				vID := uint(targetID)
				recipeItem.ProductVariantID = &vID
			}

			if err := tx.Create(&recipeItem).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		if errors.Is(err, database.ErrNotInStore) {
			models.SendError(c, http.StatusNotFound, "Một hoặc nhiều nguyên liệu hoặc mục tiêu không thuộc cửa hàng này")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to save recipe", err)
		return
	}

	if h.productCache != nil {
		h.productCache.Invalidate(fmt.Sprintf("s%d:products:list", storeID))
	}
	if h.toppingCache != nil {
		h.toppingCache.Invalidate(fmt.Sprintf("s%d:toppings:list", storeID))
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"saved_count": len(req.Items)}, "Recipe saved successfully")
}
