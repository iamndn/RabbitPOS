package routes

import (
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/handlers"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRouter initializes Gin engine with middlewares, auth protection, and API endpoints
func SetupRouter(cfg *config.Config, db *gorm.DB) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// CORS Configuration
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}

	// Check if wildcard "*" is in allowed origins
	allowAll := false
	for _, origin := range cfg.CORSAllowedOrigins {
		if origin == "*" {
			allowAll = true
			break
		}
	}

	if allowAll {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			return true
		}
	} else {
		corsConfig.AllowOriginFunc = func(origin string) bool {
			for _, allowed := range cfg.CORSAllowedOrigins {
				if allowed == origin {
					return true
				}
			}
			return false
		}
	}

	router.Use(cors.New(corsConfig))

	// Instantiate Handlers
	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, cfg)
	categoryHandler := handlers.NewCategoryHandler(db)
	productHandler := handlers.NewProductHandler(db)
	variantHandler := handlers.NewVariantHandler(db)
	fundHandler := handlers.NewFundHandler(db)
	orderHandler := handlers.NewOrderHandler(db)
	txHandler := handlers.NewTransactionHandler(db)
	analyticsHandler := handlers.NewAnalyticsHandler(db)

	// API v1 Group
	v1 := router.Group("/api/v1")
	{
		// Public Endpoints
		v1.GET("/health", healthHandler.CheckHealth)
		v1.POST("/auth/login", authHandler.Login)

		// Authenticated Routes Group
		authenticated := v1.Group("")
		authenticated.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Auth User Session Routes
			authenticated.POST("/auth/logout", authHandler.Logout)
			authenticated.GET("/auth/me", authHandler.GetMe)

			// Staff & Admin Accessible Endpoints (POS Operations)
			authenticated.GET("/categories", categoryHandler.ListCategories)
			authenticated.GET("/products", productHandler.ListProducts)
			authenticated.GET("/products/:id", productHandler.GetProductByID)
			authenticated.GET("/funds", fundHandler.ListFunds)
			authenticated.GET("/funds/:id/balance", fundHandler.GetFundBalance)
			authenticated.GET("/orders", orderHandler.ListOrders)
			authenticated.GET("/orders/:id", orderHandler.GetOrderByID)
			authenticated.POST("/orders", orderHandler.CreateOrder)
			authenticated.GET("/vietqr/generate", orderHandler.GetVietQR)

			// Admin-Only Routes (Management, Financial Ledger & Analytics)
			adminOnly := authenticated.Group("")
			adminOnly.Use(middleware.RequireRole(models.RoleAdmin))
			{
				// Catalog Management Mutations
				adminOnly.POST("/categories", categoryHandler.CreateCategory)
				adminOnly.PUT("/categories/:id", categoryHandler.UpdateCategory)
				adminOnly.DELETE("/categories/:id", categoryHandler.DeleteCategory)

				adminOnly.POST("/products", productHandler.CreateProduct)
				adminOnly.PUT("/products/:id", productHandler.UpdateProduct)
				adminOnly.DELETE("/products/:id", productHandler.DeleteProduct)

				adminOnly.POST("/products/:id/variants", variantHandler.AddVariantToProduct)
				adminOnly.PUT("/variants/:id", variantHandler.UpdateVariant)
				adminOnly.DELETE("/variants/:id", variantHandler.DeleteVariant)

				// Fund Reconciliation
				adminOnly.POST("/funds/:id/reconcile", fundHandler.ReconcileFund)

				// Financial Ledger Transactions
				adminOnly.GET("/transactions", txHandler.ListTransactions)
				adminOnly.POST("/transactions", txHandler.CreateTransaction)

				// Executive Analytics
				adminOnly.GET("/analytics/dashboard", analyticsHandler.GetDashboardMetrics)
				adminOnly.GET("/analytics/top-products", analyticsHandler.GetTopProducts)
				adminOnly.GET("/analytics/cash-flow", analyticsHandler.GetCashFlowSummary)
			}
		}
	}

	return router
}
