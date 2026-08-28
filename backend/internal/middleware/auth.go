package middleware

import (
	"net/http"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AuthMiddleware verifies JWT authentication header or cookie, checking revocation and user validity
func AuthMiddleware(jwtSecret string, db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenStr string

		// 1. Try Authorization header (Bearer <token>)
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenStr = parts[1]
			}
		}

		// 2. Fallback to HTTP-only token cookie
		if tokenStr == "" {
			if cookie, err := c.Cookie("token"); err == nil {
				tokenStr = cookie
			}
		}

		if tokenStr == "" {
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", "Authentication required: missing token")
			c.Abort()
			return
		}

		// 3. Validate Token Signature and Expiration
		claims, err := utils.ValidateJWT(tokenStr, jwtSecret)
		if err != nil {
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "Invalid or expired token: "+err.Error())
			c.Abort()
			return
		}

		// 4. Check JTI Revocation in Database
		if db != nil && claims.ID != "" {
			var count int64
			if err := db.Model(&models.RevokedToken{}).Where("jti = ?", claims.ID).Count(&count).Error; err == nil && count > 0 {
				models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_TOKEN_REVOKED", "Phiên đăng nhập đã bị thu hồi hoặc đăng xuất")
				c.Abort()
				return
			}
		}

		// 5. Verify User Active Status and TokenVersion
		if db != nil && claims.UserID > 0 {
			var user models.User
			if err := db.Select("id, role, is_active, token_version").First(&user, claims.UserID).Error; err == nil {
				if !user.IsActive {
					models.SendErrorCode(c, http.StatusForbidden, "AUTH_ACCOUNT_DEACTIVATED", "Tài khoản người dùng đã bị vô hiệu hóa")
					c.Abort()
					return
				}

				if claims.TokenVersion > 0 && claims.TokenVersion < user.TokenVersion {
					models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_SESSION_EXPIRED", "Phiên đăng nhập đã hết hạn do thay đổi mật khẩu")
					c.Abort()
					return
				}
			}
		}

		// Set context values for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", string(claims.Role))
		c.Set("user_role", claims.Role)
		c.Set("jti", claims.ID)
		c.Set("token_version", claims.TokenVersion)

		c.Next()
	}
}

// RequireRole enforces Role-Based Access Control (RBAC)
func RequireRole(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", "Authentication context missing")
			c.Abort()
			return
		}

		userRole, ok := roleVal.(models.UserRole)
		if !ok {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN_ROLE", "Invalid role context")
			c.Abort()
			return
		}

		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN_ROLE", "Access denied: insufficient permissions for role '"+string(userRole)+"'")
		c.Abort()
	}
}
