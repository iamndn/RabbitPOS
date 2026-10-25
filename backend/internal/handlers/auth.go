package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
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

	// Update LastLoginAt in database
	now := time.Now()
	h.db.Model(&user).Update("last_login_at", &now)
	user.LastLoginAt = &now

	stores, defID := h.populateUserStores(&user)
	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: user.NeedsPasswordSetup,
		LastLoginAt:        user.LastLoginAt,
		Stores:             stores,
		DefaultStoreID:     defID,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
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

// removeVietnameseTones strips diacritics for clean ASCII slugs
func removeVietnameseTones(str string) string {
	accents := map[rune]rune{
		'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
		'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
		'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
		'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o', 'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
		'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
		'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
		'đ': 'd',
	}
	var b strings.Builder
	for _, r := range strings.ToLower(str) {
		if mapped, ok := accents[r]; ok {
			b.WriteRune(mapped)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

var nonAlphaNumRegex = regexp.MustCompile(`[^a-z0-9]+`)

func generateStoreSlug(storeName string) string {
	ascii := removeVietnameseTones(storeName)
	slug := nonAlphaNumRegex.ReplaceAllString(ascii, "-")
	slug = strings.Trim(slug, "-")
	if len(slug) < 2 {
		slug = "store"
	}
	if len(slug) > 40 {
		slug = slug[:40]
		slug = strings.TrimRight(slug, "-")
	}
	return slug
}

// Register creates a new owner user and their first store in a single transaction
func (h *AuthHandler) Register(c *gin.Context) {
	ip := middleware.GetClientIP(c)
	userAgent := c.Request.UserAgent()

	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PAYLOAD", "Thông tin đăng ký không hợp lệ: "+err.Error())
		return
	}

	username := strings.ToLower(strings.TrimSpace(req.Username))
	fullName := strings.TrimSpace(req.FullName)
	storeName := strings.TrimSpace(req.StoreName)
	password := strings.TrimSpace(req.Password)
	pinCode := strings.TrimSpace(req.PinCode)
	phone := strings.TrimSpace(req.Phone)
	email := strings.TrimSpace(req.Email)

	if username == "" || len(username) < 3 {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_USERNAME", "Tên đăng nhập phải có ít nhất 3 ký tự.")
		return
	}
	if fullName == "" {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_FULL_NAME", "Vui lòng nhập họ và tên.")
		return
	}
	if len(password) < 6 {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PASSWORD", "Mật khẩu phải có ít nhất 6 ký tự.")
		return
	}
	if storeName == "" {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_STORE_NAME", "Vui lòng nhập tên cửa hàng.")
		return
	}
	if pinCode != "" && !regexp.MustCompile(`^\d{4,6}$`).MatchString(pinCode) {
		models.SendErrorCode(c, http.StatusBadRequest, "INVALID_PIN", "Mã PIN phải gồm từ 4 đến 6 chữ số.")
		return
	}

	ipKey := "ip:" + ip
	if h.limiter != nil && !h.limiter.IsAllowed(ipKey) {
		c.Header("Retry-After", "60")
		models.SendErrorCode(c, http.StatusTooManyRequests, "AUTH_RATE_LIMITED", "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.")
		return
	}

	if h.db == nil {
		models.SendErrorCode(c, http.StatusInternalServerError, "DB_UNAVAILABLE", "Database service unavailable")
		return
	}

	// 1. Check if username is already taken (case-insensitive)
	var existingUserCount int64
	if err := h.db.Model(&models.User{}).Where("LOWER(username) = ?", username).Count(&existingUserCount).Error; err != nil {
		models.SendInternalErrorLogged(c, "Database query error", err)
		return
	}
	if existingUserCount > 0 {
		models.SendErrorCode(c, http.StatusConflict, "USERNAME_TAKEN", "Tên đăng nhập '"+username+"' đã được sử dụng. Vui lòng chọn tên khác.")
		return
	}

	// 2. Hash password
	pwdHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		models.SendInternalErrorLogged(c, "Password hashing error", err)
		return
	}

	// 3. Hash PIN if provided
	var pinHash *string
	if pinCode != "" {
		pHash, err := bcrypt.GenerateFromPassword([]byte(pinCode), bcrypt.DefaultCost)
		if err == nil {
			s := string(pHash)
			pinHash = &s
		}
	}

	// 4. Role determination: Public registration form MUST ALWAYS receive RoleOwner (NEVER RoleMaster).
	assignedRole := models.RoleOwner

	// 5. Business type normalization
	businessType := strings.ToLower(strings.TrimSpace(req.BusinessType))
	if businessType == "" || !models.StoreBusinessTypes[businessType] {
		businessType = "cafe"
	}

	// 6. Base store slug
	baseSlug := generateStoreSlug(storeName)

	var newUser models.User
	var newStore models.Store

	// Transactional creation of User, Store, Seed defaults, and UserStore membership
	err = h.db.Transaction(func(tx *gorm.DB) error {
		newUser = models.User{
			Username:           username,
			FullName:           fullName,
			Phone:              phone,
			Email:              email,
			Role:               assignedRole,
			PasswordHash:       string(pwdHash),
			PinCode:            pinHash,
			IsActive:           true,
			NeedsPasswordSetup: false,
			TokenVersion:       1,
		}
		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}
		// Explicitly ensure needs_password_setup is false (bypassing GORM default:true zero-value tag)
		if err := tx.Model(&newUser).Update("needs_password_setup", false).Error; err != nil {
			return err
		}
		newUser.NeedsPasswordSetup = false

		// Resolve unique store code
		storeCode := baseSlug
		var count int64
		if err := tx.Model(&models.Store{}).Where("LOWER(code) = ?", storeCode).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			storeCode = fmt.Sprintf("%s-%d", baseSlug, time.Now().Unix()%10000)
		}

		newStore = models.Store{
			Code:             storeCode,
			Name:             storeName,
			BusinessType:     businessType,
			CurrencyCode:     "VND",
			CurrencySymbol:   "đ",
			CurrencyPosition: "suffix",
			Timezone:         "Asia/Ho_Chi_Minh",
			IsActive:         true,
		}
		if err := tx.Create(&newStore).Error; err != nil {
			return err
		}

		// Seed store defaults (Funds, Categories, Store Settings)
		if err := database.SeedStoreDefaults(tx, newStore.ID); err != nil {
			return err
		}

		// Link user as store_admin and default store
		membership := models.UserStore{
			UserID:    newUser.ID,
			StoreID:   newStore.ID,
			Role:      models.StoreRoleStoreAdmin,
			IsDefault: true,
		}
		if err := tx.Create(&membership).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		models.SendInternalErrorLogged(c, "Transaction error while creating account and store", err)
		return
	}

	// 7. Generate JWT
	token, _, err := utils.GenerateJWT(newUser.ID, newUser.Username, newUser.Role, newUser.TokenVersion, h.cfg.JWTSecret, h.cfg.JWTExpiryHours)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to generate auth token", err)
		return
	}

	cookieMaxAge := h.cfg.JWTExpiryHours * 3600
	c.SetCookie("token", token, cookieMaxAge, "/", "", false, true)

	stores, defID := h.populateUserStores(&newUser)
	userResp := models.UserResponse{
		ID:                 newUser.ID,
		Username:           newUser.Username,
		FullName:           newUser.FullName,
		Phone:              newUser.Phone,
		Email:              newUser.Email,
		Role:               newUser.Role,
		IsActive:           newUser.IsActive,
		HasPin:             newUser.PinCode != nil && *newUser.PinCode != "",
		NeedsPasswordSetup: newUser.NeedsPasswordSetup,
		LastLoginAt:        newUser.LastLoginAt,
		Stores:             stores,
		DefaultStoreID:     defID,
		CreatedAt:          newUser.CreatedAt,
		UpdatedAt:          newUser.UpdatedAt,
	}

	if h.auditSvc != nil {
		userStrID := fmt.Sprintf("%d", newUser.ID)
		h.auditSvc.RecordLog(&newUser.ID, newUser.Username, string(newUser.Role), "auth.register_success", "user", &userStrID, "success", ip, userAgent, map[string]interface{}{
			"store_id":   newStore.ID,
			"store_name": newStore.Name,
		})
	}

	models.SendSuccess(c, http.StatusOK, models.LoginResponse{
		Token: token,
		User:  userResp,
	}, "Đăng ký tài khoản và khởi tạo cửa hàng thành công.")
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

	stores, defID := h.populateUserStores(&user)
	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: false,
		LastLoginAt:        user.LastLoginAt,
		Stores:             stores,
		DefaultStoreID:     defID,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
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

	stores, defID := h.populateUserStores(&user)
	userResp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: user.NeedsPasswordSetup,
		LastLoginAt:        user.LastLoginAt,
		Stores:             stores,
		DefaultStoreID:     defID,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}

	models.SendSuccess(c, http.StatusOK, userResp, "Current user profile retrieved successfully")
}

func (h *AuthHandler) populateUserStores(user *models.User) ([]models.StoreResponse, *uint) {
	var memberships []models.UserStore
	_ = h.db.Where("user_id = ?", user.ID).Find(&memberships).Error
	byStore := map[uint]models.UserStore{}
	var defID *uint
	for _, m := range memberships {
		byStore[m.StoreID] = m
		if m.IsDefault {
			id := m.StoreID
			defID = &id
		}
	}

	var stores []models.Store
	isSuper := user.Role.IsSuperAdmin()
	q := h.db.Order("id ASC")
	if !isSuper {
		ids := make([]uint, 0, len(byStore))
		for id := range byStore {
			ids = append(ids, id)
		}
		if len(ids) == 0 {
			return []models.StoreResponse{}, nil
		}
		q = q.Where("id IN ?", ids).Where("is_active = TRUE")
	}
	_ = q.Find(&stores).Error

	out := make([]models.StoreResponse, 0, len(stores))
	for _, s := range stores {
		r := models.StoreResponse{Store: s}
		if m, ok := byStore[s.ID]; ok {
			r.Role, r.IsDefault = m.Role, m.IsDefault
		}
		if isSuper {
			r.Role = models.StoreRoleSuperAdmin
		}
		if !isSuper && !s.IsActive {
			continue
		}
		out = append(out, r)
	}

	if defID == nil && len(out) > 0 {
		firstID := out[0].ID
		defID = &firstID
	}
	return out, defID
}
