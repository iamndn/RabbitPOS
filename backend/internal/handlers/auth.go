package handlers

import (
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
		models.SendError(c, http.StatusBadRequest, "Invalid login payload: "+err.Error())
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusUnauthorized, "Invalid username or password")
			return
		}
		models.SendInternalError(c, "Authentication query error")
		return
	}

	if !user.IsActive {
		models.SendError(c, http.StatusForbidden, "User account is deactivated")
		return
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		models.SendError(c, http.StatusUnauthorized, "Invalid username or password")
		return
	}

	// Generate JWT Token
	token, err := utils.GenerateJWT(user.ID, user.Username, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		models.SendInternalError(c, "Failed to generate JWT token: "+err.Error())
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
		models.SendError(c, http.StatusUnauthorized, "User context missing")
		return
	}

	userID := userIDVal.(uint)

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		models.SendError(c, http.StatusNotFound, "User profile not found")
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
