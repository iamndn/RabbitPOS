package services

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/gorm"
)

// StoreError is a business error carrying an HTTP status and API error code.
type StoreError struct {
	Status  int
	Code    string
	Message string
}

func (e *StoreError) Error() string { return e.Message }

func storeErr(status int, code, msg string) *StoreError {
	return &StoreError{Status: status, Code: code, Message: msg}
}

// StoreService implements multi-store lifecycle operations.
type StoreService struct {
	db *gorm.DB
}

func NewStoreService(db *gorm.DB) *StoreService { return &StoreService{db: db} }

// normalizeStoreFields applies defaults and validates enum-like fields on a Store.
func normalizeStoreFields(s *models.Store) error {
	s.Code = strings.ToLower(strings.TrimSpace(s.Code))
	s.Name = strings.TrimSpace(s.Name)
	if s.Name == "" {
		return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Store name is required")
	}
	if !models.StoreCodePattern.MatchString(s.Code) {
		return storeErr(http.StatusBadRequest, "STORE_CODE_INVALID", "Store code must be 2-49 chars: lowercase letters, digits, hyphen")
	}
	if s.BusinessType == "" {
		s.BusinessType = "fnb"
	}
	if !models.StoreBusinessTypes[s.BusinessType] {
		return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Invalid business_type")
	}
	if s.CurrencyCode == "" {
		s.CurrencyCode = "VND"
	}
	if s.CurrencySymbol == "" {
		s.CurrencySymbol = "đ"
	}
	if s.CurrencyPosition == "" {
		s.CurrencyPosition = "suffix"
	}
	if !models.CurrencyPositions[s.CurrencyPosition] {
		return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Invalid currency_position")
	}
	if s.Timezone == "" {
		s.Timezone = "Asia/Ho_Chi_Minh"
	}
	if _, err := time.LoadLocation(s.Timezone); err != nil {
		return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Invalid timezone")
	}
	return nil
}

// ValidateStoreFields is exported for the update path.
func ValidateStoreFields(s *models.Store) error { return normalizeStoreFields(s) }

// CodeTaken reports whether a store code is used by another store (case-insensitive).
func CodeTaken(tx *gorm.DB, code string, exceptID uint) (bool, error) {
	var n int64
	q := tx.Model(&models.Store{}).Where("LOWER(code) = ?", strings.ToLower(code))
	if exceptID != 0 {
		q = q.Where("id <> ?", exceptID)
	}
	if err := q.Count(&n).Error; err != nil {
		return false, err
	}
	return n > 0, nil
}

// CreateStore creates a store with defaults, membership and optional menu clone in one transaction.
func (s *StoreService) CreateStore(creatorID uint, req models.CreateStoreRequest) (*models.Store, error) {
	store := models.Store{
		Code: req.Code, Name: req.Name, BusinessType: req.BusinessType, LogoURL: req.LogoURL,
		Address: req.Address, Phone: req.Phone, CurrencyCode: req.CurrencyCode,
		CurrencySymbol: req.CurrencySymbol, CurrencyPosition: req.CurrencyPosition,
		VietQRBankID: req.VietQRBankID, VietQRAccountNo: req.VietQRAccountNo,
		VietQRAccountName: req.VietQRAccountName, Timezone: req.Timezone, IsActive: true,
	}
	if err := normalizeStoreFields(&store); err != nil {
		return nil, err
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		taken, err := CodeTaken(tx, store.Code, 0)
		if err != nil {
			return err
		}
		if taken {
			return storeErr(http.StatusConflict, "STORE_CODE_TAKEN", "Store code already in use")
		}
		if req.CloneFromStoreID != nil {
			var n int64
			if err := tx.Model(&models.Store{}).Where("id = ?", *req.CloneFromStoreID).Count(&n).Error; err != nil {
				return err
			}
			if n == 0 {
				return storeErr(http.StatusNotFound, "STORE_NOT_FOUND", "Clone source store not found")
			}
		}
		if err := tx.Create(&store).Error; err != nil {
			return err
		}
		if err := database.SeedStoreDefaults(tx, store.ID); err != nil {
			return err
		}

		// Members: the creator is always store_admin; explicit entries override.
		members := map[uint]models.StoreMemberInput{
			creatorID: {UserID: creatorID, Role: models.StoreRoleStoreAdmin},
		}
		for _, m := range req.Members {
			if !m.Role.IsAssignable() {
				return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Invalid member role")
			}
			members[m.UserID] = m
		}
		for _, m := range members {
			if err := s.upsertMember(tx, store.ID, m); err != nil {
				return err
			}
		}

		if req.CloneFromStoreID != nil {
			if err := CloneMenu(tx, *req.CloneFromStoreID, store.ID, req.CloneOptions); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &store, nil
}

// upsertMember adds or updates a membership; a default flag clears other defaults of the user.
// If the user has no default yet, this membership becomes the default.
func (s *StoreService) upsertMember(tx *gorm.DB, storeID uint, m models.StoreMemberInput) error {
	var u models.User
	if err := tx.Select("id").First(&u, m.UserID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return storeErr(http.StatusNotFound, "USER_NOT_FOUND", "User not found")
		}
		return err
	}
	var defaults int64
	if err := tx.Model(&models.UserStore{}).
		Where("user_id = ? AND is_default = TRUE AND store_id <> ?", m.UserID, storeID).
		Count(&defaults).Error; err != nil {
		return err
	}
	isDefault := m.IsDefault || defaults == 0
	if isDefault {
		if err := tx.Model(&models.UserStore{}).
			Where("user_id = ? AND store_id <> ?", m.UserID, storeID).
			Update("is_default", false).Error; err != nil {
			return err
		}
	}
	var existing models.UserStore
	err := tx.Where("user_id = ? AND store_id = ?", m.UserID, storeID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return tx.Create(&models.UserStore{UserID: m.UserID, StoreID: storeID, Role: m.Role, IsDefault: isDefault}).Error
	}
	if err != nil {
		return err
	}
	updates := map[string]interface{}{"role": m.Role}
	if isDefault {
		updates["is_default"] = true
	}
	return tx.Model(&models.UserStore{}).Where("user_id = ? AND store_id = ?", m.UserID, storeID).Updates(updates).Error
}

// UpsertMember is the transactional public wrapper.
func (s *StoreService) UpsertMember(storeID uint, m models.StoreMemberInput) error {
	if !m.Role.IsAssignable() {
		return storeErr(http.StatusBadRequest, "VALIDATION_ERROR", "Invalid member role")
	}
	return s.db.Transaction(func(tx *gorm.DB) error { return s.upsertMember(tx, storeID, m) })
}

// RemoveMember deletes a membership and promotes another one to default when needed.
func (s *StoreService) RemoveMember(storeID, userID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var us models.UserStore
		if err := tx.Where("user_id = ? AND store_id = ?", userID, storeID).First(&us).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return storeErr(http.StatusNotFound, "MEMBER_NOT_FOUND", "Membership not found")
			}
			return err
		}
		if err := tx.Where("user_id = ? AND store_id = ?", userID, storeID).Delete(&models.UserStore{}).Error; err != nil {
			return err
		}
		if us.IsDefault {
			var next models.UserStore
			if err := tx.Where("user_id = ?", userID).Order("created_at ASC, store_id ASC").First(&next).Error; err == nil {
				return tx.Model(&models.UserStore{}).
					Where("user_id = ? AND store_id = ?", userID, next.StoreID).
					Update("is_default", true).Error
			}
		}
		return nil
	})
}

// remapJSONIDs rewrites a JSON array of ids using the mapping; unmapped ids are dropped.
func remapJSONIDs(raw string, m map[uint]uint) string {
	if raw == "" || raw == "null" {
		return "[]"
	}
	var ids []uint
	if err := json.Unmarshal([]byte(raw), &ids); err != nil {
		return "[]"
	}
	out := make([]uint, 0, len(ids))
	for _, id := range ids {
		if n, ok := m[id]; ok {
			out = append(out, n)
		}
	}
	b, _ := json.Marshal(out)
	return string(b)
}

// CloneMenu copies catalog data from srcID to dstID inside tx, remapping all ids.
// Never copies funds, orders, transactions or settings. Ingredient purchase prices are reset to 0.
func CloneMenu(tx *gorm.DB, srcID, dstID uint, opts models.CloneMenuOptions) error {
	// Dependencies: products need categories, variants need products, recipes need variants/toppings.
	if opts.Recipes {
		opts.Variants = opts.Variants || opts.Products
		opts.Toppings = true
	}
	if opts.Variants {
		opts.Products = true
	}
	if opts.Products {
		opts.Categories = true
	}

	catMap := map[uint]uint{}
	prodMap := map[uint]uint{}
	varMap := map[uint]uint{}
	topMap := map[uint]uint{}

	if opts.Categories {
		var cats []models.Category
		if err := tx.Where("store_id = ?", srcID).Order("id").Find(&cats).Error; err != nil {
			return err
		}
		for _, c := range cats {
			oldID := c.ID
			c.ID, c.StoreID = 0, dstID
			c.CreatedAt, c.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&c).Error; err != nil {
				return err
			}
			catMap[oldID] = c.ID
		}
	}

	if opts.Products {
		var prods []models.Product
		if err := tx.Where("store_id = ?", srcID).Order("id").Find(&prods).Error; err != nil {
			return err
		}
		for _, p := range prods {
			newCat, ok := catMap[p.CategoryID]
			if !ok {
				continue
			}
			oldID := p.ID
			p.ID, p.StoreID, p.CategoryID = 0, dstID, newCat
			p.Category, p.Variants, p.VariantGroups = nil, nil, nil
			p.CreatedAt, p.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&p).Error; err != nil {
				return err
			}
			prodMap[oldID] = p.ID

			var groups []models.VariantGroup
			if err := tx.Where("product_id = ?", oldID).Order("id").Find(&groups).Error; err != nil {
				return err
			}
			for _, g := range groups {
				g.ID, g.ProductID = 0, p.ID
				g.CreatedAt, g.UpdatedAt = time.Time{}, time.Time{}
				if err := tx.Create(&g).Error; err != nil {
					return err
				}
			}
			if opts.Variants {
				var vars []models.ProductVariant
				if err := tx.Where("product_id = ?", oldID).Order("id").Find(&vars).Error; err != nil {
					return err
				}
				for _, v := range vars {
					oldV := v.ID
					v.ID, v.ProductID, v.Product = 0, p.ID, nil
					v.CreatedAt, v.UpdatedAt = time.Time{}, time.Time{}
					if err := tx.Create(&v).Error; err != nil {
						return err
					}
					varMap[oldV] = v.ID
				}
			}
		}
	}

	if opts.Toppings {
		var tops []models.Topping
		if err := tx.Where("store_id = ?", srcID).Order("id").Find(&tops).Error; err != nil {
			return err
		}
		for _, t := range tops {
			oldID := t.ID
			if t.CategoryID != nil {
				if n, ok := catMap[*t.CategoryID]; ok {
					nn := n
					t.CategoryID = &nn
				} else {
					t.CategoryID = nil
				}
			}
			t.ID, t.StoreID, t.Category = 0, dstID, nil
			t.CreatedAt, t.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&t).Error; err != nil {
				return err
			}
			topMap[oldID] = t.ID
		}
	}

	if opts.Promotions {
		var promos []models.Promotion
		if err := tx.Where("store_id = ?", srcID).Order("id").Find(&promos).Error; err != nil {
			return err
		}
		for _, p := range promos {
			switch p.Scope {
			case models.PromoScopeCategory:
				p.TargetIDs = remapJSONIDs(p.TargetIDs, catMap)
			case models.PromoScopeProduct:
				p.TargetIDs = remapJSONIDs(p.TargetIDs, prodMap)
			}
			if p.GiftProductVariantID != nil {
				if n, ok := varMap[*p.GiftProductVariantID]; ok {
					nn := n
					p.GiftProductVariantID = &nn
				} else {
					p.GiftProductVariantID = nil
				}
			}
			p.GiftTargetIDs = remapJSONIDs(p.GiftTargetIDs, varMap)
			p.ID, p.StoreID, p.GiftVariant, p.UsageCount = 0, dstID, nil, 0
			p.CreatedAt, p.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&p).Error; err != nil {
				return err
			}
		}
	}

	if opts.Recipes {
		var ings []models.Ingredient
		if err := tx.Where("store_id = ?", srcID).Order("id").Find(&ings).Error; err != nil {
			return err
		}
		ingMap := map[uint]uint{}
		for _, ing := range ings {
			oldID := ing.ID
			ing.ID, ing.StoreID = 0, dstID
			ing.LatestPurchasePrice, ing.AveragePurchasePrice = 0, 0
			ing.CreatedAt, ing.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&ing).Error; err != nil {
				return err
			}
			ingMap[oldID] = ing.ID
		}
		var items []models.RecipeItem
		if err := tx.Joins("JOIN ingredients ON ingredients.id = recipe_items.ingredient_id").
			Where("ingredients.store_id = ?", srcID).Order("recipe_items.id").Find(&items).Error; err != nil {
			return err
		}
		for _, it := range items {
			newIng, ok := ingMap[it.IngredientID]
			if !ok {
				continue
			}
			if it.ProductVariantID != nil {
				n, ok := varMap[*it.ProductVariantID]
				if !ok {
					continue
				}
				it.ProductVariantID = &n
			}
			if it.ToppingID != nil {
				n, ok := topMap[*it.ToppingID]
				if !ok {
					continue
				}
				it.ToppingID = &n
			}
			if it.ProductVariantID == nil && it.ToppingID == nil {
				continue
			}
			it.ID, it.IngredientID = 0, newIng
			it.ProductVariant, it.Topping, it.Ingredient = nil, nil, nil
			it.CreatedAt, it.UpdatedAt = time.Time{}, time.Time{}
			if err := tx.Create(&it).Error; err != nil {
				return err
			}
		}
	}
	return nil
}
