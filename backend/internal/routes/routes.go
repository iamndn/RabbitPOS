package routes

import (
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/handlers"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRouter initializes Gin engine with middlewares and API endpoints
func SetupRouter(cfg *config.Config, db *gorm.DB) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS Configuration
	router.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSAllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API v1 Group
	v1 := router.Group("/api/v1")
	{
		healthHandler := handlers.NewHealthHandler(db)
		v1.GET("/health", healthHandler.CheckHealth)

		categoryHandler := handlers.NewCategoryHandler(db)
		v1.GET("/categories", categoryHandler.ListCategories)
		v1.POST("/categories", categoryHandler.CreateCategory)
	}

	return router
}
