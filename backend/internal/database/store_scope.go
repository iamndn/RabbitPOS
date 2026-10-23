package database

import (
	"errors"
	"fmt"
	"reflect"
	"sync/atomic"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	// ErrStoreIDRequired is returned (in strict mode) when a tenant-scoped row is created without a store.
	ErrStoreIDRequired = errors.New("store_id is required to create a tenant-scoped record")
	// ErrNotInStore is returned when a record does not exist inside the requested store.
	// It deliberately does not reveal whether the record exists in another store.
	ErrNotInStore = errors.New("record not found in this store")
)

// strictStoreCreate toggles the fail-closed create callback.
// Phase 1 keeps it off because legacy handlers rely on the transitional DB default (store_id = 1);
// Phase 2 turns it on once every handler assigns StoreID explicitly.
var strictStoreCreate atomic.Bool

// SetStrictStoreCreate enables or disables the fail-closed create callback.
func SetStrictStoreCreate(enabled bool) { strictStoreCreate.Store(enabled) }

// ScopeByStore restricts a query or mutation to one tenant.
// clause.CurrentTable avoids ambiguous-column errors when the query contains joins.
func ScopeByStore(storeID uint) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return db.Where(clause.Eq{
			Column: clause.Column{Table: clause.CurrentTable, Name: "store_id"},
			Value:  storeID,
		})
	}
}

// RegisterStoreScopeCallbacks installs the fail-closed create callback: when strict mode is on,
// creating a model that has a non-pointer StoreID field left at zero fails instead of silently
// landing in the wrong (default) store. Pointer fields (audit logs, idempotency) are optional by design.
func RegisterStoreScopeCallbacks(db *gorm.DB) error {
	return db.Callback().Create().Before("gorm:create").Register("rabbitpos:require_store_id", requireStoreIDOnCreate)
}

func requireStoreIDOnCreate(tx *gorm.DB) {
	if tx.Error != nil || !strictStoreCreate.Load() || tx.Statement.Schema == nil {
		return
	}
	field := tx.Statement.Schema.LookUpField("StoreID")
	if field == nil || field.FieldType.Kind() == reflect.Ptr {
		return
	}

	rv := tx.Statement.ReflectValue
	switch rv.Kind() {
	case reflect.Slice, reflect.Array:
		for i := 0; i < rv.Len(); i++ {
			if _, isZero := field.ValueOf(tx.Statement.Context, reflect.Indirect(rv.Index(i))); isZero {
				_ = tx.AddError(fmt.Errorf("%w (%s)", ErrStoreIDRequired, tx.Statement.Schema.Table))
				return
			}
		}
	case reflect.Struct:
		if _, isZero := field.ValueOf(tx.Statement.Context, rv); isZero {
			_ = tx.AddError(fmt.Errorf("%w (%s)", ErrStoreIDRequired, tx.Statement.Schema.Table))
		}
	}
}

// AssertOwned verifies that a root record (a model with a store_id column) belongs to storeID.
// Use it before mutating or referencing a record that arrived as a bare ID in a request.
func AssertOwned(db *gorm.DB, model interface{}, id uint, storeID uint) error {
	return AssertOwnedIDs(db, model, []uint{id}, storeID)
}

// AssertOwnedIDs verifies that every distinct id in ids belongs to storeID.
func AssertOwnedIDs(db *gorm.DB, model interface{}, ids []uint, storeID uint) error {
	unique := make(map[uint]struct{}, len(ids))
	for _, id := range ids {
		unique[id] = struct{}{}
	}
	if len(unique) == 0 {
		return nil
	}
	list := make([]uint, 0, len(unique))
	for id := range unique {
		list = append(list, id)
	}

	var count int64
	if err := db.Model(model).Scopes(ScopeByStore(storeID)).Where("id IN ?", list).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(list) {
		return ErrNotInStore
	}
	return nil
}

// AssertVariantOwned verifies a product variant through its parent product (variants carry no store_id).
func AssertVariantOwned(db *gorm.DB, variantID uint, storeID uint) error {
	var count int64
	err := db.Table("product_variants").
		Joins("JOIN products ON products.id = product_variants.product_id").
		Where("product_variants.id = ? AND products.store_id = ?", variantID, storeID).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return ErrNotInStore
	}
	return nil
}
