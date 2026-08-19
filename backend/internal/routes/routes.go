package routes

import (
	"os"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/handlers"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRouter initializes Gin engine with middlewares, auth protection, and API endpoints
func SetupRouter(cfg *config.Config, db *gorm.DB, emailSvc *services.EmailService) *gin.Engine {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Ensure uploads directory exists on server startup
	_ = os.MkdirAll("./uploads", os.ModePerm)

	// Global CORS Middleware
	router.Use(middleware.CORSMiddleware(cfg))

	// Serve uploaded image assets and brand logo statically
	router.Static("/uploads", "./uploads")
	router.StaticFile("/logo.png", "./uploads/logo.png")
	router.StaticFile("/favicon.ico", "./uploads/logo.png")

	// Instantiate Handlers
	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, cfg)
	uploadHandler := handlers.NewUploadHandler()
	categoryHandler := handlers.NewCategoryHandler(db)
	productHandler := handlers.NewProductHandler(db)
	variantHandler := handlers.NewVariantHandler(db)
	fundHandler := handlers.NewFundHandler(db)
	orderHandler := handlers.NewOrderHandler(db)
	txHandler := handlers.NewTransactionHandler(db)
	analyticsHandler := handlers.NewAnalyticsHandler(db, emailSvc)
	settingHandler := handlers.NewSettingHandler(db, emailSvc)
	backupHandler := handlers.NewBackupHandler(db)
	importerSvc := services.NewImporterService(db)
	importerHandler := handlers.NewImporterHandler(importerSvc)
	toppingHandler := handlers.NewToppingHandler(db)
	promotionHandler := handlers.NewPromotionHandler(db)
	txCategoryHandler := handlers.NewTransactionCategoryHandler(db)

	// API v1 Group
	v1 := router.Group("/api/v1")
	v1.Use(middleware.GzipMiddleware())
	{
		// Public Endpoints
		v1.GET("/health", healthHandler.CheckHealth)
		v1.POST("/auth/login", authHandler.Login)
		v1.POST("/auth/setup-password", authHandler.SetupPassword)

		// Authenticated Routes Group
		authenticated := v1.Group("")
		authenticated.Use(middleware.AuthMiddleware(cfg.JWTSecret))
		{
			// Auth User Session Routes
			authenticated.POST("/auth/logout", authHandler.Logout)
			authenticated.GET("/auth/me", authHandler.GetMe)
			authenticated.POST("/upload", uploadHandler.UploadImage)

			// Staff & Admin Accessible Endpoints (POS Operations, Settings & Active Promotions View)
			authenticated.GET("/categories", categoryHandler.ListCategories)
			authenticated.GET("/products", productHandler.ListProducts)
			authenticated.GET("/products/:id", productHandler.GetProductByID)
			authenticated.GET("/funds", fundHandler.ListFunds)
			authenticated.GET("/funds/:id/balance", fundHandler.GetFundBalance)
			authenticated.GET("/funds/cashier-shift-summary", fundHandler.GetCashierShiftSummary)
			authenticated.GET("/orders", orderHandler.ListOrders)
			authenticated.GET("/orders/:id", orderHandler.GetOrderByID)
			authenticated.POST("/orders", orderHandler.CreateOrder)
			authenticated.POST("/orders/:id/cancel", orderHandler.CancelOrder)
			authenticated.GET("/vietqr/generate", orderHandler.GetVietQR)
			authenticated.GET("/settings", settingHandler.GetSettings)

			// Toppings: public read (for POS variant selector) + admin write
			authenticated.GET("/toppings", toppingHandler.ListToppings)
			authenticated.GET("/toppings/all", toppingHandler.ListAllToppings)

			// Promotions: active list for POS Cart application
			authenticated.GET("/promotions/active", promotionHandler.GetActivePromotions)

			// Transaction Categories: read list for manual transactions
			authenticated.GET("/transaction-categories", txCategoryHandler.ListCategories)

			// Admin-Only Routes (Management, Financial Ledger, Analytics & Settings Update)
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

				// Topping Management (admin only writes)
				adminOnly.POST("/toppings", toppingHandler.CreateTopping)
				adminOnly.PUT("/toppings/:id", toppingHandler.UpdateTopping)
				adminOnly.DELETE("/toppings/:id", toppingHandler.DeleteTopping)

				// Promotion Management (admin only CRUD)
				adminOnly.GET("/promotions", promotionHandler.ListPromotions)
				adminOnly.POST("/promotions", promotionHandler.CreatePromotion)
				adminOnly.PUT("/promotions/:id", promotionHandler.UpdatePromotion)
				adminOnly.DELETE("/promotions/:id", promotionHandler.DeletePromotion)

				// Transaction Category Management (admin only mutations)
				adminOnly.POST("/transaction-categories", txCategoryHandler.CreateCategory)
				adminOnly.PUT("/transaction-categories/:id", txCategoryHandler.UpdateCategory)
				adminOnly.DELETE("/transaction-categories/:id", txCategoryHandler.DeleteCategory)

				// Fund Reconciliation & Periodic Balance Summary
				adminOnly.POST("/funds/:id/reconcile", fundHandler.ReconcileFund)
				adminOnly.GET("/funds/period-summary", fundHandler.GetPeriodSummary)

				// Financial Ledger Transactions & Category Breakdown
				adminOnly.GET("/transactions", txHandler.ListTransactions)
				adminOnly.POST("/transactions", txHandler.CreateTransaction)
				adminOnly.PUT("/transactions/:id", txHandler.UpdateTransaction)
				adminOnly.DELETE("/transactions/:id", txHandler.DeleteTransaction)
				adminOnly.GET("/transactions/category-breakdown", txHandler.GetCategoryBreakdown)

				// Executive Analytics & BI Dashboards
				adminOnly.GET("/analytics/revenue", analyticsHandler.GetRevenueAnalytics)
				adminOnly.GET("/analytics/profit", analyticsHandler.GetProfitAnalytics)
				adminOnly.GET("/analytics/products-ranking", analyticsHandler.GetProductsRanking)
				adminOnly.GET("/analytics/products-sales-performance", analyticsHandler.GetProductsSalesPerformance)
				adminOnly.GET("/analytics/dashboard", analyticsHandler.GetDashboardMetrics)
				adminOnly.GET("/analytics/top-products", analyticsHandler.GetTopProducts)
				adminOnly.GET("/analytics/cash-flow", analyticsHandler.GetCashFlowSummary)
				// On-demand financial email report dispatcher
				adminOnly.POST("/analytics/send-daily-report-email", analyticsHandler.SendDailyReportEmail)

				// Settings Management
				adminOnly.PUT("/settings", settingHandler.UpdateSettings)
				// SMTP connectivity test
				adminOnly.POST("/settings/test-smtp", settingHandler.TestSMTP)

				// Database Manual Backup & Restore
				adminOnly.GET("/backup/export", backupHandler.ExportBackup)
				adminOnly.POST("/backup/restore", backupHandler.RestoreBackup)

				// Data Import Engine (Excel & CSV)
				adminOnly.GET("/import/template", importerHandler.DownloadTemplate)
				adminOnly.POST("/import/excel", importerHandler.ImportData)
			}
		}
	}

	return router
}
