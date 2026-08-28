package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

// List of sensitive headers and fields that must never appear in server logs
var sensitiveKeys = []string{
	"password",
	"token",
	"secret",
	"authorization",
	"cookie",
	"jwt",
	"private_key",
	"smtp_password",
	"google_sheets_service_account_json",
	"backup_encryption_key",
}

// SanitizeLogString masks sensitive values in string logs
func SanitizeLogString(input string) string {
	lower := strings.ToLower(input)
	for _, key := range sensitiveKeys {
		if strings.Contains(lower, key) {
			return "[REDACTED_SENSITIVE_CONTENT]"
		}
	}
	return input
}

// StructuredLoggerMiddleware generates or propagates X-Request-ID, captures latency, and logs sanitized metadata
func StructuredLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// 1. Generate or propagate X-Request-ID
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			tok, err := utils.GenerateSecureToken(8)
			if err == nil {
				requestID = "req_" + tok
			} else {
				requestID = "req_" + time.Now().Format("20060102150405")
			}
		}
		c.Header("X-Request-ID", requestID)
		c.Set("request_id", requestID)

		// 2. Extract Device ID and Idempotency Key
		deviceID := c.GetHeader("X-Device-ID")
		if deviceID == "" {
			deviceID = "unknown"
		}
		idempotencyKey := c.GetHeader("Idempotency-Key")

		// 3. Process the HTTP request
		c.Next()

		// 4. Compute metrics after response
		duration := time.Since(start)
		status := c.Writer.Status()
		clientIP := c.ClientIP()
		method := c.Request.Method
		path := c.Request.URL.Path

		// 5. Extract user identity if authenticated
		userID := ""
		if uidVal, exists := c.Get("user_id"); exists {
			userID = strings.TrimSpace(strings.Trim(strings.Trim(c.GetString("user_id"), "\""), " "))
			if userID == "" {
				userID = strings.TrimSpace(strings.Trim(c.GetString("username"), "\""))
			}
			if userID == "" {
				if uid, ok := uidVal.(uint); ok {
					userID = strings.TrimSpace(string(rune(uid)))
				}
			}
		}

		// 6. Output structured log line (JSON format)
		logEntry := map[string]interface{}{
			"timestamp":    time.Now().UTC().Format(time.RFC3339),
			"request_id":   requestID,
			"client_ip":    clientIP,
			"method":       method,
			"path":         path,
			"status":       status,
			"duration_ms":  duration.Milliseconds(),
			"device_id":    deviceID,
		}

		if idempotencyKey != "" {
			logEntry["idempotency_key"] = idempotencyKey
		}
		if userID != "" {
			logEntry["user_id"] = userID
		}

		logBytes, _ := json.Marshal(logEntry)
		log.Println(string(logBytes))
	}
}

// ReadAndRestoreBody safely reads request body and restores it for downstream handlers
func ReadAndRestoreBody(c *gin.Context) []byte {
	if c.Request.Body == nil {
		return nil
	}
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
	return bodyBytes
}
