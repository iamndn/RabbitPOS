package middleware

import (
	"net/http"
	"strings"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware dynamically handles CORS origin validation, headers, and preflight OPTIONS requests
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" {
			allowed := false
			reqOriginClean := strings.TrimRight(strings.TrimSpace(origin), "/")

			if cfg.AppEnv == "development" {
				allowed = true
			} else {
				for _, o := range cfg.CORSAllowedOrigins {
					cleanO := strings.TrimRight(strings.TrimSpace(o), "/")
					if cleanO == "*" || cleanO == reqOriginClean {
						allowed = true
						break
					}
				}
			}

			if allowed {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With")
				c.Header("Access-Control-Max-Age", "43200")
			}
		}

		// Handle preflight OPTIONS requests immediately with 204 No Content
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
