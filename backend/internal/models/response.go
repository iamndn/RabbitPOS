package models

import (
	"log"
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

// SendInternalError sends a safe internal error response to client
func SendInternalError(c *gin.Context, message string) {
	if message == "" {
		message = "An unexpected error occurred"
	}
	SendError(c, http.StatusInternalServerError, message)
}

// SendInternalErrorLogged logs detailed internal error on server and returns sanitized message to client
func SendInternalErrorLogged(c *gin.Context, publicMessage string, internalErr error) {
	if internalErr != nil {
		log.Printf("[SERVER ERROR] %s | path=%s | method=%s | err=%v", publicMessage, c.Request.URL.Path, c.Request.Method, internalErr)
	}
	if publicMessage == "" {
		publicMessage = "An unexpected error occurred"
	}
	SendError(c, http.StatusInternalServerError, publicMessage)
}

