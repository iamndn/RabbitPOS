package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all backend configuration values
type Config struct {
	Port               string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	AppEnv             string
	JWTSecret          string
	JWTExpiryHours     int
	CORSAllowedOrigins []string

	// Seeding control: if true, demo catalog data is inserted on first run
	EnableSeeding bool

	// Initial admin account credentials injected from environment
	InitialAdminUsername string
	InitialAdminPassword string

	// Initial staff account credentials (optional, only seeded in development)
	InitialStaffUsername string
	InitialStaffPassword string

	// SMTP Email configuration (used as fallback defaults; runtime values are read from settings table)
	SMTPHost             string
	SMTPPort             string
	SMTPUser             string
	SMTPPassword         string
	SMTPFromEmail        string
	SMTPFromName         string

	// Email report configuration defaults
	ReportRecipientEmails  string
	EnableDailyEmailReport bool
	DailyReportTime        string
}

// IsProduction returns true when running in production mode
func (c *Config) IsProduction() bool {
	return c.AppEnv == "production"
}

// LoadConfig initializes configuration from environment variables or .env file
func LoadConfig() (*Config, error) {
	// Attempt to load .env files based on APP_ENV; ignore errors if not present
	appEnvVal := os.Getenv("APP_ENV")
	if appEnvVal == "production" {
		_ = godotenv.Load(".env.production", "../.env.production", ".env", "../.env")
	} else if appEnvVal == "development" {
		_ = godotenv.Load(".env.development", "../.env.development", ".env", "../.env")
	} else {
		_ = godotenv.Load(".env.development", ".env.production", ".env", "../.env")
	}

	port := getEnv("PORT", "8080")
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "rabbitpos")
	appEnv := getEnv("APP_ENV", "development")

	// JWT secret: no hardcoded fallback — empty string forces validation below
	jwtSecret := getEnv("JWT_SECRET", "")

	jwtExpiryStr := getEnv("JWT_EXPIRY_HOURS", "24")
	corsRaw := getEnv("CORS_ORIGIN", getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://10.0.0.10:3000"))

	// Seeding configuration
	enableSeedingStr := getEnv("ENABLE_SEEDING", "")
	var enableSeeding bool
	if enableSeedingStr == "" {
		// Default: enable seeding only in non-production environments
		enableSeeding = appEnv != "production"
	} else {
		enableSeeding, _ = strconv.ParseBool(enableSeedingStr)
	}

	// Initial admin credentials (required for first-time DB initialization)
	initialAdminUsername := getEnv("INITIAL_ADMIN_USERNAME", "admin")
	initialAdminPassword := getEnv("INITIAL_ADMIN_PASSWORD", "")

	// Initial staff credentials (only for development seeding)
	initialStaffUsername := getEnv("INITIAL_STAFF_USERNAME", "staff")
	initialStaffPassword := getEnv("INITIAL_STAFF_PASSWORD", "")

	// SMTP email configuration (ENV overrides; runtime values are re-read from settings table each send)
	smtpHost := getEnv("SMTP_HOST", "smtp.gmail.com")
	smtpPort := getEnv("SMTP_PORT", "587")
	smtpUser := getEnv("SMTP_USER", "")
	smtpPassword := getEnv("SMTP_PASSWORD", "")
	smtpFromEmail := getEnv("SMTP_FROM_EMAIL", "")
	smtpFromName := getEnv("SMTP_FROM_NAME", "Thỏ Juice & Coffee - RabbitPOS")
	reportRecipients := getEnv("REPORT_RECIPIENT_EMAILS", "nhanhdn.jfw@gmail.com,candynhung754@gmail.com,150498tranquangdat@gmail.com")
	enableDailyReport, _ := strconv.ParseBool(getEnv("ENABLE_DAILY_EMAIL_REPORT", "true"))
	dailyReportTime := getEnv("DAILY_REPORT_TIME", "22:30")

	jwtExpiryHours, err := strconv.Atoi(jwtExpiryStr)
	if err != nil || jwtExpiryHours <= 0 {
		jwtExpiryHours = 24
	}

	var origins []string
	for _, o := range strings.Split(corsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		trimmed = strings.Trim(trimmed, "\"'")
		trimmed = strings.TrimRight(trimmed, "/")
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	cfg := &Config{
		Port:                   port,
		DBHost:                 dbHost,
		DBPort:                 dbPort,
		DBUser:                 dbUser,
		DBPassword:             dbPassword,
		DBName:                 dbName,
		AppEnv:                 appEnv,
		JWTSecret:              jwtSecret,
		JWTExpiryHours:         jwtExpiryHours,
		CORSAllowedOrigins:     origins,
		EnableSeeding:          enableSeeding,
		InitialAdminUsername:   initialAdminUsername,
		InitialAdminPassword:   initialAdminPassword,
		InitialStaffUsername:   initialStaffUsername,
		InitialStaffPassword:   initialStaffPassword,
		SMTPHost:               smtpHost,
		SMTPPort:               smtpPort,
		SMTPUser:               smtpUser,
		SMTPPassword:           smtpPassword,
		SMTPFromEmail:          smtpFromEmail,
		SMTPFromName:           smtpFromName,
		ReportRecipientEmails:  reportRecipients,
		EnableDailyEmailReport: enableDailyReport,
		DailyReportTime:        dailyReportTime,
	}

	// Enforce secure JWT secret in production — fail fast rather than run insecurely
	if err := cfg.validateSecurity(); err != nil {
		return nil, err
	}

	return cfg, nil
}

// validateSecurity enforces critical security constraints on startup
func (c *Config) validateSecurity() error {
	if c.IsProduction() {
		// JWT secret must be set and sufficiently long (at least 32 characters)
		if c.JWTSecret == "" {
			return fmt.Errorf("FATAL: JWT_SECRET environment variable is not set. " +
				"Generate a strong secret with: openssl rand -hex 32")
		}
		if len(c.JWTSecret) < 32 {
			return fmt.Errorf("FATAL: JWT_SECRET is too short (%d chars). "+
				"Minimum 32 characters required for production security. "+
				"Generate one with: openssl rand -hex 32", len(c.JWTSecret))
		}

		// Admin password must be set in production
		if c.InitialAdminPassword == "" {
			log.Println("WARNING: INITIAL_ADMIN_PASSWORD is not set. Admin account will not be created on first run.")
		}
	} else {
		// Development: use a weak default JWT secret if not provided
		if c.JWTSecret == "" {
			c.JWTSecret = "rabbitpos-dev-jwt-secret-key-2026-not-for-production"
			log.Println("WARNING: JWT_SECRET not set — using default development secret. DO NOT use in production.")
		}
		// Development: use default admin/staff passwords if not provided
		if c.InitialAdminPassword == "" {
			c.InitialAdminPassword = "admin123"
		}
		if c.InitialStaffPassword == "" {
			c.InitialStaffPassword = "staff123"
		}
	}
	return nil
}

// GetDSN returns PostgreSQL Connection Data Source Name
func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		c.DBHost, c.DBUser, c.DBPassword, c.DBName, c.DBPort)
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
