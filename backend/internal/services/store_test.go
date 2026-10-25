package services

import (
	"encoding/json"
	"testing"

	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"gorm.io/gorm"
)

func TestSeedStoreDefaults_Idempotent(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	if _, err := testutils.SeedMinimalFixtures(db); err != nil {
		t.Fatal(err)
	}
	st := models.Store{Code: "seed-test", Name: "Seed Test", IsActive: true}
	if err := db.Create(&st).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := database.SeedStoreDefaults(db, st.ID); err != nil {
			t.Fatalf("seed #%d: %v", i, err)
		}
	}
	var funds []models.Fund
	db.Where("store_id = ?", st.ID).Order("id").Find(&funds)
	if len(funds) != 2 || funds[0].Name != "Tiền mặt" || funds[0].FundType != models.FundTypeCash ||
		funds[1].Name != "Chuyển khoản" || funds[1].FundType != models.FundTypeBank {
		t.Fatalf("unexpected default funds: %+v", funds)
	}
	var cats, settings int64
	db.Model(&models.TransactionCategoryItem{}).Where("store_id = ?", st.ID).Count(&cats)
	db.Model(&models.StoreSetting{}).Where("store_id = ?", st.ID).Count(&settings)
	if cats == 0 || settings == 0 {
		t.Errorf("expected tx categories and settings, got %d/%d", cats, settings)
	}
}

func TestCloneMenu_RemapsIDs(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	fx, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatal(err)
	}
	// Source graph: promotion targeting category + gift variant, recipe for variant and topping.
	targets, _ := json.Marshal([]uint{fx.Category.ID})
	gifts, _ := json.Marshal([]uint{fx.Variant.ID})
	gv := fx.Variant.ID
	promo := models.Promotion{Name: "Promo", PromoType: models.PromoType("percentage"), Scope: models.PromoScopeCategory,
		TargetIDs: string(targets), GiftProductVariantID: &gv, GiftTargetIDs: string(gifts), UsageCount: 7, IsActive: true}
	if err := db.Create(&promo).Error; err != nil {
		t.Fatal(err)
	}
	vid, tid := fx.Variant.ID, fx.Topping.ID
	db.Create(&models.RecipeItem{ProductVariantID: &vid, IngredientID: fx.Ingredient.ID, UsageQuantity: 18})
	db.Create(&models.RecipeItem{ToppingID: &tid, IngredientID: fx.Ingredient.ID, UsageQuantity: 5})
	db.Create(&models.VariantGroup{ProductID: fx.Product.ID, GroupName: "Size", SelectionType: "single"})

	dst := models.Store{Code: "clone-dst", Name: "Clone Dst", IsActive: true}
	if err := db.Create(&dst).Error; err != nil {
		t.Fatal(err)
	}
	opts := models.CloneMenuOptions{Categories: true, Products: true, Variants: true, Toppings: true, Promotions: true, Recipes: true}
	if err := db.Transaction(func(tx *gorm.DB) error { return CloneMenu(tx, 1, dst.ID, opts) }); err != nil {
		t.Fatalf("CloneMenu: %v", err)
	}

	var cat models.Category
	if err := db.Where("store_id = ?", dst.ID).First(&cat).Error; err != nil || cat.ID == fx.Category.ID {
		t.Fatalf("category not cloned with new id: %v", err)
	}
	var prod models.Product
	db.Where("store_id = ?", dst.ID).First(&prod)
	if prod.CategoryID != cat.ID {
		t.Errorf("product category not remapped: %d vs %d", prod.CategoryID, cat.ID)
	}
	var v models.ProductVariant
	db.Where("product_id = ?", prod.ID).First(&v)
	if v.ID == 0 || v.ID == fx.Variant.ID || v.RetailPrice != 25000 {
		t.Errorf("variant not cloned properly: %+v", v)
	}
	var groups int64
	db.Model(&models.VariantGroup{}).Where("product_id = ?", prod.ID).Count(&groups)
	if groups != 1 {
		t.Errorf("variant group not cloned")
	}
	var top models.Topping
	db.Where("store_id = ?", dst.ID).First(&top)
	if top.CategoryID == nil || *top.CategoryID != cat.ID {
		t.Errorf("topping category not remapped: %+v", top.CategoryID)
	}
	var p2 models.Promotion
	db.Where("store_id = ?", dst.ID).First(&p2)
	if p2.UsageCount != 0 || p2.GiftProductVariantID == nil || *p2.GiftProductVariantID != v.ID {
		t.Errorf("promotion gift/usage wrong: %+v", p2)
	}
	if ids := p2.GetTargetIDs(); len(ids) != 1 || ids[0] != cat.ID {
		t.Errorf("promotion target ids not remapped: %v", ids)
	}
	var ing models.Ingredient
	db.Where("store_id = ?", dst.ID).First(&ing)
	if ing.ID == fx.Ingredient.ID || ing.LatestPurchasePrice != 0 || ing.AveragePurchasePrice != 0 {
		t.Errorf("ingredient not cloned with zero prices: %+v", ing)
	}
	var items []models.RecipeItem
	db.Where("ingredient_id = ?", ing.ID).Find(&items)
	if len(items) != 2 {
		t.Fatalf("expected 2 cloned recipe items, got %d", len(items))
	}
	for _, it := range items {
		if it.ProductVariantID != nil && *it.ProductVariantID != v.ID {
			t.Errorf("recipe variant not remapped")
		}
		if it.ToppingID != nil && *it.ToppingID != top.ID {
			t.Errorf("recipe topping not remapped")
		}
	}
	// Source store untouched; funds never cloned.
	var srcCats, dstFunds int64
	db.Model(&models.Category{}).Where("store_id = 1").Count(&srcCats)
	db.Model(&models.Fund{}).Where("store_id = ?", dst.ID).Count(&dstFunds)
	if srcCats != 1 || dstFunds != 0 {
		t.Errorf("source changed or funds cloned: %d %d", srcCats, dstFunds)
	}
}

func TestCreateStore_TransactionalAndValidated(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	fx, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatal(err)
	}
	svc := NewStoreService(db)
	src := uint(1)
	st, err := svc.CreateStore(fx.AdminUser.ID, models.RoleMaster, models.CreateStoreRequest{
		Code: "Bakery-01", Name: "Bakery", CloneFromStoreID: &src,
		CloneOptions: models.CloneMenuOptions{Categories: true},
		Members:      []models.StoreMemberInput{{UserID: fx.StaffUser.ID, Role: models.StoreRoleStaff}},
	})
	if err != nil {
		t.Fatalf("CreateStore: %v", err)
	}
	if st.Code != "bakery-01" {
		t.Errorf("code not lowercased: %s", st.Code)
	}
	var members int64
	db.Model(&models.UserStore{}).Where("store_id = ?", st.ID).Count(&members)
	if members != 2 {
		t.Errorf("expected 2 members, got %d", members)
	}

	// Duplicate code (case-insensitive) -> STORE_CODE_TAKEN, nothing persisted.
	_, err = svc.CreateStore(fx.AdminUser.ID, models.RoleMaster, models.CreateStoreRequest{Code: "BAKERY-01", Name: "Dup"})
	if se, ok := err.(*StoreError); !ok || se.Code != "STORE_CODE_TAKEN" {
		t.Errorf("expected STORE_CODE_TAKEN, got %v", err)
	}
	// Bad member -> whole transaction rolls back.
	_, err = svc.CreateStore(fx.AdminUser.ID, models.RoleMaster, models.CreateStoreRequest{
		Code: "rollback-me", Name: "RB", Members: []models.StoreMemberInput{{UserID: 999999, Role: models.StoreRoleStaff}}})
	if err == nil {
		t.Fatal("expected error for unknown member")
	}
	var n int64
	db.Model(&models.Store{}).Where("code = ?", "rollback-me").Count(&n)
	if n != 0 {
		t.Errorf("store persisted despite failed transaction")
	}
}
