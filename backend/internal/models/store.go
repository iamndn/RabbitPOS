package models

import (
	"regexp"
	"time"
)

// StoreCodePattern mirrors the chk_stores_code CHECK constraint (lowercase slug, 2-49 chars).
var StoreCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,48}$`)

// StoreRole is the authority level of a user inside one store.
// Ordering: staff < store_admin < super_admin.
type StoreRole string

const (
	StoreRoleStaff      StoreRole = "staff"
	StoreRoleStoreAdmin StoreRole = "store_admin"
	StoreRoleSuperAdmin StoreRole = "super_admin"
)

// Rank returns a comparable privilege level (higher = more privileged); unknown roles rank 0.
func (r StoreRole) Rank() int {
	switch r {
	case StoreRoleSuperAdmin:
		return 3
	case StoreRoleStoreAdmin:
		return 2
	case StoreRoleStaff:
		return 1
	default:
		return 0
	}
}

// AtLeast reports whether r grants at least the privileges of min.
func (r StoreRole) AtLeast(min StoreRole) bool {
	return r.Rank() >= min.Rank() && r.Rank() > 0
}

// IsAssignable reports whether the role can be stored in user_stores.
func (r StoreRole) IsAssignable() bool {
	return r == StoreRoleStaff || r == StoreRoleStoreAdmin
}

// Allowed values for stores.business_type and stores.currency_position.
var (
	StoreBusinessTypes = map[string]bool{"fnb": true, "cafe": true, "retail": true, "bakery": true, "other": true}
	CurrencyPositions  = map[string]bool{"prefix": true, "suffix": true}
)

// Store is one independent business location (tenant).
type Store struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	Code              string    `gorm:"type:varchar(50);not null" json:"code"`
	Name              string    `gorm:"type:varchar(150);not null" json:"name"`
	BusinessType      string    `gorm:"type:varchar(30);not null;default:'fnb'" json:"business_type"`
	LogoURL           string    `gorm:"type:text;not null;default:''" json:"logo_url"`
	Address           string    `gorm:"type:text;not null;default:''" json:"address"`
	Phone             string    `gorm:"type:varchar(30);not null;default:''" json:"phone"`
	CurrencyCode      string    `gorm:"type:varchar(10);not null;default:'VND'" json:"currency_code"`
	CurrencySymbol    string    `gorm:"type:varchar(10);not null;default:'đ'" json:"currency_symbol"`
	CurrencyPosition  string    `gorm:"type:varchar(10);not null;default:'suffix'" json:"currency_position"`
	VietQRBankID      string    `gorm:"column:vietqr_bank_id;type:varchar(30);not null;default:''" json:"vietqr_bank_id"`
	VietQRAccountNo   string    `gorm:"column:vietqr_account_no;type:varchar(50);not null;default:''" json:"vietqr_account_no"`
	VietQRAccountName string    `gorm:"column:vietqr_account_name;type:varchar(150);not null;default:''" json:"vietqr_account_name"`
	Timezone          string    `gorm:"type:varchar(50);not null;default:'Asia/Ho_Chi_Minh'" json:"timezone"`
	IsActive          bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// UserStore grants a user a role inside one store.
type UserStore struct {
	UserID    uint      `gorm:"primaryKey;autoIncrement:false" json:"user_id"`
	StoreID   uint      `gorm:"primaryKey;autoIncrement:false;index:idx_user_stores_store" json:"store_id"`
	Role      StoreRole `gorm:"type:varchar(20);not null;default:'staff'" json:"role"`
	IsDefault bool      `gorm:"not null;default:false" json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
}

// StoreSetting is a per-store key/value configuration entry.
type StoreSetting struct {
	StoreID   uint      `gorm:"primaryKey;autoIncrement:false" json:"store_id"`
	Key       string    `gorm:"primaryKey;type:varchar(100)" json:"key"`
	Value     string    `gorm:"type:text;not null;default:''" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// --- DTOs ---

// StoreResponse is a store plus the caller's effective access to it.
type StoreResponse struct {
	Store
	Role        StoreRole `json:"role"`
	IsDefault   bool      `json:"is_default"`
	MemberCount int64     `json:"member_count"`
}

// CloneMenuOptions selects which catalog parts are copied into a new store.
type CloneMenuOptions struct {
	Categories bool `json:"categories"`
	Products   bool `json:"products"`
	Variants   bool `json:"variants"`
	Toppings   bool `json:"toppings"`
	Promotions bool `json:"promotions"`
	Recipes    bool `json:"recipes"`
}

// StoreMemberInput assigns a user to a store.
type StoreMemberInput struct {
	UserID    uint      `json:"user_id" binding:"required"`
	Role      StoreRole `json:"role" binding:"required"`
	IsDefault bool      `json:"is_default"`
}

// CreateStoreRequest is the payload of POST /api/v1/stores.
type CreateStoreRequest struct {
	Code              string             `json:"code" binding:"required"`
	Name              string             `json:"name" binding:"required,max=150"`
	BusinessType      string             `json:"business_type"`
	LogoURL           string             `json:"logo_url"`
	Address           string             `json:"address"`
	Phone             string             `json:"phone"`
	CurrencyCode      string             `json:"currency_code"`
	CurrencySymbol    string             `json:"currency_symbol"`
	CurrencyPosition  string             `json:"currency_position"`
	VietQRBankID      string             `json:"vietqr_bank_id"`
	VietQRAccountNo   string             `json:"vietqr_account_no"`
	VietQRAccountName string             `json:"vietqr_account_name"`
	Timezone          string             `json:"timezone"`
	CloneFromStoreID  *uint              `json:"clone_from_store_id"`
	CloneOptions      CloneMenuOptions   `json:"clone_options"`
	Members           []StoreMemberInput `json:"members"`
}

// UpdateStoreRequest is the payload of PUT /api/v1/stores/:id (all fields optional).
type UpdateStoreRequest struct {
	Code              *string `json:"code"`
	Name              *string `json:"name"`
	BusinessType      *string `json:"business_type"`
	LogoURL           *string `json:"logo_url"`
	Address           *string `json:"address"`
	Phone             *string `json:"phone"`
	CurrencyCode      *string `json:"currency_code"`
	CurrencySymbol    *string `json:"currency_symbol"`
	CurrencyPosition  *string `json:"currency_position"`
	VietQRBankID      *string `json:"vietqr_bank_id"`
	VietQRAccountNo   *string `json:"vietqr_account_no"`
	VietQRAccountName *string `json:"vietqr_account_name"`
	Timezone          *string `json:"timezone"`
	IsActive          *bool   `json:"is_active"`
}

// StoreMemberResponse is one membership row joined with the user.
type StoreMemberResponse struct {
	UserID             uint      `json:"user_id"`
	Username           string    `json:"username"`
	Email              string    `json:"email"`
	GlobalRole         UserRole  `json:"global_role"`
	IsActive           bool      `json:"is_active"`
	NeedsPasswordSetup bool      `json:"needs_password_setup"`
	Role               StoreRole `json:"role"`
	IsDefault          bool      `json:"is_default"`
}

// CreateUserRequest is the payload of POST /api/v1/users.
// Role "super_admin" creates a platform owner; "store_admin"/"staff" create a store-level user
// whose authority comes only from the listed memberships.
type CreateUserRequest struct {
	Username     string           `json:"username" binding:"required,min=3,max=50"`
	FullName     string           `json:"full_name"`
	Email        string           `json:"email"`
	TempPassword string           `json:"temp_password" binding:"required,min=6"`
	Role         StoreRole        `json:"role" binding:"required"`
	Memberships  []UserMembership `json:"memberships"`
}

// UserMembership is a (store, role) pair used when creating a user.
type UserMembership struct {
	StoreID   uint      `json:"store_id" binding:"required"`
	Role      StoreRole `json:"role" binding:"required"`
	IsDefault bool      `json:"is_default"`
}

// UserListItem is one row of GET /api/v1/users.
type UserListItem struct {
	ID                 uint             `json:"id"`
	Username           string           `json:"username"`
	Email              string           `json:"email"`
	Role               UserRole         `json:"role"`
	IsActive           bool             `json:"is_active"`
	NeedsPasswordSetup bool             `json:"needs_password_setup"`
	Memberships        []UserMembership `json:"memberships"`
}
