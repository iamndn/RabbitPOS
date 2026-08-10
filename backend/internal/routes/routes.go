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

	// Instantiate Handlers
	healthHandler := handlers.NewHealthHandler(db)
	categoryHandler := handlers.NewCategoryHandler(db)
	productHandler := handlers.NewProductHandler(db)
	variantHandler := handlers.NewVariantHandler(db)

	// API v1 Group
	v1 := router.Group("/api/v1")
	{
		// Health Endpoint
		v1.GET("/health", healthHandler.CheckHealth)

		// Category Endpoints
		v1.GET("/categories", categoryHandler.ListCategories)
		v1.POST("/categories", categoryHandler.CreateCategory)
		v1.PUT("/categories/:id", categoryHandler.UpdateCategory)
		v1.DELETE("/categories/:id", categoryHandler.DeleteCategory)

		// Product Endpoints
		v1.GET("/products", productHandler.ListProducts)
		v1.GET("/products/:id", productHandler.GetProductByID)
		v1.POST("/products", productHandler.CreateProduct)
		v1.PUT("/products/:id", productHandler.UpdateProduct)
		v1.DELETE("/products/:id", productHandler.DeleteProduct)

		// Product Variant Endpoints
		v1.POST("/products/:id/variants", variantHandler.AddVariantToProduct)
		v1.PUT("/variants/:id", variantHandler.UpdateVariant)
		v1.DELETE("/variants/:id", variantHandler.DeleteVariant)
	}

	return router
}
