package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db       *gorm.DB
	cfg      *config.Config
	limiter  *middleware.MemoryRateLimiter
	auditSvc *services.AuditService
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config, limiter *middleware.MemoryRateLimiter, auditSvc *services.AuditService) *AuthHandler {
	return &AuthHandler{
		db:       db,
		cfg:      cfg,
		limiter:  limiter,
		auditSvc: auditSvc,
	}
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

// Login authenticates staff/admin credentials and issues a signed JWT token with rate limiting and audit logging
func (h *AuthHandler) Login(c *gin.Context) {
	ip := middleware.GetClientIP(c)
	userAgent := c.Request.UserAgent()

	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid login payload: "+err.Error())
		return
	}

	ipKey := "ip:" + ip
	userKey := "user:" + req.Username

	// 1. Rate Limiting Check
	if h.limiter != nil {
		if !h.limiter.IsAllowed(ipKey) || !h.limiter.IsAllowed(userKey) {
			c.Header("Retry-After", "60")
			if h.auditSvc != nil {
				h.auditSvc.RecordLog(nil, req.Username, "guest", "auth.login_rate_limited", "user", nil, "blocked", ip, userAgent, map[string]interface{}{"ip": ip})
			}
			models.SendErrorCode(c, http.StatusTooManyRequests, "AUTH_RATE_LIMITED", "Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau 1 phút.")
			return
		}
	}

	if h.db == nil {
		models.SendErrorCode(c, http.StatusInternalServerError, "DB_UNAVAILABLE", "Database service unavailable")
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if h.limiter != nil {
				h.limiter.RecordFailure(ipKey)
				h.limiter.RecordFailure(userKey)
			}
			if h.auditSvc != nil {
				h.auditSvc.RecordLog(nil, req.Username, "guest", "auth.login_failed", "user", nil, "failed", ip, userAgent, map[string]interface{}{"reason": "user_not_found"})
			}
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_INVALID_CREDENTIALS", "Invalid username or password")
			return
		}
		models.SendInternalErrorLogged(c, "Authentication query error", err)
		return
	}

	if !user.IsActive {
		if h.auditSvc != nil {
			userStrID := fmt.Sprintf("%d", user.ID)
			h.auditSvc.RecordLog(&user.ID, user.Username, string(user.Role), "auth.login_deactivated", "user", &userStrID, "forbidden", ip, userAgent, nil)
		}
		models.SendErrorCode(c, http.StatusForbidden, "AUTH_ACCOUNT_DEACTIVATED", "User account is deactivated")
		return
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		if h.limiter != nil {
			h.limiter.RecordFailure(ipKey)
			h.limiter.RecordFailure(userKey)
		}
		if h.auditSvc != nil {
			userStrID := fmt.Sprintf("%d", user.ID)
			h.auditSvc.RecordLog(&user.ID, user.Username, string(user.Role), "auth.login_failed", "user", &userStrID, "failed", ip, userAgent, map[string]interface{}{"reason": "wrong_password"})
		}
		models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_INVALID_CREDENTIALS", "Invalid username or password")
		return
	}

	// Reset rate limiter on successful authentication
	if h.limiter != nil {
		h.limiter.Reset(ipKey)
		h.limiter.Reset(userKey)
	}

	// First-time password setup required — issue a short-lived temp token
	if user.NeedsPasswordSetup {
		tempToken, err := generateTempSetupToken(user.Username, h.cfg.JWTSecret)
		if err != nil {
			models.SendInternalErrorLogged(c, "Failed to initiate setup flow", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":  "needs_setup",
			"data":    models.NeedsSetupResponse{Username: user.Username, TempToken: tempToken},
			"message": "Password setup required",
		})
		return
	}

	// Generate full JWT Token for authenticated users with JTI and TokenVersion
	token, _, err := utils.GenerateJWT(user.ID, user.Username, user.Role, user.TokenVersion, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to generate authentication token", err)
		return
	}

	// Set HTTP-only Cookie with Secure attribute in production
	cookieMaxAge := h.cfg.JWTExpiryHours * 3600
	c.SetCookie("token", token, cookieMaxAge, "/", "", false, true)

	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: user.NeedsPasswordSetup,
	}

	// Record audit log
	if h.auditSvc != nil {
		userStrID := fmt.Sprintf("%d", user.ID)
		h.auditSvc.RecordLog(&user.ID, user.Username, string(user.Role), "auth.login_success", "user", &userStrID, "success", ip, userAgent, nil)
	}

	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  userResp,
	}, "Authentication successful")
}

// SetupPassword handles first-time password change for accounts with needs_password_setup=true
func (h *AuthHandler) SetupPassword(c *gin.Context) {
	ip := middleware.GetClientIP(c)
	userAgent := c.Request.UserAgent()

	var req models.SetupPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid request: "+err.Error())
		return
	}

	tokenUsername, err := validateTempSetupToken(req.TempToken, h.cfg.JWTSecret)
	if err != nil {
		models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "Invalid or expired setup token")
		return
	}

	if tokenUsername != req.Username {
		models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "Setup token does not match username")
		return
	}

	var user models.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to retrieve user account", err)
		return
	}

	if !user.NeedsPasswordSetup {
		models.SendErrorCode(c, http.StatusBadRequest, "SETUP_ALREADY_COMPLETED", "Password setup already completed for this account")
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to hash new password", err)
		return
	}

	// Increment token version to revoke any prior sessions and clear needs_password_setup
	newTokenVersion := user.TokenVersion + 1
	if err := h.db.Model(&user).Updates(map[string]interface{}{
		"password_hash":        string(newHash),
		"needs_password_setup": false,
		"token_version":        newTokenVersion,
	}).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to save new password", err)
		return
	}

	fullToken, _, err := utils.GenerateJWT(user.ID, user.Username, user.Role, newTokenVersion, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		models.SendInternalErrorLogged(c, "Password updated but failed to generate auth token", err)
		return
	}

	c.SetCookie("token", fullToken, h.cfg.JWTExpiryHours*3600, "/", "", false, true)

	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: false,
	}

	if h.auditSvc != nil {
		userStrID := fmt.Sprintf("%d", user.ID)
		h.auditSvc.RecordLog(&user.ID, user.Username, string(user.Role), "auth.setup_password", "user", &userStrID, "success", ip, userAgent, nil)
	}

	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: fullToken,
		User:  userResp,
	}, "Password setup complete. Logged in successfully.")
}

// Logout revokes the current session JTI and clears the authentication cookie
func (h *AuthHandler) Logout(c *gin.Context) {
	ip := middleware.GetClientIP(c)
	userAgent := c.Request.UserAgent()

	// Extract JTI and UserID from context
	var userID *uint
	if uidVal, exists := c.Get("user_id"); exists {
		if uid, ok := uidVal.(uint); ok {
			userID = &uid
		}
	}
	username, _ := c.Get("username")
	role, _ := c.Get("role")
	jtiVal, hasJti := c.Get("jti")

	if hasJti && h.db != nil {
		if jti, ok := jtiVal.(string); ok && jti != "" {
			var uid uint
			if userID != nil {
				uid = *userID
			}
			revoked := models.RevokedToken{
				JTI:       jti,
				UserID:    uid,
				ExpiresAt: time.Now().Add(time.Duration(h.cfg.JWTExpiryHours) * time.Hour),
				Reason:    "user_logout",
				CreatedAt: time.Now(),
			}
			if err := h.db.Create(&revoked).Error; err != nil {
				log.Printf("[AUTH] Failed to insert revoked token JTI %s: %v", jti, err)
			}
		}
	}

	// Clear Cookie
	c.SetCookie("token", "", -1, "/", "", false, true)

	if h.auditSvc != nil && username != nil {
		userStrID := ""
		if userID != nil {
			userStrID = fmt.Sprintf("%d", *userID)
		}
		h.auditSvc.RecordLog(userID, username.(string), fmt.Sprintf("%v", role), "auth.logout", "user", &userStrID, "success", ip, userAgent, nil)
	}

	models.SendSuccess(c, http.StatusOK, nil, "Logged out successfully")
}

// GetMe retrieves current authenticated user profile
func (h *AuthHandler) GetMe(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", "User context missing")
		return
	}

	userID, ok := userIDVal.(uint)
	if !ok {
		models.SendErrorCode(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Invalid user context")
		return
	}

	if h.db == nil {
		models.SendErrorCode(c, http.StatusInternalServerError, "DB_UNAVAILABLE", "Database service unavailable")
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User profile not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to retrieve user profile", err)
		return
	}

	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		NeedsPasswordSetup: user.NeedsPasswordSetup,
	}

	models.SendSuccess(c, http.StatusOK, userResp, "Current user profile retrieved successfully")
}
