package handlers

import (
	"net/http"
	"strconv"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ToppingHandler struct {
	db *gorm.DB
}

func NewToppingHandler(db *gorm.DB) *ToppingHandler {
	return &ToppingHandler{db: db}
}

// ListToppings returns active toppings. Supports ?category_id=X to return global toppings
// (category_id IS NULL) PLUS toppings scoped to that specific category.
func (h *ToppingHandler) ListToppings(c *gin.Context) {
	toppings := make([]models.Topping, 0)

	query := h.db.Where("is_active = ?", true)

	if catIDStr := c.Query("category_id"); catIDStr != "" {
		catID, err := strconv.ParseUint(catIDStr, 10, 64)
		if err != nil {
			models.SendError(c, http.StatusBadRequest, "Invalid category_id parameter")
			return
		}
		// Return global toppings (NULL category) + toppings for this specific category
		query = query.Where("category_id IS NULL OR category_id = ?", catID)
	}

	if err := query.Order("name asc").Find(&toppings).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve toppings: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, toppings, "Toppings retrieved successfully")
}

// ListAllToppings returns all toppings (including inactive) for admin management
func (h *ToppingHandler) ListAllToppings(c *gin.Context) {
	toppings := make([]models.Topping, 0)

	if err := h.db.Order("name asc").Find(&toppings).Error; err != nil {
		models.SendInternalError(c, "Failed to retrieve toppings: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, toppings, "All toppings retrieved successfully")
}

// CreateTopping creates a new topping (admin only)
func (h *ToppingHandler) CreateTopping(c *gin.Context) {
	var req models.CreateToppingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request: "+err.Error())
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	topping := models.Topping{
		Name:       req.Name,
		Price:      req.Price,
		COGS:       req.COGS,
		CategoryID: req.CategoryID,
		IsActive:   isActive,
	}

	if err := h.db.Create(&topping).Error; err != nil {
		models.SendInternalError(c, "Failed to create topping: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusCreated, topping, "Topping created successfully")
}

// UpdateTopping updates an existing topping (admin only)
func (h *ToppingHandler) UpdateTopping(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	var topping models.Topping
	if err := h.db.First(&topping, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			models.SendError(c, http.StatusNotFound, "Topping not found")
			return
		}
		models.SendInternalError(c, "Database error")
		return
	}

	var req models.UpdateToppingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid request: "+err.Error())
		return
	}

	if req.Name != "" {
		topping.Name = req.Name
	}
	topping.Price = req.Price
	topping.COGS = req.COGS
	topping.CategoryID = req.CategoryID
	if req.IsActive != nil {
		topping.IsActive = *req.IsActive
	}

	if err := h.db.Save(&topping).Error; err != nil {
		models.SendInternalError(c, "Failed to update topping: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, topping, "Topping updated successfully")
}

// DeleteTopping deletes a topping by ID (admin only)
func (h *ToppingHandler) DeleteTopping(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendError(c, http.StatusBadRequest, "Invalid topping ID")
		return
	}

	if err := h.db.Delete(&models.Topping{}, id).Error; err != nil {
		models.SendInternalError(c, "Failed to delete topping: "+err.Error())
		return
	}

	models.SendSuccess(c, http.StatusOK, nil, "Topping deleted successfully")
}
