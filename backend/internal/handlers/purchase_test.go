package handlers

import (
	"math"
	"strings"
	"testing"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"gorm.io/gorm"
)

func setupPurchaseTestDB(t *testing.T) *gorm.DB {
	return testutils.GetTestDB(t)
}

func TestPurchaseUnitConversion_PureMath(t *testing.T) {
	// Test Case 1: Single Level (2 Chai × 1.000 ml = 2.000 ml at 120.000đ/chai -> 120đ/ml)
	purchaseQty := 2.0
	purchaseUnitPrice := 120000.0
	capacityQty := 1000.0
	unitFactor := 1.0
	packQty := 1.0

	conversionRate := packQty * capacityQty * unitFactor
	totalBaseQty := purchaseQty * conversionRate
	subtotal := purchaseQty * purchaseUnitPrice
	baseUnitPrice := subtotal / totalBaseQty

	if totalBaseQty != 2000 {
		t.Errorf("expected 2000 ml, got %v", totalBaseQty)
	}
	if subtotal != 240000 {
		t.Errorf("expected 240000đ, got %v", subtotal)
	}
	if baseUnitPrice != 120 {
		t.Errorf("expected 120đ/ml, got %v", baseUnitPrice)
	}

	// Test Case 2: Loss Rate 5% (1.900 ml -> 126.32đ/ml)
	lossRate := 0.05
	effectiveBaseQty := totalBaseQty * (1.0 - lossRate)
	effectiveBasePrice := math.Round((subtotal/effectiveBaseQty)*100) / 100

	if effectiveBaseQty != 1900 {
		t.Errorf("expected 1900 ml, got %v", effectiveBaseQty)
	}
	if effectiveBasePrice != 126.32 {
		t.Errorf("expected 126.32đ/ml, got %v", effectiveBasePrice)
	}

	// Test Case 3: Multi-Level (3 Thùng × 12 Hộp × 1.000 ml = 36.000 ml at 360.000đ/thùng -> 30đ/ml)
	multiPackQty := 12.0
	multiPurchaseQty := 3.0
	multiUnitPrice := 360000.0
	multiCapQty := 1000.0

	multiConversionRate := multiPackQty * multiCapQty
	multiTotalBase := multiPurchaseQty * multiConversionRate
	multiSubtotal := multiPurchaseQty * multiUnitPrice
	multiBasePrice := multiSubtotal / multiTotalBase

	if multiTotalBase != 36000 {
		t.Errorf("expected 36000 ml, got %v", multiTotalBase)
	}
	if multiSubtotal != 1080000 {
		t.Errorf("expected 1080000đ, got %v", multiSubtotal)
	}
	if multiBasePrice != 30 {
		t.Errorf("expected 30đ/ml, got %v", multiBasePrice)
	}
}

func TestPurchaseUnitConversion_DBIntegration(t *testing.T) {
	db := setupPurchaseTestDB(t)
	txTime := time.Now()

	var fund models.Fund
	if err := db.First(&fund).Error; err != nil {
		fund = models.Fund{Name: "Quỹ Test Mua Hàng", FundType: models.FundTypeCash, CurrentBalance: 1000000, IsActive: true}
		if err := db.Create(&fund).Error; err != nil {
			t.Skip("Cannot create test fund:", err)
		}
		defer db.Delete(&fund)
	}

	testTx := models.Transaction{
		FundID:          fund.ID,
		TransactionType: models.TransactionTypeOutflow,
		Amount:          240000,
		Category:        "ingredient_purchase",
		Description:     "Test purchase conversion",
		CreatedAt:       txTime,
	}
	if err := db.Create(&testTx).Error; err != nil {
		t.Skip("Cannot create test transaction:", err)
	}
	defer db.Delete(&testTx)

	item := models.PurchaseItemInput{
		IngredientName:    "Cốt cà phê test unit",
		BaseUnit:          "ml",
		PurchaseUnit:      "Chai",
		PurchaseQuantity:  2,
		PurchaseUnitPrice: 120000,
		CapacityQty:       1000,
		CapacityUnit:      "ml",
		PackQty:           1,
		LossRate:          0.05,
	}

	pi, ingID, err := buildPurchaseItemAndApplyIngredient(db, item, testTx.ID, txTime)
	if err != nil {
		t.Fatalf("buildPurchaseItemAndApplyIngredient failed: %v", err)
	}
	defer db.Delete(pi)
	defer db.Delete(&models.Ingredient{}, ingID)

	if pi.TotalBaseQuantity != 2000 {
		t.Errorf("expected 2000 ml, got %v", pi.TotalBaseQuantity)
	}
	if pi.EffectiveBaseQuantity != 1900 {
		t.Errorf("expected 1900 ml, got %v", pi.EffectiveBaseQuantity)
	}
	if !strings.Contains(pi.ConversionSpec, "Chai") {
		t.Errorf("expected conversion spec to contain Chai, got %v", pi.ConversionSpec)
	}

	if err := recalculateIngredientPrices(db, ingID); err != nil {
		t.Fatalf("recalculateIngredientPrices failed: %v", err)
	}

	var updatedIng models.Ingredient
	if err := db.First(&updatedIng, ingID).Error; err != nil {
		t.Fatalf("failed to fetch updated ingredient: %v", err)
	}
	if updatedIng.LatestPurchasePrice <= 0 {
		t.Errorf("expected LatestPurchasePrice > 0, got %v", updatedIng.LatestPurchasePrice)
	}
}
