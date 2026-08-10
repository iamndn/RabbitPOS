package main

import (
	"log"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/database"
	"github.com/RabbitPOS/backend/internal/routes"
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

	// Setup HTTP Router
	router := routes.SetupRouter(cfg, db)

	// Start Server
	serverAddr := ":" + cfg.Port
	log.Printf("RabbitPOS API Server listening on http://localhost%s", serverAddr)
	if err := router.Run(serverAddr); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
}
