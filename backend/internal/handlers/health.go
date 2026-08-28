package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var serverStartTime = time.Now()

type HealthHandler struct {
	db *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// CheckHealth provides comprehensive health check status, latency, memory telemetry and feature flags
func (h *HealthHandler) CheckHealth(c *gin.Context) {
	dbConnected := false
	var dbLatencyMs int64 = -1

	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err == nil {
			pingStart := time.Now()
			if sqlDB.Ping() == nil {
				dbConnected = true
				dbLatencyMs = time.Since(pingStart).Milliseconds()
			}
		}
	}

	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	uptimeSeconds := int64(time.Since(serverStartTime).Seconds())

	status := "healthy"
	if !dbConnected {
		status = "degraded"
	}

	models.SendSuccess(c, http.StatusOK, gin.H{
		"app":            "RabbitPOS API",
		"version":        "1.0.0",
		"status":         status,
		"uptime_seconds": uptimeSeconds,
		"db_connected":   dbConnected,
		"db_latency_ms":  dbLatencyMs,
		"memory_alloc_mb": float64(m.Alloc) / 1024 / 1024,
		"goroutines":     runtime.NumGoroutine(),
		"feature_flags": gin.H{
			"server_pricing_enforced": true,
			"offline_catalog":         true,
			"offline_orders":          true,
			"idempotency_v2":          true,
			"backup_v2":               true,
		},
	}, "Health check completed")
}
