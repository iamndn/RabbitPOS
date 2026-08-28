package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
)

type rateLimitEntry struct {
	attempts    int
	windowStart time.Time
}

// MemoryRateLimiter implements an in-memory sliding-window limiter for login attempts
type MemoryRateLimiter struct {
	mu          sync.Mutex
	entries     map[string]*rateLimitEntry
	maxAttempts int
	window      time.Duration
}

func NewMemoryRateLimiter(maxAttempts int, window time.Duration) *MemoryRateLimiter {
	limiter := &MemoryRateLimiter{
		entries:     make(map[string]*rateLimitEntry),
		maxAttempts: maxAttempts,
		window:      window,
	}

	// Periodic cleanup of expired entries
	go func() {
		ticker := time.NewTicker(2 * window)
		for range ticker.C {
			limiter.mu.Lock()
			now := time.Now()
			for k, v := range limiter.entries {
				if now.Sub(v.windowStart) > limiter.window {
					delete(limiter.entries, k)
				}
			}
			limiter.mu.Unlock()
		}
	}()

	return limiter
}

// IsAllowed checks if the given key has remaining quota
func (l *MemoryRateLimiter) IsAllowed(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	entry, exists := l.entries[key]
	if !exists || now.Sub(entry.windowStart) > l.window {
		return true
	}

	return entry.attempts < l.maxAttempts
}

// RecordFailure increments the failure count for a key
func (l *MemoryRateLimiter) RecordFailure(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	entry, exists := l.entries[key]
	if !exists || now.Sub(entry.windowStart) > l.window {
		l.entries[key] = &rateLimitEntry{
			attempts:    1,
			windowStart: now,
		}
		return
	}

	entry.attempts++
}

// Reset clears failure records upon successful login
func (l *MemoryRateLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

// GetClientIP extracts the real client IP accounting for reverse proxies (Cloudflare, Nginx)
func GetClientIP(c *gin.Context) string {
	// Check CF-Connecting-IP (Cloudflare)
	if cfIP := c.GetHeader("CF-Connecting-IP"); cfIP != "" {
		return strings.TrimSpace(cfIP)
	}

	// Check X-Real-IP
	if realIP := c.GetHeader("X-Real-IP"); realIP != "" {
		return strings.TrimSpace(realIP)
	}

	// Check X-Forwarded-For (first IP in comma list)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	return c.ClientIP()
}

// LoginRateLimiterMiddleware enforces rate limiting per IP before reaching login handler
func LoginRateLimiterMiddleware(limiter *MemoryRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := GetClientIP(c)
		ipKey := "ip:" + ip

		if !limiter.IsAllowed(ipKey) {
			c.Header("Retry-After", "60")
			models.SendErrorCode(c, http.StatusTooManyRequests, "AUTH_RATE_LIMITED", "Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau 1 phút.")
			c.Abort()
			return
		}

		c.Next()
	}
}
