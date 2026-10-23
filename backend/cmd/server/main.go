package main

import (
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/routes"
	"github.com/RabbitPOS/backend/internal/services"
	"gorm.io/gorm"
)

func main() {
	log.Println("Starting RabbitPOS Backend Server...")

	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database connection
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Printf("Warning: Database initialization error: %v. Running in degraded mode without DB connection.", err)
	}

	// Initialize Email, Google Sheets & Auto-Tagging Services
	emailSvc := services.NewEmailService(db)
	sheetsSyncSvc := services.NewSheetsSyncService(db)
	autoTaggingSvc := services.NewAutoTaggingService(db, nil)

	// Start the automated daily report scheduler in the background
	go startDailyReportScheduler(db, emailSvc, sheetsSyncSvc, autoTaggingSvc)

	// Setup HTTP Router
	router := routes.SetupRouter(cfg, db, emailSvc, sheetsSyncSvc, autoTaggingSvc)

	// Start Server
	serverAddr := ":" + cfg.Port
	log.Printf("RabbitPOS API Server listening on http://localhost%s", serverAddr)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
}

// startDailyReportScheduler ticks every 60 seconds, iterates all active stores,
// respects each store's configured timezone and per-store daily_report_time setting,
// and fires SendDailyFinancialReportForStore, SyncAllToGoogleSheetsForStore, and
// RunNightlyJobForStore once per day per store.
func startDailyReportScheduler(db *gorm.DB, emailSvc *services.EmailService, sheetsSyncSvc *services.SheetsSyncService, autoTaggingSvc *services.AutoTaggingService) {
	log.Println("[Scheduler] Multi-store daily email report, Google Sheets sync & Auto-Tagging scheduler started")

	// Track the last date we fired the report per store: map[storeID]YYYY-MM-DD
	lastFiredByStore := make(map[uint]string)

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for now := range ticker.C {
		if db == nil {
			continue
		}

		var activeStores []models.Store
		if err := db.Where("is_active = ?", true).Order("id ASC").Find(&activeStores).Error; err != nil {
			log.Printf("[Scheduler] ERROR querying active stores: %v", err)
			continue
		}

		for _, store := range activeStores {
			storeID := store.ID
			storeName := store.Name

			// Determine store location
			tz := store.Timezone
			if tz == "" {
				tz = "Asia/Ho_Chi_Minh"
			}
			loc, err := time.LoadLocation(tz)
			if err != nil {
				loc = time.Local
			}
			storeNow := now.In(loc)
			todayKey := storeNow.Format("2006-01-02")

			// Check if already fired today for this store
			if lastFiredByStore[storeID] == todayKey {
				continue
			}

			// Read per-store report closing time
			configuredTime := emailSvc.GetDailyReportTimeForStore(storeID) // e.g. "22:30"
			if len(configuredTime) != 5 {
				configuredTime = "22:30"
			}

			currentHHMM := storeNow.Format("15:04")

			// Fire when the current minute matches or is within the target minute window
			if currentHHMM >= configuredTime && currentHHMM <= configuredTime[:3]+"59" {
				lastFiredByStore[storeID] = todayKey
				log.Printf("[Scheduler] Triggering automated nightly closing jobs for store %d (%s) on %s at %s (%s)",
					storeID, storeName, todayKey, currentHHMM, tz)

				// 1. Send Daily Email Report if enabled for this store
				if emailSvc.IsDailyReportEnabledForStore(storeID) {
					go func(sid uint, sName string, reportDate time.Time) {
						if err := emailSvc.SendDailyFinancialReportForStore(reportDate, "AutoScheduler", nil, sid); err != nil {
							log.Printf("[Scheduler] ERROR sending daily report for store %d (%s) on %s: %v",
								sid, sName, reportDate.Format("2006-01-02"), err)
						} else {
							log.Printf("[Scheduler] Daily report for store %d (%s) on %s sent successfully",
								sid, sName, reportDate.Format("2006-01-02"))
						}
					}(storeID, storeName, storeNow)
				}

				// 2. Perform Full Google Sheets Sync if enabled for this store
				if sheetsSyncSvc.IsSyncEnabledForStore(storeID) {
					go func(sid uint, sName string, reportDate time.Time) {
						log.Printf("[Scheduler] Triggering nightly Google Sheets full sync for store %d (%s)", sid, sName)
						if err := sheetsSyncSvc.SyncAllToGoogleSheetsForStore(sid); err != nil {
							log.Printf("[Scheduler] ERROR in nightly Google Sheets sync for store %d (%s): %v", sid, sName, err)
						} else {
							log.Printf("[Scheduler] Nightly Google Sheets sync for store %d (%s) completed successfully", sid, sName)
						}
					}(storeID, storeName, storeNow)
				}

				// 3. Perform Automated Product Auto-Tagging Recalculation for this store
				go func(sid uint, sName string) {
					if err := autoTaggingSvc.RunNightlyJobForStore(sid); err != nil {
						log.Printf("[Scheduler] ERROR in nightly auto-tagging for store %d (%s): %v", sid, sName, err)
					}
				}(storeID, storeName)
			}
		}
	}
}
