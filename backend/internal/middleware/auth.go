package middleware

import (
	"net/http"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

// AuthMiddleware verifies JWT authentication header or cookie
func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
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
			models.SendError(c, http.StatusUnauthorized, "Authentication required: missing token")
			c.Abort()
			return
		}

		// 3. Validate Token
		claims, err := utils.ValidateJWT(tokenStr, jwtSecret)
		if err != nil {
			models.SendError(c, http.StatusUnauthorized, "Invalid or expired token: "+err.Error())
			c.Abort()
			return
		}

		// Set context values
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("user_role", claims.Role)

		c.Next()
	}
}

// RequireRole enforces Role-Based Access Control (RBAC)
func RequireRole(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			models.SendError(c, http.StatusUnauthorized, "Authentication context missing")
			c.Abort()
			return
		}

		userRole, ok := roleVal.(models.UserRole)
		if !ok {
			models.SendError(c, http.StatusForbidden, "Invalid role context")
			c.Abort()
			return
		}

		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		models.SendError(c, http.StatusForbidden, "Access denied: insufficient permissions for role '"+string(userRole)+"'")
		c.Abort()
	}
}
