package routes

import (
	"os"
	"time"

	"github.com/RabbitPOS/backend/internal/cache"
	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/handlers"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRouter initializes Gin engine with middlewares, auth protection, and API endpoints
func SetupRouter(cfg *config.Config, db *gorm.DB, emailSvc *services.EmailService, sheetsSyncSvc *services.SheetsSyncService, autoTaggingSvc *services.AutoTaggingService) *gin.Engine {
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

	// Instantiate Services
	importerSvc := services.NewImporterService(db)

	// Instantiate In-Memory TTL Caches for high-frequency, low-mutation entities
	catCache := cache.NewTTLCache(5 * time.Minute)
	productCache := cache.NewTTLCache(3 * time.Minute)
	fundCache := cache.NewTTLCache(1 * time.Minute)
	settingCache := cache.NewTTLCache(10 * time.Minute)
	toppingCache := cache.NewTTLCache(5 * time.Minute)

	// Instantiate Handlers with TTL Cache instances
	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, cfg)
	uploadHandler := handlers.NewUploadHandler()
	categoryHandler := handlers.NewCategoryHandler(db, catCache)
	productHandler := handlers.NewProductHandler(db, productCache)
	variantHandler := handlers.NewVariantHandler(db, productCache)
	fundHandler := handlers.NewFundHandler(db, fundCache)
	orderHandler := handlers.NewOrderHandler(db, sheetsSyncSvc, fundCache)
	txHandler := handlers.NewTransactionHandler(db, sheetsSyncSvc, fundCache)
	analyticsHandler := handlers.NewAnalyticsHandler(db, emailSvc)
	settingHandler := handlers.NewSettingHandler(db, emailSvc, settingCache)
	backupHandler := handlers.NewBackupHandler(db)
	importerHandler := handlers.NewImporterHandler(importerSvc)
	toppingHandler := handlers.NewToppingHandler(db, toppingCache)
	promotionHandler := handlers.NewPromotionHandler(db)
	txCategoryHandler := handlers.NewTransactionCategoryHandler(db)
	sheetsSyncHandler := handlers.NewSheetsSyncHandler(sheetsSyncSvc)
	autoTaggingHandler := handlers.NewAutoTaggingHandler(autoTaggingSvc)
	purchaseHandler := handlers.NewPurchaseHandler(db, productCache, toppingCache)

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

			// Ingredients: read list for expense logging autocomplete
			authenticated.GET("/purchases/ingredients", purchaseHandler.ListIngredients)

			// Admin-Only Routes (Management, Financial Ledger, Analytics & Settings Update)
			adminOnly := authenticated.Group("")
			adminOnly.Use(middleware.RequireRole(models.RoleAdmin))
			{
				// Inventory Purchases, Ingredients & Recipe Cost Management
				adminOnly.POST("/purchases/ingredients", purchaseHandler.CreateIngredient)
				adminOnly.PUT("/purchases/ingredients/:id", purchaseHandler.UpdateIngredient)
				adminOnly.DELETE("/purchases/ingredients/:id", purchaseHandler.DeleteIngredient)
				adminOnly.GET("/purchases/ingredients/:id/history", purchaseHandler.GetIngredientHistory)
				adminOnly.GET("/purchases/cost-comparison", purchaseHandler.GetCostComparison)
				adminOnly.POST("/purchases/apply-cost", purchaseHandler.ApplyCostToMenu)
				adminOnly.GET("/purchases/recipes/:target_type/:target_id", purchaseHandler.GetRecipe)
				adminOnly.POST("/purchases/recipes/:target_type/:target_id", purchaseHandler.SaveRecipe)

				// Catalog Management Mutations
				adminOnly.POST("/categories", categoryHandler.CreateCategory)
				adminOnly.PUT("/categories/reorder", categoryHandler.ReorderCategories)
				adminOnly.PUT("/categories/:id", categoryHandler.UpdateCategory)
				adminOnly.DELETE("/categories/:id", categoryHandler.DeleteCategory)

				adminOnly.POST("/products", productHandler.CreateProduct)
				adminOnly.PUT("/products/:id", productHandler.UpdateProduct)
				adminOnly.DELETE("/products/:id", productHandler.DeleteProduct)

				// Automated Product Tagging Engine Endpoints
				adminOnly.GET("/products/auto-tag/config", autoTaggingHandler.GetConfig)
				adminOnly.PUT("/products/auto-tag/config", autoTaggingHandler.SaveConfig)
				adminOnly.POST("/products/auto-tag/preview", autoTaggingHandler.Preview)
				adminOnly.POST("/products/auto-tag/apply", autoTaggingHandler.Apply)
				adminOnly.POST("/products/auto-tag/toggle-lock", autoTaggingHandler.ToggleLock)

				adminOnly.POST("/products/:id/variants", variantHandler.AddVariantToProduct)
				adminOnly.PUT("/variants/:id", variantHandler.UpdateVariant)
				adminOnly.DELETE("/variants/:id", variantHandler.DeleteVariant)

				// Topping Management (admin only writes)
				adminOnly.POST("/toppings", toppingHandler.CreateTopping)
				adminOnly.PUT("/toppings/reorder", toppingHandler.ReorderToppings)
				adminOnly.PUT("/toppings/:id", toppingHandler.UpdateTopping)
				adminOnly.DELETE("/toppings/:id", toppingHandler.DeleteTopping)

				// Promotion Management (admin only CRUD)
				adminOnly.GET("/promotions", promotionHandler.ListPromotions)
				adminOnly.POST("/promotions", promotionHandler.CreatePromotion)
				adminOnly.PUT("/promotions/reorder", promotionHandler.ReorderPromotions)
				adminOnly.PUT("/promotions/:id", promotionHandler.UpdatePromotion)
				adminOnly.DELETE("/promotions/:id", promotionHandler.DeletePromotion)

				// Transaction Category Management (admin only mutations)
				adminOnly.POST("/transaction-categories", txCategoryHandler.CreateCategory)
				adminOnly.PUT("/transaction-categories/reorder", txCategoryHandler.ReorderCategories)
				adminOnly.PUT("/transaction-categories/:id", txCategoryHandler.UpdateCategory)
				adminOnly.POST("/transaction-categories/:id/set-default", txCategoryHandler.SetDefaultCategory)
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

				// Google Sheets Bi-Modal Synchronization Endpoints
				adminOnly.POST("/settings/sheets/test-connection", sheetsSyncHandler.TestConnection)
				adminOnly.POST("/settings/sheets/sync-now", sheetsSyncHandler.SyncNow)
				adminOnly.GET("/settings/sheets/status", sheetsSyncHandler.GetStatus)

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
