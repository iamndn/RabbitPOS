package main

import (
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
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

	// Initialize Email Service
	emailSvc := services.NewEmailService(db)

	// Start the automated daily report scheduler in the background
	go startDailyReportScheduler(db, emailSvc)

	// Setup HTTP Router
	router := routes.SetupRouter(cfg, db, emailSvc)

	// Start Server
	serverAddr := ":" + cfg.Port
	log.Printf("RabbitPOS API Server listening on http://localhost%s", serverAddr)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
}

// startDailyReportScheduler ticks every 60 seconds, compares current time to
// the configured daily_report_time setting, and fires SendDailyFinancialReport
// exactly once per day when the time window is reached.
func startDailyReportScheduler(db *gorm.DB, emailSvc *services.EmailService) {
	log.Println("[Scheduler] Daily email report scheduler started")

	// Track the last date we fired the report to prevent duplicate sends
	lastFiredDate := ""

	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for now := range ticker.C {
		// Skip if daily report is disabled
		if !emailSvc.IsDailyReportEnabled() {
			continue
		}

		configuredTime := emailSvc.GetDailyReportTime() // e.g. "22:30"
		todayKey := now.Format("2006-01-02")            // e.g. "2026-08-19"

		// Already sent today — skip
		if lastFiredDate == todayKey {
			continue
		}

		// Parse the configured HH:MM
		if len(configuredTime) != 5 {
			continue
		}
		currentHHMM := now.Format("15:04")

		// Fire when the current minute matches or is just past the target minute
		if currentHHMM >= configuredTime && currentHHMM <= configuredTime[:3]+"59" {
			lastFiredDate = todayKey
			log.Printf("[Scheduler] Triggering automated daily report for %s at %s", todayKey, currentHHMM)

			go func(reportDate time.Time) {
				if err := emailSvc.SendDailyFinancialReport(reportDate, "AutoScheduler", nil); err != nil {
					log.Printf("[Scheduler] ERROR sending daily report for %s: %v", reportDate.Format("2006-01-02"), err)
				} else {
					log.Printf("[Scheduler] Daily report for %s sent successfully", reportDate.Format("2006-01-02"))
				}
			}(now)
		}
	}
}
