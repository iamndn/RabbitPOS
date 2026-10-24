package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/gin-gonic/gin"
)

// isAllowedOrigin checks if an incoming origin header matches permitted patterns
func isAllowedOrigin(reqOriginClean string, allowedList []string, isDev bool) bool {
	if isDev {
		return true
	}

	// 1. Localhost and loopback interfaces
	if strings.HasPrefix(reqOriginClean, "http://localhost") ||
		strings.HasPrefix(reqOriginClean, "https://localhost") ||
		strings.HasPrefix(reqOriginClean, "http://127.0.0.1") ||
		strings.HasPrefix(reqOriginClean, "https://127.0.0.1") {
		return true
	}

	// 2. Private LAN IPs (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
	for _, prefix := range []string{"http://10.", "https://10.", "http://192.168.", "https://192.168."} {
		if strings.HasPrefix(reqOriginClean, prefix) {
			return true
		}
	}
	for i := 16; i <= 31; i++ {
		prefixHTTP := fmt.Sprintf("http://172.%d.", i)
		prefixHTTPS := fmt.Sprintf("https://172.%d.", i)
		if strings.HasPrefix(reqOriginClean, prefixHTTP) || strings.HasPrefix(reqOriginClean, prefixHTTPS) {
			return true
		}
	}

	// 3. ndnworks.com production domains
	if strings.HasSuffix(reqOriginClean, ".ndnworks.com") ||
		reqOriginClean == "https://ndnworks.com" ||
		reqOriginClean == "http://ndnworks.com" {
		return true
	}

	// 4. Configured origins from environment variables
	for _, o := range allowedList {
		cleanO := strings.TrimRight(strings.TrimSpace(o), "/")
		if cleanO == "*" || cleanO == reqOriginClean {
			return true
		}
	}

	return false
}

// CORSMiddleware dynamically handles CORS origin validation, headers, and preflight OPTIONS requests
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		if origin != "" {
			reqOriginClean := strings.TrimRight(strings.TrimSpace(origin), "/")
			allowed := isAllowedOrigin(reqOriginClean, cfg.CORSAllowedOrigins, cfg.AppEnv == "development")

			if allowed {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Credentials", "true")
				c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Store-ID, Idempotency-Key")
				c.Header("Access-Control-Max-Age", "43200")
				c.Header("Vary", "Origin")
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

