package database

import (
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB initializes GORM PostgreSQL connection and executes schema migrations
func InitDB(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetDSN()

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	var db *gorm.DB
	var err error

	// Retry connection up to 5 times for containerized startup synchronization
	for i := 1; i <= 5; i++ {
		db, err = gorm.Open(postgres.Open(dsn), gormConfig)
		if err == nil {
			break
		}
		log.Printf("Failed to connect to PostgreSQL (attempt %d/5): %v. Retrying in 2s...", i, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, err
	}

	log.Println("Successfully connected to PostgreSQL database")

	// Perform auto-migration for catalog domain models
	err = db.AutoMigrate(
		&models.Category{},
		&models.Product{},
		&models.ProductVariant{},
		&models.VariantGroup{},
	)
	if err != nil {
		log.Printf("Warning: Failed during DB auto-migration: %v", err)
		return nil, err
	}

	log.Println("Database auto-migration completed successfully")
	return db, nil
}
