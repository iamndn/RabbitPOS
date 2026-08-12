package handlers

import (
	"crypto/rand"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
)

const MaxUploadSize = 5 * 1024 * 1024 // 5MB

type UploadHandler struct{}

func NewUploadHandler() *UploadHandler {
	return &UploadHandler{}
}

// UploadImage handles image file uploads for categories and products
func (h *UploadHandler) UploadImage(c *gin.Context) {
	// Restrict max memory for multipart body to 5MB
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadSize)

	// Accept file from multipart form field 'image' or fallback to 'file'
	fileHeader, err := c.FormFile("image")
	if err != nil {
		fileHeader, err = c.FormFile("file")
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Missing image file in request payload (field 'image' or 'file')")
			return
		}
	}

	// Enforce 5MB file size limit
	if fileHeader.Size > MaxUploadSize {
		models.SendError(c, http.StatusBadRequest, "File size exceeds maximum allowed limit of 5MB")
		return
	}

	// Validate allowed extensions
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	allowedExtensions := map[string]bool{
		".jpg":  true,
		".jpeg": true,
		".png":  true,
		".webp": true,
		".gif":  true,
	}

	if !allowedExtensions[ext] {
		models.SendError(c, http.StatusBadRequest, "Invalid file format. Allowed formats: JPG, JPEG, PNG, WEBP, GIF")
		return
	}

	// Ensure upload directory exists
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		models.SendInternalError(c, "Failed to initialize upload directory")
		return
	}

	// Generate unique filename: <timestamp>_<randomhex><ext>
	randomBytes := make([]byte, 8)
	_, _ = rand.Read(randomBytes)
	uniqueFilename := fmt.Sprintf("%d_%x%s", time.Now().UnixNano(), randomBytes, ext)

	// Destination path
	dstPath := filepath.Join(uploadDir, uniqueFilename)

	// Save uploaded file
	if err := c.SaveUploadedFile(fileHeader, dstPath); err != nil {
		models.SendInternalError(c, "Failed to save uploaded image file: "+err.Error())
		return
	}

	publicURL := "/uploads/" + uniqueFilename
	models.SendSuccess(c, http.StatusOK, gin.H{
		"url": publicURL,
	}, "File uploaded successfully")
}
