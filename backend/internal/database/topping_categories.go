package database

import (
	"sort"

	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
)

// FillToppingCategoryIDs populates Topping.CategoryIDs for every topping in the slice.
// Toppings without join rows fall back to their legacy CategoryID (nil = global / empty scope).
func FillToppingCategoryIDs(db *gorm.DB, toppings []models.Topping) error {
	if len(toppings) == 0 {
		return nil
	}
	ids := make([]uint, 0, len(toppings))
	for _, t := range toppings {
		ids = append(ids, t.ID)
	}
	var rows []models.ToppingCategory
	if err := db.Where("topping_id IN ?", ids).Order("category_id asc").Find(&rows).Error; err != nil {
		return err
	}
	byTopping := make(map[uint][]uint, len(toppings))
	for _, r := range rows {
		byTopping[r.ToppingID] = append(byTopping[r.ToppingID], r.CategoryID)
	}
	for i := range toppings {
		if linked, ok := byTopping[toppings[i].ID]; ok {
			toppings[i].CategoryIDs = linked
		} else if toppings[i].CategoryID != nil {
			toppings[i].CategoryIDs = []uint{*toppings[i].CategoryID}
		} else {
			toppings[i].CategoryIDs = []uint{}
		}
	}
	return nil
}

// SyncToppingCategories replaces the category scope of a topping with categoryIDs and keeps the
// legacy toppings.category_id column mirrored to the first (lowest) category id (NULL when global).
// The caller must have validated that every category belongs to the topping's store.
func SyncToppingCategories(tx *gorm.DB, toppingID uint, categoryIDs []uint) error {
	sorted := append([]uint(nil), categoryIDs...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

	if err := tx.Where("topping_id = ?", toppingID).Delete(&models.ToppingCategory{}).Error; err != nil {
		return err
	}
	for _, cid := range sorted {
		if err := tx.Create(&models.ToppingCategory{ToppingID: toppingID, CategoryID: cid}).Error; err != nil {
			return err
		}
	}

	var mirror interface{}
	if len(sorted) > 0 {
		mirror = sorted[0]
	}
	return tx.Model(&models.Topping{}).Where("id = ?", toppingID).UpdateColumn("category_id", mirror).Error
}

// DeleteToppingCategories removes every join row of the given topping.
func DeleteToppingCategories(tx *gorm.DB, toppingID uint) error {
	return tx.Where("topping_id = ?", toppingID).Delete(&models.ToppingCategory{}).Error
}

// DetachCategoryFromToppings must run before a category is deleted. It removes the category from
// every topping scope, deletes toppings that were scoped ONLY to it (mirroring the previous
// ON DELETE CASCADE behaviour) and re-points the legacy category_id mirror of the remaining ones
// so they survive the category's cascade.
func DetachCategoryFromToppings(tx *gorm.DB, storeID, categoryID uint) error {
	var affected []uint
	if err := tx.Model(&models.ToppingCategory{}).
		Where("category_id = ?", categoryID).
		Pluck("topping_id", &affected).Error; err != nil {
		return err
	}
	if err := tx.Where("category_id = ?", categoryID).Delete(&models.ToppingCategory{}).Error; err != nil {
		return err
	}
	for _, tid := range affected {
		var remaining []uint
		if err := tx.Model(&models.ToppingCategory{}).
			Where("topping_id = ?", tid).Order("category_id asc").
			Pluck("category_id", &remaining).Error; err != nil {
			return err
		}
		if len(remaining) == 0 {
			if err := tx.Where("id = ? AND store_id = ?", tid, storeID).Delete(&models.Topping{}).Error; err != nil {
				return err
			}
			continue
		}
		if err := tx.Model(&models.Topping{}).Where("id = ?", tid).
			UpdateColumn("category_id", remaining[0]).Error; err != nil {
			return err
		}
	}
	return nil
}

// ToppingAvailableForCategoryScope narrows a toppings query to those usable for a product in
// categoryID: global toppings (no scope) plus toppings linked to that category.
func ToppingAvailableForCategoryScope(db *gorm.DB, categoryID uint) *gorm.DB {
	return db.Where(
		"(toppings.category_id IS NULL AND NOT EXISTS (SELECT 1 FROM topping_categories tc WHERE tc.topping_id = toppings.id))"+
			" OR EXISTS (SELECT 1 FROM topping_categories tc WHERE tc.topping_id = toppings.id AND tc.category_id = ?)"+
			" OR toppings.category_id = ?",
		categoryID, categoryID,
	)
}
