package handlers

import (
	"net/http"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type HealthHandler struct {
	db *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

// CheckHealth provides health check status of server and database
func (h *HealthHandler) CheckHealth(c *gin.Context) {
	dbConnected := false
	if h.db != nil {
		sqlDB, err := h.db.DB()
		if err == nil && sqlDB.Ping() == nil {
			dbConnected = true
		}
	}

	models.SendSuccess(c, http.StatusOK, gin.H{
		"app":          "RabbitPOS API",
		"version":      "1.0.0",
		"db_connected": dbConnected,
	}, "Service is healthy")
}
