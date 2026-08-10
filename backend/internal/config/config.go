package config

import (
	"fmt"
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
	jwtSecret := getEnv("JWT_SECRET", "rabbitpos-super-secret-jwt-key-2026-production")
	jwtExpiryStr := getEnv("JWT_EXPIRY_HOURS", "24")
	corsRaw := getEnv("CORS_ORIGIN", getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://rabbitpos.ndnworks.com"))

	jwtExpiryHours, err := strconv.Atoi(jwtExpiryStr)
	if err != nil || jwtExpiryHours <= 0 {
		jwtExpiryHours = 24
	}

	var origins []string
	for _, o := range strings.Split(corsRaw, ",") {
		trimmed := strings.TrimSpace(o)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	cfg := &Config{
		Port:               port,
		DBHost:             dbHost,
		DBPort:             dbPort,
		DBUser:             dbUser,
		DBPassword:         dbPassword,
		DBName:             dbName,
		AppEnv:             appEnv,
		JWTSecret:          jwtSecret,
		JWTExpiryHours:     jwtExpiryHours,
		CORSAllowedOrigins: origins,
	}

	return cfg, nil
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
