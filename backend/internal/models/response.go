package models

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ResponseEnvelope represents the mandatory JSON structure per project rules.
// Structure: { "status": "success|error", "data": {...}, "message": "..." }
type ResponseEnvelope struct {
	Status  string      `json:"status"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message"`
}

// SendSuccess sends a standardized success JSON response
func SendSuccess(c *gin.Context, statusCode int, data interface{}, message string) {
	c.JSON(statusCode, ResponseEnvelope{
		Status:  "success",
		Data:    data,
		Message: message,
	})
}

// SendError sends a standardized error JSON response
func SendError(c *gin.Context, statusCode int, message string) {
	c.JSON(statusCode, ResponseEnvelope{
		Status:  "error",
		Data:    nil,
		Message: message,
	})
}

// Default error helper for internal server error
func SendInternalError(c *gin.Context, message string) {
	if message == "" {
		message = "An unexpected error occurred"
	}
	SendError(c, http.StatusInternalServerError, message)
}
