package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
)

func TestBackupHandler_Export_V2(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutils.GetTestDB(t)

	// Seed test data
	_, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	handler := NewBackupHandler(db)
	router := gin.New()
	router.GET("/api/v1/backup/export", handler.ExportBackup)

	req, _ := http.NewRequest("GET", "/api/v1/backup/export", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp struct {
		Status  string               `json:"status"`
		Data    models.BackupPayload `json:"data"`
		Message string               `json:"message"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to parse response JSON: %v", err)
	}

	payload := resp.Data
	if payload.FormatVersion != "2.0" {
		t.Errorf("Expected FormatVersion '2.0', got %q", payload.FormatVersion)
	}
	if payload.SchemaVersion != "1.19" {
		t.Errorf("Expected SchemaVersion '1.19', got %q", payload.SchemaVersion)
	}
	if payload.ChecksumAlgorithm != "sha256" {
		t.Errorf("Expected ChecksumAlgorithm 'sha256', got %q", payload.ChecksumAlgorithm)
	}
	if payload.Checksum == "" {
		t.Errorf("Expected non-empty Checksum")
	}

	// Verify checksum matches data
	calculated, err := utils.ComputeSHA256Checksum(payload.Data)
	if err != nil {
		t.Fatalf("ComputeSHA256Checksum failed: %v", err)
	}
	if calculated != payload.Checksum {
		t.Errorf("Checksum mismatch: expected %s, calculated %s", payload.Checksum, calculated)
	}

	// Verify stats count non-empty
	if payload.Stats.Categories == 0 || payload.Stats.Products == 0 || payload.Stats.Ingredients == 0 {
		t.Errorf("Expected non-zero stats for categories, products, ingredients: %+v", payload.Stats)
	}
}

func TestBackupHandler_Preview_ValidPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create valid sample V2 payload
	data := models.BackupData{
		Categories: []models.Category{
			{ID: 1, Name: "Trà Trái Cây", IsActive: true},
		},
		Products: []models.Product{
			{ID: 1, CategoryID: 1, Name: "Trà Đào Cam Sả", IsActive: true},
		},
		Ingredients: []models.Ingredient{
			{ID: 1, Name: "Đào miếng", BaseUnit: "g", Unit: "g"},
		},
	}
	checksum, _ := utils.ComputeSHA256Checksum(data)
	payload := models.BackupPayload{
		App:               "RabbitPOS",
		FormatVersion:     "2.0",
		SchemaVersion:     "1.19",
		ChecksumAlgorithm: "sha256",
		Checksum:          checksum,
		Data:              data,
	}

	handler := NewBackupHandler(nil)
	router := gin.New()
	router.POST("/api/v1/backup/preview", handler.PreviewBackup)

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/backup/preview", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp struct {
		Status string                       `json:"status"`
		Data   models.BackupPreviewResponse `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if !resp.Data.ChecksumValid {
		t.Errorf("Expected ChecksumValid to be true")
	}
	if resp.Data.RestoreToken == "" {
		t.Errorf("Expected non-empty RestoreToken")
	}
	if resp.Data.FormatVersion != "2.0" {
		t.Errorf("Expected FormatVersion '2.0', got %s", resp.Data.FormatVersion)
	}
}

func TestBackupHandler_Preview_ChecksumMismatch(t *testing.T) {
	gin.SetMode(gin.TestMode)

	data := models.BackupData{
		Categories: []models.Category{
			{ID: 1, Name: "Trà Trái Cây"},
		},
	}
	payload := models.BackupPayload{
		App:               "RabbitPOS",
		FormatVersion:     "2.0",
		SchemaVersion:     "1.19",
		ChecksumAlgorithm: "sha256",
		Checksum:          "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb", // Invalid checksum
		Data:              data,
	}

	handler := NewBackupHandler(nil)
	router := gin.New()
	router.POST("/api/v1/backup/preview", handler.PreviewBackup)

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/backup/preview", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 Bad Request on checksum mismatch, got %d", w.Code)
	}
}

func TestBackupHandler_Preview_V1_Detection(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// V1 payload missing format_version and missing ingredients
	payload := models.BackupPayload{
		App:     "RabbitPOS",
		Version: "1.0",
		Data: models.BackupData{
			Categories: []models.Category{
				{ID: 1, Name: "Cà Phê"},
			},
		},
	}

	handler := NewBackupHandler(nil)
	router := gin.New()
	router.POST("/api/v1/backup/preview", handler.PreviewBackup)

	bodyBytes, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/api/v1/backup/preview", bytes.NewBuffer(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status %d, got %d. Body: %s", http.StatusOK, w.Code, w.Body.String())
	}

	var resp struct {
		Status string                       `json:"status"`
		Data   models.BackupPreviewResponse `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.Data.FormatVersion != "1.0" {
		t.Errorf("Expected FormatVersion '1.0', got %s", resp.Data.FormatVersion)
	}
	if len(resp.Data.Warnings) == 0 {
		t.Errorf("Expected warnings for V1 backup missing BOM & ingredients")
	}
}

func TestBackupHandler_Restore_RequiresValidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewBackupHandler(nil)
	router := gin.New()
	router.POST("/api/v1/backup/restore", handler.RestoreBackup)

	// Attempt restore without token
	req, _ := http.NewRequest("POST", "/api/v1/backup/restore", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 when restore token is missing, got %d", w.Code)
	}

	// Attempt restore with invalid fake token
	reqFake, _ := http.NewRequest("POST", "/api/v1/backup/restore", bytes.NewBufferString(`{"restore_token":"fake-token-123"}`))
	reqFake.Header.Set("Content-Type", "application/json")
	wFake := httptest.NewRecorder()
	router.ServeHTTP(wFake, reqFake)

	if wFake.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 when restore token is invalid, got %d", wFake.Code)
	}
}

func TestBackupHandler_RoundTrip_ExportPreviewRestore(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := testutils.GetTestDB(t)

	// 1. Seed initial data
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed initial fixtures: %v", err)
	}

	handler := NewBackupHandler(db)
	router := gin.New()
	router.GET("/api/v1/backup/export", handler.ExportBackup)
	router.POST("/api/v1/backup/preview", handler.PreviewBackup)
	router.POST("/api/v1/backup/restore", handler.RestoreBackup)

	// 2. Export Backup
	exportReq, _ := http.NewRequest("GET", "/api/v1/backup/export", nil)
	exportRec := httptest.NewRecorder()
	router.ServeHTTP(exportRec, exportReq)

	if exportRec.Code != http.StatusOK {
		t.Fatalf("Export failed: %s", exportRec.Body.String())
	}

	var exportResp struct {
		Data models.BackupPayload `json:"data"`
	}
	_ = json.Unmarshal(exportRec.Body.Bytes(), &exportResp)
	exportedPayload := exportResp.Data

	// 3. Dry-run Preview
	previewBytes, _ := json.Marshal(exportedPayload)
	previewReq, _ := http.NewRequest("POST", "/api/v1/backup/preview", bytes.NewBuffer(previewBytes))
	previewReq.Header.Set("Content-Type", "application/json")
	previewRec := httptest.NewRecorder()
	router.ServeHTTP(previewRec, previewReq)

	if previewRec.Code != http.StatusOK {
		t.Fatalf("Preview failed: %s", previewRec.Body.String())
	}

	var previewResp struct {
		Data models.BackupPreviewResponse `json:"data"`
	}
	_ = json.Unmarshal(previewRec.Body.Bytes(), &previewResp)
	restoreToken := previewResp.Data.RestoreToken

	if restoreToken == "" {
		t.Fatalf("Preview did not return restore token")
	}

	// 4. Execute Restore with Token
	restoreReqBody, _ := json.Marshal(models.RestoreRequest{
		RestoreToken:  restoreToken,
		BackupPayload: &exportedPayload,
	})
	restoreReq, _ := http.NewRequest("POST", "/api/v1/backup/restore", bytes.NewBuffer(restoreReqBody))
	restoreReq.Header.Set("Content-Type", "application/json")
	restoreRec := httptest.NewRecorder()
	router.ServeHTTP(restoreRec, restoreReq)

	if restoreRec.Code != http.StatusOK {
		t.Fatalf("Restore failed with status %d: %s", restoreRec.Code, restoreRec.Body.String())
	}

	// 5. Verify restored data exists in database
	var countCategories int64
	db.Model(&models.Category{}).Where("name = ?", fixtures.Category.Name).Count(&countCategories)
	if countCategories == 0 {
		t.Errorf("Expected restored category %s to exist in database", fixtures.Category.Name)
	}

	var countIngredients int64
	db.Model(&models.Ingredient{}).Where("name = ?", fixtures.Ingredient.Name).Count(&countIngredients)
	if countIngredients == 0 {
		t.Errorf("Expected restored ingredient %s to exist in database", fixtures.Ingredient.Name)
	}
}

func TestBackupHandler_Preview_Encrypted(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Set test encryption key
	secretKey := "test-secret-encryption-key-for-backup-v2"
	key := utils.DeriveKeyFromSecret(secretKey)

	rawPlaintextData := models.BackupData{
		Categories: []models.Category{
			{ID: 1, Name: "Cà Phê Pha Máy", IsActive: true},
		},
		Ingredients: []models.Ingredient{
			{ID: 1, Name: "Sữa tươi không đường", BaseUnit: "ml"},
		},
	}
	dataBytes, _ := json.Marshal(rawPlaintextData)
	cipherB64, nonceB64, err := utils.EncryptAESGCM(dataBytes, key)
	if err != nil {
		t.Fatalf("EncryptAESGCM failed: %v", err)
	}

	checksum, _ := utils.ComputeSHA256Checksum(rawPlaintextData)
	encryptedPayload := models.BackupPayload{
		App:               "RabbitPOS",
		FormatVersion:     "2.0",
		SchemaVersion:     "1.19",
		ChecksumAlgorithm: "sha256",
		Checksum:          checksum,
		IsEncrypted:       true,
		EncryptionMeta: &models.EncryptionMeta{
			Algorithm: "AES-256-GCM",
			Nonce:     nonceB64,
		},
		EncryptedData: cipherB64,
	}

	handler := NewBackupHandler(nil)
	router := gin.New()
	router.POST("/api/v1/backup/preview", handler.PreviewBackup)

	// Preview with valid decryption key header
	bodyBytes, _ := json.Marshal(encryptedPayload)
	previewReq, _ := http.NewRequest("POST", "/api/v1/backup/preview", bytes.NewBuffer(bodyBytes))
	previewReq.Header.Set("Content-Type", "application/json")
	previewReq.Header.Set("X-Backup-Key", secretKey)
	previewRec := httptest.NewRecorder()
	router.ServeHTTP(previewRec, previewReq)

	if previewRec.Code != http.StatusOK {
		t.Fatalf("Preview of encrypted payload failed: %s", previewRec.Body.String())
	}

	var previewResp struct {
		Data models.BackupPreviewResponse `json:"data"`
	}
	_ = json.Unmarshal(previewRec.Body.Bytes(), &previewResp)

	if previewResp.Data.RestoreToken == "" {
		t.Errorf("Expected valid restore token after decrypting preview")
	}
	if !previewResp.Data.ChecksumValid {
		t.Errorf("Expected ChecksumValid to be true on decrypted payload")
	}
	if previewResp.Data.Stats.Categories != 1 || previewResp.Data.Stats.Ingredients != 1 {
		t.Errorf("Expected stats to reflect decrypted records: %+v", previewResp.Data.Stats)
	}
}
