package handlers

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

// tempSetupClaims defines a short-lived JWT used only for password setup handshake
type tempSetupClaims struct {
	Username   string `json:"username"`
	NeedsSetup bool   `json:"needs_setup"`
	jwt.RegisteredClaims
}

// generateTempSetupToken creates a short-lived (15-minute) JWT for the password setup flow
func generateTempSetupToken(username string, secret string) (string, error) {
	claims := &tempSetupClaims{
		Username:   username,
		NeedsSetup: true,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   username,
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// validateTempSetupToken verifies a temp setup JWT and returns the username
func validateTempSetupToken(tokenStr string, secret string) (string, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &tempSetupClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return "", err
	}
	if claims, ok := token.Claims.(*tempSetupClaims); ok && token.Valid && claims.NeedsSetup {
		return claims.Username, nil
	}
	return "", errors.New("invalid setup token")
}

// Login authenticates staff/admin credentials and issues a signed JWT token.
// If the user has needs_password_setup=true, returns a "needs_setup" status with a temp token.
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

	// First-time password setup required — issue a short-lived temp token
	if user.NeedsPasswordSetup {
		log.Printf("[AUTH] User '%s' requires first-time password setup", user.Username)
		tempToken, err := generateTempSetupToken(user.Username, h.cfg.JWTSecret)
		if err != nil {
			log.Printf("[AUTH] Failed to generate temp setup token for '%s': %v", user.Username, err)
			models.SendInternalError(c, "Failed to initiate setup flow")
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  "needs_setup",
			"data":    models.NeedsSetupResponse{Username: user.Username, TempToken: tempToken},
			"message": "Password setup required",
		})
		return
	}

	// Generate full JWT Token for authenticated users
	token, err := utils.GenerateJWT(user.ID, user.Username, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		log.Printf("[AUTH] Failed to generate JWT token for user '%s': %v", user.Username, err)
		models.SendInternalError(c, "Failed to generate authentication token")
		return
	}

	// Set HTTP-only Cookie
	c.SetCookie("token", token, h.cfg.JWTExpiryHours*3600, "/", "", false, true)

	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: user.NeedsPasswordSetup,
	}

	log.Printf("[AUTH] User '%s' (%s) authenticated successfully", user.Username, user.Role)
	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  userResp,
	}, "Authentication successful")
}

// SetupPassword handles first-time password change for accounts with needs_password_setup=true.
// This is a PUBLIC endpoint protected only by the short-lived temp_token.
func (h *AuthHandler) SetupPassword(c *gin.Context) {
	var req models.SetupPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[AUTH] Invalid setup-password payload: %v", err)
		models.SendError(c, http.StatusBadRequest, "Invalid request: "+err.Error())
		return
	}

	// Validate temp setup token
	tokenUsername, err := validateTempSetupToken(req.TempToken, h.cfg.JWTSecret)
	if err != nil {
		log.Printf("[AUTH] Invalid temp setup token for '%s': %v", req.Username, err)
		models.SendError(c, http.StatusUnauthorized, "Invalid or expired setup token")
		return
	}

	// Ensure token username matches request username (prevents token reuse across accounts)
	if tokenUsername != req.Username {
		log.Printf("[AUTH] Setup token username mismatch: token=%s, request=%s", tokenUsername, req.Username)
		models.SendError(c, http.StatusUnauthorized, "Setup token does not match username")
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendError(c, http.StatusNotFound, "User not found")
			return
		}
		log.Printf("[AUTH] DB error looking up user '%s' during setup: %v", req.Username, err)
		models.SendInternalError(c, "Failed to retrieve user account")
		return
	}

	if !user.NeedsPasswordSetup {
		log.Printf("[AUTH] Setup attempted for user '%s' who doesn't need setup", req.Username)
		models.SendError(c, http.StatusBadRequest, "Password setup already completed for this account")
		return
	}

	// Hash the new password
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[AUTH] Failed to hash new password for '%s': %v", req.Username, err)
		models.SendInternalError(c, "Failed to hash new password")
		return
	}

	// Update password hash and clear needs_password_setup flag
	if err := h.db.Model(&user).Updates(map[string]interface{}{
		"password_hash":        string(newHash),
		"needs_password_setup": false,
	}).Error; err != nil {
		log.Printf("[AUTH] Failed to update password for '%s': %v", req.Username, err)
		models.SendInternalError(c, "Failed to save new password")
		return
	}

	// Issue a full auth JWT now that setup is complete
	fullToken, err := utils.GenerateJWT(user.ID, user.Username, user.Role, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		log.Printf("[AUTH] Failed to generate JWT after setup for '%s': %v", user.Username, err)
		models.SendInternalError(c, "Password updated but failed to generate auth token")
		return
	}

	c.SetCookie("token", fullToken, h.cfg.JWTExpiryHours*3600, "/", "", false, true)

	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: false,
	}

	log.Printf("[AUTH] User '%s' completed password setup successfully", user.Username)
	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: fullToken,
		User:  userResp,
	}, "Password setup complete. Logged in successfully.")
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
		ID:                 user.ID,
		Username:           user.Username,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: user.NeedsPasswordSetup,
	}

	models.SendSuccess(c, http.StatusOK, userResp, "Current user profile retrieved successfully")
}
