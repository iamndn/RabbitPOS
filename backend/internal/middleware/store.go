package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RequireSuperAdmin allows only super_admin (and legacy admin, per rule D-4).
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("user_role")
		if !exists {
			roleVal = c.GetString("role")
		}
		role := models.ParseUserRole(roleVal)
		if !role.IsSuperAdmin() {
			models.SendErrorCode(c, http.StatusForbidden, "STORE_ROLE_INSUFFICIENT", "Super admin permission required")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireStoreRole enforces RBAC inside the active store (staff < store_admin < super_admin).
func RequireStoreRole(minRole models.StoreRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("store_role")
		if !exists {
			models.SendErrorCode(c, http.StatusBadRequest, "STORE_REQUIRED", "Store context missing")
			c.Abort()
			return
		}
		role, ok := roleVal.(models.StoreRole)
		if !ok || !role.AtLeast(minRole) {
			models.SendErrorCode(c, http.StatusForbidden, "STORE_ROLE_INSUFFICIENT", "Access denied: insufficient permissions for store role '"+string(role)+"'")
			c.Abort()
			return
		}
		c.Next()
	}
}

// StoreContext validates and injects store context into gin.Context.
// Reads X-Store-ID (and ?store_id= for GET), checks store status and caller's store membership.
func StoreContext(db *gorm.DB, cCache *cache.TTLCache, requireHeader bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		callerIDVal, exists := c.Get("user_id")
		if !exists {
			models.SendErrorCode(c, http.StatusUnauthorized, "AUTH_UNAUTHORIZED", "Authentication context missing")
			c.Abort()
			return
		}
		userID, _ := callerIDVal.(uint)

		callerRoleVal, exists := c.Get("user_role")
		if !exists {
			callerRoleVal = c.GetString("role")
		}
		userRole := models.ParseUserRole(callerRoleVal)
		isSuperAdmin := userRole.IsSuperAdmin()

		// 1. Resolve store ID
		rawID := strings.TrimSpace(c.GetHeader("X-Store-ID"))
		if rawID == "" && c.Request.Method == http.MethodGet {
			rawID = strings.TrimSpace(c.Query("store_id"))
		}

		var storeID uint
		if rawID != "" {
			parsed, err := strconv.ParseUint(rawID, 10, 64)
			if err != nil || parsed == 0 {
				models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid store ID")
				c.Abort()
				return
			}
			storeID = uint(parsed)
		} else {
			// Header missing
			if requireHeader {
				models.SendErrorCode(c, http.StatusBadRequest, "STORE_REQUIRED", "Store ID is required (header X-Store-ID)")
				c.Abort()
				return
			}
			// Fallback: user's default membership or Store #1
			var defaultUS models.UserStore
			if err := db.Where("user_id = ? AND is_default = TRUE", userID).First(&defaultUS).Error; err == nil {
				storeID = defaultUS.StoreID
			} else {
				var firstUS models.UserStore
				if err := db.Where("user_id = ?", userID).Order("created_at ASC, store_id ASC").First(&firstUS).Error; err == nil {
					storeID = firstUS.StoreID
				} else {
					storeID = 1
				}
			}
		}

		// 2. Load store metadata (cached 60s)
		var store *models.Store
		metaCacheKey := fmt.Sprintf("s%d:meta", storeID)
		if cCache != nil {
			if val, ok := cCache.Get(metaCacheKey); ok {
				if s, ok := val.(*models.Store); ok {
					store = s
				}
			}
		}

		if store == nil {
			var s models.Store
			if err := db.First(&s, storeID).Error; err != nil {
				if err == gorm.ErrRecordNotFound {
					if isSuperAdmin {
						models.SendErrorCode(c, http.StatusNotFound, "STORE_NOT_FOUND", "Store not found")
					} else {
						models.SendErrorCode(c, http.StatusForbidden, "STORE_FORBIDDEN", "Access denied: store not accessible")
					}
					c.Abort()
					return
				}
				models.SendInternalErrorLogged(c, "Failed to load store", err)
				c.Abort()
				return
			}
			store = &s
			if cCache != nil {
				cCache.SetWithTTL(metaCacheKey, store, 60*time.Second)
			}
		}

		// 3. Store active check
		if !store.IsActive && !isSuperAdmin {
			models.SendErrorCode(c, http.StatusForbidden, "STORE_INACTIVE", "Store is deactivated")
			c.Abort()
			return
		}

		// 4. Membership check
		effectiveRole := models.StoreRoleStaff
		if isSuperAdmin {
			effectiveRole = models.StoreRoleSuperAdmin
		} else {
			roleCacheKey := fmt.Sprintf("s%d:u%d:role", storeID, userID)
			cachedRoleFound := false
			if cCache != nil {
				if val, ok := cCache.Get(roleCacheKey); ok {
					if r, ok := val.(models.StoreRole); ok {
						effectiveRole = r
						cachedRoleFound = true
					}
				}
			}
			if !cachedRoleFound {
				var us models.UserStore
				if err := db.Where("user_id = ? AND store_id = ?", userID, storeID).First(&us).Error; err != nil {
					if err == gorm.ErrRecordNotFound {
						models.SendErrorCode(c, http.StatusForbidden, "STORE_FORBIDDEN", "Access denied: you do not have permission to access this store")
						c.Abort()
						return
					}
					models.SendInternalErrorLogged(c, "Failed to check store membership", err)
					c.Abort()
					return
				}
				effectiveRole = us.Role
				if cCache != nil {
					cCache.SetWithTTL(roleCacheKey, effectiveRole, 60*time.Second)
				}
			}
		}

		// 5. Inject store context
		c.Set("store_id", store.ID)
		c.Set("store_role", effectiveRole)
		c.Set("store", store)
		c.Next()
	}
}

// GetStoreID retrieves the active store_id from context. If not present in context,
// it falls back to X-Store-ID header, or Store #1 when STORE_HEADER_REQUIRED is not set to true.
func GetStoreID(c *gin.Context) uint {
	val, exists := c.Get("store_id")
	if exists {
		if id, ok := val.(uint); ok && id > 0 {
			return id
		}
	}
	if raw := strings.TrimSpace(c.GetHeader("X-Store-ID")); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 64); err == nil && parsed > 0 {
			return uint(parsed)
		}
	}
	if raw := strings.TrimSpace(c.Query("store_id")); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 64); err == nil && parsed > 0 {
			return uint(parsed)
		}
	}
	if os.Getenv("STORE_HEADER_REQUIRED") != "true" {
		return 1
	}
	return 0
}

// GetStoreIDOk retrieves the active store_id and an existence boolean.
func GetStoreIDOk(c *gin.Context) (uint, bool) {
	id := GetStoreID(c)
	return id, id > 0
}

// MustGetStoreID retrieves the active store_id from context or aborts with STORE_REQUIRED.
func MustGetStoreID(c *gin.Context) uint {
	id := GetStoreID(c)
	if id == 0 {
		models.SendErrorCode(c, http.StatusBadRequest, "STORE_REQUIRED", "Store context is required")
		c.Abort()
		return 0
	}
	return id
}

// GetStore retrieves the active store from context.
func GetStore(c *gin.Context) (*models.Store, bool) {
	val, exists := c.Get("store")
	if !exists {
		return nil, false
	}
	s, ok := val.(*models.Store)
	return s, ok
}

// GetStoreRole retrieves the active store_role from context.
func GetStoreRole(c *gin.Context) (models.StoreRole, bool) {
	val, exists := c.Get("store_role")
	if !exists {
		return "", false
	}
	r, ok := val.(models.StoreRole)
	return r, ok
}
