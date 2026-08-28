package models

import (
	"time"
)

type UserRole string

const (
	RoleAdmin UserRole = "admin"
	RoleStaff UserRole = "staff"
)

// User represents a system operator or cashier in RabbitPOS
type User struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	Username           string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	PasswordHash       string    `gorm:"type:varchar(255);not null" json:"-"`
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
	ID                 uint     `json:"id"`
	Username           string   `json:"username"`
	Email              string   `json:"email"`
	Role               UserRole `json:"role"`
	IsActive           bool     `json:"is_active"`
	NeedsPasswordSetup bool     `json:"needs_password_setup"`
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
