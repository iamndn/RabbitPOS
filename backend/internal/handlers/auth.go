package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

// Login authenticates staff/admin credentials and issues a signed JWT token
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[AUTH] Invalid login payload: %v", err)
		models.SendError(c, http.StatusBadRequest, "Invalid login payload: "+err.Error())
		return
	}

	if h.db == nil {
		log.Printf("[AUTH] Database connection is nil")
		models.SendInternalError(c, "Database service unavailable")
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[AUTH] User not found: %s", req.Username)
			models.SendError(c, http.StatusUnauthorized, "Invalid username or password")
			return
		}
		log.Printf("[AUTH] Database query error for user '%s': %v", req.Username, err)
		models.SendInternalError(c, "Authentication query error")
		return
	}

	if !user.IsActive {
		log.Printf("[AUTH] Login attempt for deactivated account: %s", req.Username)
		models.SendError(c, http.StatusForbidden, "User account is deactivated")
		return
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		log.Printf("[AUTH] Invalid password attempt for user: %s", req.Username)
		models.SendError(c, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	// Generate JWT Token
	token, err := utils.GenerateJWT(user.ID, user.Username, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		log.Printf("[AUTH] Failed to generate JWT token for user '%s': %v", user.Username, err)
		models.SendInternalError(c, "Failed to generate authentication token")
		return
	}

	// Set HTTP-only Cookie
	c.SetCookie("token", token, h.cfg.JWTExpiryHours*3600, "/", "", false, true)

	userResp := models.UserResponse{
		ID:       user.ID,
		Username: user.Username,
		Role:     user.Role,
		IsActive: user.IsActive,
	}

	log.Printf("[AUTH] User '%s' (%s) authenticated successfully", user.Username, user.Role)
	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  userResp,
	}, "Authentication successful")
}

// Logout clears authentication cookie
func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie("token", "", -1, "/", "", false, true)
	models.SendSuccess(c, http.StatusOK, nil, "Logged out successfully")
}

// GetMe retrieves current authenticated user profile
func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		log.Printf("[AUTH] GetMe called without user context")
		models.SendError(c, http.StatusUnauthorized, "User context missing")
		return
	}

	userID, ok := userIDVal.(uint)
	if !ok {
		log.Printf("[AUTH] Invalid user_id context type: %T", userIDVal)
		models.SendInternalError(c, "Invalid user context")
		return
	}

	if h.db == nil {
		log.Printf("[AUTH] Database connection is nil in GetMe")
		models.SendInternalError(c, "Database service unavailable")
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "User profile not found")
			return
		}
		log.Printf("[AUTH] Database error in GetMe for user ID %d: %v", userID, err)
		models.SendInternalError(c, "Failed to retrieve user profile")
		return
	}

	userResp := models.UserResponse{
		ID:       user.ID,
		Username: user.Username,
		Role:     user.Role,
		IsActive: user.IsActive,
	}

	models.SendSuccess(c, http.StatusOK, userResp, "Current user profile retrieved successfully")
}
