package handlers

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
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
	query := h.db.Model(&models.Ingredient{})

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

	category := strings.TrimSpace(req.Category)
	if category == "" {
		category = "fruit"
	}
	unit := strings.TrimSpace(req.Unit)
	if unit == "" {
		unit = "kg"
	}
	yieldRate := req.YieldRate
	if yieldRate <= 0 || yieldRate > 1.0 {
		yieldRate = 1.0000
	}

	ingredient := models.Ingredient{
		Name:                 name,
		Category:             category,
		Unit:                 unit,
		YieldRate:            yieldRate,
		LatestPurchasePrice:  0.0,
		AveragePurchasePrice: 0.0,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}

	if err := h.db.Create(&ingredient).Error; err != nil {
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "unique") {
			models.SendError(c, http.StatusConflict, "Tên nguyên liệu này đã tồn tại")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to create ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusCreated, ingredient, "Ingredient created successfully")
}

// UpdateIngredient updates ingredient metadata (category, unit, yield rate)
func (h *PurchaseHandler) UpdateIngredient(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var req models.CreateOrUpdateIngredientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	var ingredient models.Ingredient
	if err := h.db.First(&ingredient, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "Ingredient not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find ingredient", err)
		return
	}

	if name := strings.TrimSpace(req.Name); name != "" {
		ingredient.Name = name
	}
	if category := strings.TrimSpace(req.Category); category != "" {
		ingredient.Category = category
	}
	if unit := strings.TrimSpace(req.Unit); unit != "" {
		ingredient.Unit = unit
	}
	if req.YieldRate > 0 && req.YieldRate <= 1.0 {
		ingredient.YieldRate = req.YieldRate
	}
	ingredient.UpdatedAt = time.Now()

	if err := h.db.Save(&ingredient).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, ingredient, "Ingredient updated successfully")
}

// DeleteIngredient removes an ingredient if not referenced in recipes or purchase items
func (h *PurchaseHandler) DeleteIngredient(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var recipeCount int64
	h.db.Model(&models.RecipeItem{}).Where("ingredient_id = ?", id).Count(&recipeCount)
	if recipeCount > 0 {
		models.SendError(c, http.StatusBadRequest, "Không thể xóa nguyên liệu đang được dùng trong công thức món")
		return
	}

	var purchaseCount int64
	h.db.Model(&models.PurchaseItem{}).Where("ingredient_id = ?", id).Count(&purchaseCount)
	if purchaseCount > 0 {
		models.SendError(c, http.StatusBadRequest, "Không thể xóa nguyên liệu đã có lịch sử nhập hàng")
		return
	}

	if err := h.db.Delete(&models.Ingredient{}, id).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to delete ingredient", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"deleted_id": id}, "Ingredient deleted successfully")
}

// GetIngredientHistory returns the chronological invoice purchase records for an ingredient
func (h *PurchaseHandler) GetIngredientHistory(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid ingredient ID")
		return
	}

	var ingredient models.Ingredient
	if err := h.db.First(&ingredient, id).Error; err != nil {
		models.SendError(c, http.StatusNotFound, "Ingredient not found")
		return
	}

	type HistoryItem struct {
		ID            uint      `json:"id"`
		TransactionID uint      `json:"transaction_id"`
		Quantity      float64   `json:"quantity"`
		UnitPrice     float64   `json:"unit_price"`
		Subtotal      float64   `json:"subtotal"`
		CreatedAt     time.Time `json:"created_at"`
		FundName      string    `json:"fund_name"`
		CashierName   string    `json:"cashier_name"`
		Description   string    `json:"description"`
	}

	var history []HistoryItem
	h.db.Table("purchase_items").
		Select("purchase_items.id, purchase_items.transaction_id, purchase_items.quantity, purchase_items.unit_price, purchase_items.subtotal, purchase_items.created_at, funds.name as fund_name, transactions.cashier_name, transactions.description").
		Joins("JOIN transactions ON transactions.id = purchase_items.transaction_id").
		Joins("LEFT JOIN funds ON funds.id = transactions.fund_id").
		Where("purchase_items.ingredient_id = ?", id).
		Order("purchase_items.created_at DESC").
		Scan(&history)

	models.SendSuccess(c, http.StatusOK, gin.H{
		"ingredient": ingredient,
		"history":    history,
	}, "Purchase history retrieved successfully")
}

// ── Recipe BOM & Cost Calculation ──────────────────────────────────────────

// GetCostComparison computes real-time recipe theoretical COGS vs active menu COGS
func (h *PurchaseHandler) GetCostComparison(c *gin.Context) {
	// 1. Fetch all product variants with Product and Category
	var products []models.Product
	if err := h.db.Preload("Category").Preload("Variants", "is_active = true").Where("is_active = true").Find(&products).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load products for cost comparison", err)
		return
	}

	// 2. Fetch all RecipeItems with preloaded Ingredient
	var allRecipeItems []models.RecipeItem
	if err := h.db.Preload("Ingredient").Find(&allRecipeItems).Error; err != nil {
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

				yield := r.Ingredient.YieldRate
				if yield <= 0 {
					yield = 1.0
				}

				effectiveLatest := r.Ingredient.LatestPurchasePrice / yield
				lineCostLatest := math.Round(r.UsageQuantity*effectiveLatest*100) / 100
				estimatedLatest += lineCostLatest

				effectiveAvg := r.Ingredient.AveragePurchasePrice / yield
				lineCostAvg := math.Round(r.UsageQuantity*effectiveAvg*100) / 100
				estimatedAvg += lineCostAvg

				recipeDetails = append(recipeDetails, models.RecipeDetailItem{
					IngredientID:        r.Ingredient.ID,
					IngredientName:      r.Ingredient.Name,
					Category:            r.Ingredient.Category,
					Unit:                r.Ingredient.Unit,
					UsageQuantity:       r.UsageQuantity,
					YieldRate:           yield,
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

	// 4. Process Toppings
	var toppings []models.Topping
	if err := h.db.Preload("Category").Where("is_active = true").Find(&toppings).Error; err == nil {
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

				yield := r.Ingredient.YieldRate
				if yield <= 0 {
					yield = 1.0
				}

				effectiveLatest := r.Ingredient.LatestPurchasePrice / yield
				lineCostLatest := math.Round(r.UsageQuantity*effectiveLatest*100) / 100
				estimatedLatest += lineCostLatest

				effectiveAvg := r.Ingredient.AveragePurchasePrice / yield
				lineCostAvg := math.Round(r.UsageQuantity*effectiveAvg*100) / 100
				estimatedAvg += lineCostAvg

				recipeDetails = append(recipeDetails, models.RecipeDetailItem{
					IngredientID:        r.Ingredient.ID,
					IngredientName:      r.Ingredient.Name,
					Category:            r.Ingredient.Category,
					Unit:                r.Ingredient.Unit,
					UsageQuantity:       r.UsageQuantity,
					YieldRate:           yield,
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
				if err := tx.Model(&models.Topping{}).Where("id = ?", item.TargetID).Update("cogs", item.NewCost).Error; err != nil {
					return err
				}
				appliedCount++
			} else {
				// Default to variant
				if err := tx.Model(&models.ProductVariant{}).Where("id = ?", item.TargetID).Update("cogs_price", item.NewCost).Error; err != nil {
					return err
				}
				appliedCount++
			}
		}
		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to apply new costs to menu", err)
		return
	}

	if h.productCache != nil {
		h.productCache.Clear()
	}
	if h.toppingCache != nil {
		h.toppingCache.Clear()
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"applied_count": appliedCount}, "Menu costs updated successfully")
}

// GetRecipe retrieves recipe items for a product variant or topping
func (h *PurchaseHandler) GetRecipe(c *gin.Context) {
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
		query = query.Where("topping_id = ?", targetID)
	} else {
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
		// 1. Delete existing recipe items
		if targetType == "topping" {
			if err := tx.Where("topping_id = ?", targetID).Delete(&models.RecipeItem{}).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Where("product_variant_id = ?", targetID).Delete(&models.RecipeItem{}).Error; err != nil {
				return err
			}
		}

		// 2. Insert new recipe items
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
		models.SendInternalErrorLogged(c, "Failed to save recipe", err)
		return
	}

	models.SendSuccess(c, http.StatusOK, gin.H{"saved_count": len(req.Items)}, "Recipe saved successfully")
}
