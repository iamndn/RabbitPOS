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

	// Global CORS & Structured Logging Middleware
	router.Use(middleware.CORSMiddleware(cfg))
	router.Use(middleware.StructuredLoggerMiddleware())

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

	// Audit & Rate Limiting Services
	auditSvc := services.NewAuditService(db)
	loginRateLimiter := middleware.NewMemoryRateLimiter(5, 1*time.Minute)

	// Instantiate Handlers with TTL Cache instances
	healthHandler := handlers.NewHealthHandler(db)
	authHandler := handlers.NewAuthHandler(db, cfg, loginRateLimiter, auditSvc)
	uploadHandler := handlers.NewUploadHandler()
	categoryHandler := handlers.NewCategoryHandler(db, catCache)
	productHandler := handlers.NewProductHandler(db, productCache)
	variantHandler := handlers.NewVariantHandler(db, productCache)
	fundHandler := handlers.NewFundHandler(db, fundCache)
	orderHandler := handlers.NewOrderHandler(db, sheetsSyncSvc, fundCache)
	txHandler := handlers.NewTransactionHandler(db, sheetsSyncSvc, fundCache)
	analyticsHandler := handlers.NewAnalyticsHandler(db, emailSvc)
	settingHandler := handlers.NewSettingHandler(db, emailSvc, settingCache, auditSvc)
	backupHandler := handlers.NewBackupHandler(db, catCache, productCache, fundCache, settingCache, toppingCache)
	importerHandler := handlers.NewImporterHandler(importerSvc)
	toppingHandler := handlers.NewToppingHandler(db, toppingCache)
	promotionHandler := handlers.NewPromotionHandler(db)
	txCategoryHandler := handlers.NewTransactionCategoryHandler(db)
	sheetsSyncHandler := handlers.NewSheetsSyncHandler(sheetsSyncSvc)
	autoTaggingHandler := handlers.NewAutoTaggingHandler(autoTaggingSvc)
	purchaseHandler := handlers.NewPurchaseHandler(db, productCache, toppingCache)
	storeHandler := handlers.NewStoreHandler(db, cfg, auditSvc)
	userHandler := handlers.NewUserHandler(db, auditSvc)

	// API v1 Group
	v1 := router.Group("/api/v1")
	v1.Use(middleware.GzipMiddleware())
	{
		// Public Endpoints
		v1.GET("/health", healthHandler.CheckHealth)
		v1.POST("/auth/login", middleware.LoginRateLimiterMiddleware(loginRateLimiter), authHandler.Login)
		v1.POST("/auth/register", middleware.LoginRateLimiterMiddleware(loginRateLimiter), authHandler.Register)
		v1.POST("/auth/setup-password", authHandler.SetupPassword)

		// Authenticated Routes Group
		authenticated := v1.Group("")
		authenticated.Use(middleware.AuthMiddleware(cfg.JWTSecret, db))
		{
			// Auth User Session Routes (Platform - no store header required)
			authenticated.POST("/auth/logout", authHandler.Logout)
			authenticated.GET("/auth/me", authHandler.GetMe)

			// User Management Routes (Accessible by Master & Owner)
			userGroup := authenticated.Group("/users")
			userGroup.Use(middleware.RequireRole(models.RoleMaster, models.RoleOwner))
			{
				userGroup.GET("", userHandler.ListUsers)
				userGroup.POST("", userHandler.CreateUser)
				userGroup.GET("/:id", userHandler.GetUserByID)
				userGroup.PUT("/:id", middleware.RequireOwnershipOrMaster(db), userHandler.UpdateUser)
				userGroup.PUT("/:id/toggle-status", middleware.RequireOwnershipOrMaster(db), userHandler.ToggleUserStatus)
				userGroup.DELETE("/:id", middleware.RequireOwnershipOrMaster(db), userHandler.DeleteUser)
			}

			// Multi-store management (Platform)
			authenticated.GET("/stores", storeHandler.ListStores)
			masterAdmin := authenticated.Group("")
			masterAdmin.Use(middleware.RequireRole(models.RoleMaster))
			{
				masterAdmin.POST("/stores", storeHandler.CreateStore)
				masterAdmin.PUT("/stores/:id", storeHandler.UpdateStore)
				masterAdmin.GET("/stores/:id/members", storeHandler.ListMembers)
				masterAdmin.PUT("/stores/:id/members", storeHandler.UpsertMember)
				masterAdmin.DELETE("/stores/:id/members/:user_id", storeHandler.RemoveMember)

				// Platform-wide backup & restore (Master only)
				masterAdmin.GET("/backup/export", backupHandler.ExportBackup)
				masterAdmin.POST("/backup/preview", backupHandler.PreviewBackup)
				masterAdmin.POST("/backup/restore", backupHandler.RestoreBackup)

				// Cross-store executive overview
				masterAdmin.GET("/analytics/overview-all-stores", analyticsHandler.GetOverviewAllStores)
			}

			// Store-Scoped Routes Group (wrapped with StoreContext)
			storeScoped := authenticated.Group("")
			storeScoped.Use(middleware.StoreContext(db, settingCache, cfg.StoreHeaderRequired))
			{
				storeScoped.POST("/upload", uploadHandler.UploadImage)

				// Staff & Admin Accessible Endpoints (POS Operations, Store Settings & Active Promotions View)
				storeScoped.GET("/categories", categoryHandler.ListCategories)
				storeScoped.GET("/products", productHandler.ListProducts)
				storeScoped.GET("/products/:id", productHandler.GetProductByID)
				storeScoped.GET("/funds", fundHandler.ListFunds)
				storeScoped.GET("/funds/:id/balance", fundHandler.GetFundBalance)
				storeScoped.GET("/funds/cashier-shift-summary", fundHandler.GetCashierShiftSummary)
				storeScoped.GET("/orders", orderHandler.ListOrders)
				storeScoped.GET("/orders/:id", orderHandler.GetOrderByID)
				storeScoped.POST("/orders", orderHandler.CreateOrder)
				storeScoped.GET("/vietqr/generate", orderHandler.GetVietQR)
				storeScoped.GET("/settings/store", settingHandler.GetStoreSettings)

				// Safe read-only revenue & hourly analytics for Dashboard
				storeScoped.GET("/analytics/revenue", analyticsHandler.GetRevenueAnalytics)
				storeScoped.GET("/analytics/hourly-distribution", analyticsHandler.GetHourlyDistribution)

				// Toppings: read for POS variant selector
				storeScoped.GET("/toppings", toppingHandler.ListToppings)
				storeScoped.GET("/toppings/all", toppingHandler.ListAllToppings)

				// Promotions: active list for POS Cart application
				storeScoped.GET("/promotions/active", promotionHandler.GetActivePromotions)

				// Transaction Categories: read list for manual transactions
				storeScoped.GET("/transaction-categories", txCategoryHandler.ListCategories)

				// Ingredients: read list for expense logging autocomplete
				storeScoped.GET("/purchases/ingredients", purchaseHandler.ListIngredients)

				// Financial Ledger Transactions (List & Create operational expenses allowed for staff)
				storeScoped.GET("/transactions", txHandler.ListTransactions)
				storeScoped.POST("/transactions", txHandler.CreateTransaction)
				storeScoped.GET("/transactions/category-breakdown", txHandler.GetCategoryBreakdown)

				// Store Admin Routes (Management, Financial Ledger, Analytics & Settings Update)
				storeAdmin := storeScoped.Group("")
				storeAdmin.Use(middleware.RequireStoreRole(models.StoreRoleStoreAdmin))
				{
					// Inventory Purchases, Ingredients & Recipe Cost Management
					storeAdmin.POST("/purchases/ingredients", purchaseHandler.CreateIngredient)
					storeAdmin.PUT("/purchases/ingredients/:id", purchaseHandler.UpdateIngredient)
					storeAdmin.DELETE("/purchases/ingredients/:id", purchaseHandler.DeleteIngredient)
					storeAdmin.GET("/purchases/ingredients/:id/history", purchaseHandler.GetIngredientHistory)
					storeAdmin.GET("/purchases/history", purchaseHandler.GetAllPurchaseHistory)
					storeAdmin.GET("/purchases/cost-comparison", purchaseHandler.GetCostComparison)
					storeAdmin.POST("/purchases/apply-cost", purchaseHandler.ApplyCostToMenu)
					storeAdmin.GET("/purchases/recipes/:target_type/:target_id", purchaseHandler.GetRecipe)
					storeAdmin.POST("/purchases/recipes/:target_type/:target_id", purchaseHandler.SaveRecipe)

					// Catalog Management Mutations
					storeAdmin.POST("/categories", categoryHandler.CreateCategory)
					storeAdmin.PUT("/categories/reorder", categoryHandler.ReorderCategories)
					storeAdmin.PUT("/categories/:id", categoryHandler.UpdateCategory)
					storeAdmin.DELETE("/categories/:id", categoryHandler.DeleteCategory)

					storeAdmin.POST("/products", productHandler.CreateProduct)
					storeAdmin.PUT("/products/:id", productHandler.UpdateProduct)
					storeAdmin.DELETE("/products/:id", productHandler.DeleteProduct)

					// Automated Product Tagging Engine Endpoints
					storeAdmin.GET("/products/auto-tag/config", autoTaggingHandler.GetConfig)
					storeAdmin.PUT("/products/auto-tag/config", autoTaggingHandler.SaveConfig)
					storeAdmin.POST("/products/auto-tag/preview", autoTaggingHandler.Preview)
					storeAdmin.POST("/products/auto-tag/apply", autoTaggingHandler.Apply)
					storeAdmin.POST("/products/auto-tag/toggle-lock", autoTaggingHandler.ToggleLock)

					storeAdmin.POST("/products/:id/variants", variantHandler.AddVariantToProduct)
					storeAdmin.PUT("/variants/:id", variantHandler.UpdateVariant)
					storeAdmin.DELETE("/variants/:id", variantHandler.DeleteVariant)

					// Topping Management (admin only writes)
					storeAdmin.POST("/toppings", toppingHandler.CreateTopping)
					storeAdmin.PUT("/toppings/reorder", toppingHandler.ReorderToppings)
					storeAdmin.PUT("/toppings/:id", toppingHandler.UpdateTopping)
					storeAdmin.DELETE("/toppings/:id", toppingHandler.DeleteTopping)

					// Promotion Management (admin only CRUD)
					storeAdmin.GET("/promotions", promotionHandler.ListPromotions)
					storeAdmin.POST("/promotions", promotionHandler.CreatePromotion)
					storeAdmin.PUT("/promotions/reorder", promotionHandler.ReorderPromotions)
					storeAdmin.PUT("/promotions/:id", promotionHandler.UpdatePromotion)
					storeAdmin.DELETE("/promotions/:id", promotionHandler.DeletePromotion)

					// Transaction Category Management (admin only mutations)
					storeAdmin.POST("/transaction-categories", txCategoryHandler.CreateCategory)
					storeAdmin.PUT("/transaction-categories/reorder", txCategoryHandler.ReorderCategories)
					storeAdmin.PUT("/transaction-categories/:id", txCategoryHandler.UpdateCategory)
					storeAdmin.POST("/transaction-categories/:id/set-default", txCategoryHandler.SetDefaultCategory)
					storeAdmin.DELETE("/transaction-categories/:id", txCategoryHandler.DeleteCategory)

					// Fund Reconciliation & Periodic Balance Summary
					storeAdmin.POST("/funds/:id/reconcile", fundHandler.ReconcileFund)
					storeAdmin.PUT("/funds/:id/reconcile", fundHandler.UpdateReconciliation)
					storeAdmin.DELETE("/funds/:id/reconcile/latest", fundHandler.DeleteLatestReconciliation)
					storeAdmin.DELETE("/funds/:id/reconcile", fundHandler.DeleteLatestReconciliation)
					storeAdmin.POST("/funds/:id/reconcile/restore", fundHandler.RestorePreviousReconciliation)
					storeAdmin.GET("/funds/:id/reconcile/history", fundHandler.GetReconciliationHistory)
					storeAdmin.GET("/funds/period-summary", fundHandler.GetPeriodSummary)

					// Financial Ledger Transactions (Update & Delete restricted to store_admin / master)
					storeAdmin.PUT("/transactions/:id", txHandler.UpdateTransaction)
					storeAdmin.DELETE("/transactions/:id", txHandler.DeleteTransaction)

					// Executive Analytics & BI Dashboards
					storeAdmin.GET("/analytics/profit", analyticsHandler.GetProfitAnalytics)
					storeAdmin.GET("/analytics/products-ranking", analyticsHandler.GetProductsRanking)
					storeAdmin.GET("/analytics/products-sales-performance", analyticsHandler.GetProductsSalesPerformance)
					storeAdmin.GET("/analytics/dashboard", analyticsHandler.GetDashboardMetrics)
					storeAdmin.GET("/analytics/top-products", analyticsHandler.GetTopProducts)
					storeAdmin.GET("/analytics/cash-flow", analyticsHandler.GetCashFlowSummary)
					// On-demand financial email report dispatcher
					storeAdmin.POST("/analytics/send-daily-report-email", analyticsHandler.SendDailyReportEmail)

					// Order Cancellation & Deletion (Admin Only)
					storeAdmin.POST("/orders/:id/cancel", orderHandler.CancelOrder)
					storeAdmin.DELETE("/orders/:id", orderHandler.DeleteOrder)

					// Settings Management
					storeAdmin.GET("/settings/admin", settingHandler.GetSettings)
					storeAdmin.GET("/settings", settingHandler.GetSettings)
					storeAdmin.PUT("/settings", settingHandler.UpdateSettings)
					// SMTP connectivity test (Master only)
					storeAdmin.POST("/settings/test-smtp", middleware.RequireRole(models.RoleMaster), settingHandler.TestSMTP)

					// Google Sheets Bi-Modal Synchronization Endpoints
					storeAdmin.POST("/settings/sheets/test-connection", sheetsSyncHandler.TestConnection)
					storeAdmin.POST("/settings/sheets/sync-now", sheetsSyncHandler.SyncNow)
					storeAdmin.GET("/settings/sheets/status", sheetsSyncHandler.GetStatus)

					// Data Import Engine (Excel & CSV)
					storeAdmin.GET("/import/template", importerHandler.DownloadTemplate)
					storeAdmin.POST("/import/excel", importerHandler.ImportData)
				}
			}
		}
	}

	return router
}
