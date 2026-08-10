package database

import (
	"log"
	"time"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
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

	// Auto-migrate domain models
	err = db.AutoMigrate(
		&models.Category{},
		&models.Product{},
		&models.ProductVariant{},
		&models.VariantGroup{},
		&models.Fund{},
		&models.Order{},
		&models.OrderItem{},
		&models.Transaction{},
		&models.User{},
	)
	if err != nil {
		log.Printf("Warning: Failed during DB auto-migration: %v", err)
		return nil, err
	}

	log.Println("Database auto-migration completed successfully")

	// Seed default accounts if users table is empty
	seedUsers(db)

	return db, nil
}

func seedUsers(db *gorm.DB) {
	var count int64
	db.Model(&models.User{}).Count(&count)
	if count == 0 {
		log.Println("Seeding default admin and staff accounts...")

		adminHash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		staffHash, _ := bcrypt.GenerateFromPassword([]byte("staff123"), bcrypt.DefaultCost)

		admin := models.User{
			Username:     "admin",
			PasswordHash: string(adminHash),
			Role:         models.RoleAdmin,
			IsActive:     true,
		}

		staff := models.User{
			Username:     "staff",
			PasswordHash: string(staffHash),
			Role:         models.RoleStaff,
			IsActive:     true,
		}

		db.Create(&admin)
		db.Create(&staff)
		log.Println("Default user accounts ('admin' & 'staff') created successfully.")
	}
}
