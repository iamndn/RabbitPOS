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
	// Attempt to load .env file; ignore error if not found (e.g., in production containers)
	_ = godotenv.Load("../.env", ".env")

	port := getEnv("PORT", "8080")
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "rabbitpos")
	appEnv := getEnv("APP_ENV", "development")
	jwtSecret := getEnv("JWT_SECRET", "thopos-super-secret-jwt-key-2026-production")
	jwtExpiryStr := getEnv("JWT_EXPIRY_HOURS", "24")
	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://thopos.ndnworks.com")

	jwtExpiryHours, err := strconv.Atoi(jwtExpiryStr)
	if err != nil || jwtExpiryHours <= 0 {
		jwtExpiryHours = 24
	}

	origins := strings.Split(corsRaw, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
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
