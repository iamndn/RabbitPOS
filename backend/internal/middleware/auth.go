package middleware

import (
	"net/http"
	"strconv"
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
		activeRole := claims.Role
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
				activeRole = user.Role
			}
		}

		// Set context values for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", string(activeRole))
		c.Set("user_role", activeRole)
		c.Set("jti", claims.ID)
		c.Set("token_version", claims.TokenVersion)

		c.Next()
	}
}

// RequireRole enforces Role-Based Access Control (RBAC) with hierarchy:
// master automatically inherits all permissions of owner and staff.
// owner inherits all permissions of staff.
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

		// Master automatically inherits all permissions of owner and staff
		if userRole.IsMaster() {
			c.Next()
			return
		}

		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
			// Owner inherits staff permissions
			if (allowed == models.RoleStaff || allowed == "cashier") && userRole.IsOwner() {
				c.Next()
				return
			}
			// Legacy super_admin / admin aliases
			if (allowed == models.RoleAdmin || allowed == models.RoleSuperAdmin) && userRole.IsSuperAdmin() {
				c.Next()
				return
			}
		}

		models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN_ROLE", "Access denied: insufficient permissions for role '"+string(userRole)+"'")
		c.Abort()
	}
}

// RequireOwnershipOrMaster ensures:
// 1. Master can update/delete/toggle any account.
// 2. Owner can only update/deactivate staff accounts, and CANNOT modify or delete master or other owner accounts.
func RequireOwnershipOrMaster(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		callerRoleVal, exists := c.Get("user_role")
		if !exists {
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", "Authentication context missing")
			c.Abort()
			return
		}
		callerRole, _ := callerRoleVal.(models.UserRole)

		// Master has full access to all accounts
		if callerRole.IsMaster() {
			c.Next()
			return
		}

		// Non-master must be at least owner
		if !callerRole.IsOwner() {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Only master and owner can manage users")
			c.Abort()
			return
		}

		// Check the target user role from DB if an ID parameter is present
		targetIDStr := c.Param("id")
		if targetIDStr == "" {
			c.Next()
			return
		}

		targetID, err := strconv.ParseUint(targetIDStr, 10, 64)
		if err != nil {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID")
			c.Abort()
			return
		}

		callerIDVal, _ := c.Get("user_id")
		callerID, _ := callerIDVal.(uint)

		var targetUser models.User
		if err := db.Select("id, role").First(&targetUser, targetID).Error; err != nil {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			c.Abort()
			return
		}

		// Owner cannot modify master accounts
		if targetUser.Role.IsMaster() {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners cannot modify master accounts")
			c.Abort()
			return
		}

		// Owner cannot modify other owner accounts (can only edit their own profile or staff accounts)
		if targetUser.Role.IsOwner() && targetUser.ID != callerID {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners can only manage staff accounts")
			c.Abort()
			return
		}

		// If caller is owner and modifying another user, ensure target user belongs strictly within caller's owned stores
		if targetUser.ID != callerID {
			if targetUser.Role != models.RoleStaff && targetUser.Role != "cashier" {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners can only manage staff accounts")
				c.Abort()
				return
			}

			var ownedStoreIDs []uint
			if err := db.Model(&models.UserStore{}).Where("user_id = ? AND role = ?", callerID, models.StoreRoleStoreAdmin).Pluck("store_id", &ownedStoreIDs).Error; err != nil || len(ownedStoreIDs) == 0 {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owner does not manage any stores")
				c.Abort()
				return
			}

			var targetStoreIDs []uint
			if err := db.Model(&models.UserStore{}).Where("user_id = ?", targetUser.ID).Pluck("store_id", &targetStoreIDs).Error; err != nil || len(targetStoreIDs) == 0 {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Target staff member does not belong to your store scope")
				c.Abort()
				return
			}

			ownedMap := make(map[uint]bool, len(ownedStoreIDs))
			for _, sid := range ownedStoreIDs {
				ownedMap[sid] = true
			}
			for _, sid := range targetStoreIDs {
				if !ownedMap[sid] {
					models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners cannot manage staff belonging to other stores")
					c.Abort()
					return
				}
			}
		}

		c.Next()
	}
}

