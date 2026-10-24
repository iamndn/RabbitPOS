package models

import (
	"time"
)

type UserRole string

const (
	// 3-tier production hierarchy:
	RoleMaster UserRole = "master"
	RoleOwner  UserRole = "owner"
	RoleStaff  UserRole = "staff"

	// Legacy & Multi-store Aliases
	RoleSuperAdmin UserRole = "super_admin" // alias for master
	RoleAdmin      UserRole = "admin"       // legacy alias for master
)

// Rank returns numerical privilege level: master (3) > owner (2) > staff (1)
func (r UserRole) Rank() int {
	switch r {
	case RoleMaster, RoleSuperAdmin, RoleAdmin:
		return 3
	case RoleOwner, "store_admin":
		return 2
	case RoleStaff, "cashier":
		return 1
	default:
		return 0
	}
}

// IsMaster reports whether the role is a platform-level master / super admin
func (r UserRole) IsMaster() bool {
	return r.Rank() >= 3
}

// IsSuperAdmin reports whether the role grants platform-wide authority (legacy alias)
func (r UserRole) IsSuperAdmin() bool {
	return r.Rank() >= 3
}

// IsOwner reports whether the role is a store owner or manager
func (r UserRole) IsOwner() bool {
	return r.Rank() >= 2
}

// AtLeast reports whether r grants at least the privileges of min
func (r UserRole) AtLeast(min UserRole) bool {
	return r.Rank() >= min.Rank() && r.Rank() > 0
}

// User represents a system operator, manager, or cashier in RabbitPOS
type User struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	Username           string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	FullName           string    `gorm:"type:varchar(150);not null;default:''" json:"full_name"`
	Phone              string    `gorm:"type:varchar(30);default:''" json:"phone"`
	PasswordHash       string    `gorm:"type:varchar(255);not null" json:"-"`
	PinCode            *string   `gorm:"type:varchar(60)" json:"-"` // Hashed 4-6 digit quick PIN, never leaked
	Email              string    `gorm:"type:varchar(150);not null;default:''" json:"email"`
	Role               UserRole  `gorm:"type:varchar(20);not null;default:'staff'" json:"role"`
	IsActive           bool      `gorm:"default:true;not null" json:"is_active"`
	NeedsPasswordSetup bool      `gorm:"default:true;not null" json:"needs_password_setup"`
	TokenVersion       int       `gorm:"default:1;not null" json:"token_version"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// Request & Response DTOs

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// SetupPasswordRequest is used for first-time password setup after initial login
type SetupPasswordRequest struct {
	Username    string `json:"username" binding:"required"`
	TempToken   string `json:"temp_token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type UserResponse struct {
	ID                 uint            `json:"id"`
	Username           string          `json:"username"`
	FullName           string          `json:"full_name"`
	Phone              string          `json:"phone"`
	Email              string          `json:"email"`
	Role               UserRole        `json:"role"`
	IsActive           bool            `json:"is_active"`
	HasPin             bool            `json:"has_pin"`
	NeedsPasswordSetup bool            `json:"needs_password_setup"`
	Stores             []StoreResponse `json:"stores,omitempty"`
	DefaultStoreID     *uint           `json:"default_store_id,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

type LoginResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

// NeedsSetupResponse is returned when user must complete first-time password setup
type NeedsSetupResponse struct {
	Username  string `json:"username"`
	TempToken string `json:"temp_token"`
}

// CreateUserDTO is used for creating a new user account
type CreateUserDTO struct {
	Username     string           `json:"username" binding:"required,min=3,max=50"`
	FullName     string           `json:"full_name"`
	Phone        string           `json:"phone"`
	Email        string           `json:"email"`
	Password     string           `json:"password"`
	TempPassword string           `json:"temp_password"`
	PinCode      string           `json:"pin_code"`
	Role         UserRole         `json:"role" binding:"required"`
	IsActive     *bool            `json:"is_active"`
	Memberships  []UserMembership `json:"memberships"`
}

// UpdateUserDTO is used for updating existing user details
type UpdateUserDTO struct {
	FullName string    `json:"full_name"`
	Phone    string    `json:"phone"`
	Email    string    `json:"email"`
	Role     *UserRole `json:"role"`
	IsActive *bool     `json:"is_active"`
	Password string    `json:"password"`
	PinCode  *string   `json:"pin_code"`
}

// ToggleStatusDTO for quick status active/inactive toggle
type ToggleStatusDTO struct {
	IsActive *bool `json:"is_active"`
}

// ResetPasswordDTO for password reset
type ResetPasswordDTO struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}
