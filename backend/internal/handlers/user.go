package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var pinRegex = regexp.MustCompile(`^\d{4,6}$`)

type UserHandler struct {
	db       *gorm.DB
	auditSvc *services.AuditService
}

func NewUserHandler(db *gorm.DB, auditSvc *services.AuditService) *UserHandler {
	return &UserHandler{
		db:       db,
		auditSvc: auditSvc,
	}
}

// callerID gets current user ID from gin context
func (h *UserHandler) callerID(c *gin.Context) uint {
	if val, ok := c.Get("user_id"); ok {
		if id, ok := val.(uint); ok {
			return id
		}
	}
	return 0
}

// callerRole gets current user role from gin context
func (h *UserHandler) callerRole(c *gin.Context) models.UserRole {
	if val, ok := c.Get("user_role"); ok {
		if r, ok := val.(models.UserRole); ok {
			return r
		}
	}
	return models.RoleStaff
}

// audit records an administrative action
func (h *UserHandler) audit(c *gin.Context, action, resource string, id uint, details map[string]interface{}) {
	if h.auditSvc == nil {
		return
	}
	uid := h.callerID(c)
	username, _ := c.Get("username")
	un, _ := username.(string)
	rid := strconv.FormatUint(uint64(id), 10)
	h.auditSvc.RecordLog(&uid, un, string(h.callerRole(c)), action, resource, &rid, "success", c.ClientIP(), c.Request.UserAgent(), details)
}

// ListUsers lists all users with optional filtering and search
// If the caller is an owner, master accounts are excluded from results.
func (h *UserHandler) ListUsers(c *gin.Context) {
	callerRole := h.callerRole(c)

	query := h.db.Model(&models.User{})

	// Non-masters cannot view master accounts
	if !callerRole.IsMaster() {
		query = query.Where("role NOT IN ('master', 'super_admin', 'admin')")
	}

	// Search filter
	search := strings.TrimSpace(c.Query("q"))
	if search != "" {
		pattern := "%" + strings.ToLower(search) + "%"
		query = query.Where("LOWER(username) LIKE ? OR LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?",
			pattern, pattern, pattern, pattern)
	}

	// Role filter
	roleFilter := strings.TrimSpace(c.Query("role"))
	if roleFilter != "" {
		query = query.Where("role = ?", roleFilter)
	}

	// Status filter
	statusFilter := strings.TrimSpace(c.Query("status"))
	if statusFilter == "active" {
		query = query.Where("is_active = TRUE")
	} else if statusFilter == "inactive" {
		query = query.Where("is_active = FALSE")
	}

	var users []models.User
	if err := query.Order("id ASC").Find(&users).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to retrieve users", err)
		return
	}

	// Query store memberships
	var userIDs []uint
	for _, u := range users {
		userIDs = append(userIDs, u.ID)
	}

	membershipMap := map[uint][]models.StoreResponse{}
	if len(userIDs) > 0 {
		var userStores []models.UserStore
		if err := h.db.Where("user_id IN ?", userIDs).Find(&userStores).Error; err == nil {
			var storeIDs []uint
			for _, us := range userStores {
				storeIDs = append(storeIDs, us.StoreID)
			}
			storeMap := map[uint]models.Store{}
			if len(storeIDs) > 0 {
				var stores []models.Store
				if err := h.db.Where("id IN ?", storeIDs).Find(&stores).Error; err == nil {
					for _, s := range stores {
						storeMap[s.ID] = s
					}
				}
			}
			for _, us := range userStores {
				if s, ok := storeMap[us.StoreID]; ok {
					membershipMap[us.UserID] = append(membershipMap[us.UserID], models.StoreResponse{
						Store:     s,
						Role:      us.Role,
						IsDefault: us.IsDefault,
					})
				}
			}
		}
	}

	out := make([]models.UserResponse, 0, len(users))
	for _, u := range users {
		stores := membershipMap[u.ID]
		var defID *uint
		for _, s := range stores {
			if s.IsDefault {
				idCopy := s.ID
				defID = &idCopy
				break
			}
		}
		out = append(out, models.UserResponse{
			ID:                 u.ID,
			Username:           u.Username,
			FullName:           u.FullName,
			Phone:              u.Phone,
			Email:              u.Email,
			Role:               u.Role,
			IsActive:           u.IsActive,
			HasPin:             u.PinCode != nil && *u.PinCode != "",
			NeedsPasswordSetup: u.NeedsPasswordSetup,
			LastLoginAt:        u.LastLoginAt,
			Stores:             stores,
			DefaultStoreID:     defID,
			CreatedAt:          u.CreatedAt,
			UpdatedAt:          u.UpdatedAt,
		})
	}

	models.SendSuccess(c, http.StatusOK, out, "Users retrieved successfully")
}

// GetUserByID returns details of a single user
func (h *UserHandler) GetUserByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID")
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to retrieve user", err)
		return
	}

	callerRole := h.callerRole(c)
	if !callerRole.IsMaster() && user.Role.IsMaster() {
		models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Access denied: cannot view master accounts")
		return
	}

	resp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: user.NeedsPasswordSetup,
		LastLoginAt:        user.LastLoginAt,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}

	models.SendSuccess(c, http.StatusOK, resp, "User details retrieved")
}

// CreateUser creates a new user account with hashed password and optional PIN code
func (h *UserHandler) CreateUser(c *gin.Context) {
	var req models.CreateUserDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload: "+err.Error())
		return
	}

	callerRole := h.callerRole(c)
	req.Username = strings.TrimSpace(req.Username)
	if len(req.Username) < 3 || len(req.Username) > 50 {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Username must be between 3 and 50 characters")
		return
	}

	// Resolve password
	pass := req.Password
	if pass == "" {
		pass = req.TempPassword
	}
	if len(pass) < 6 {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Password must be at least 6 characters")
		return
	}

	// Role permission check
	if !callerRole.IsMaster() {
		// Non-master (owner) can ONLY create staff accounts
		if req.Role != models.RoleStaff {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners can only create staff accounts")
			return
		}
	} else {
		// Validate role
		if req.Role != models.RoleMaster && req.Role != models.RoleOwner && req.Role != models.RoleStaff &&
			req.Role != models.RoleSuperAdmin && req.Role != models.RoleAdmin {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid role specified")
			return
		}
	}

	// Validate PIN if provided
	var hashedPin *string
	req.PinCode = strings.TrimSpace(req.PinCode)
	if req.PinCode != "" {
		if !pinRegex.MatchString(req.PinCode) {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "PIN code must be exactly 4 to 6 numeric digits")
			return
		}
		hPin, err := utils.HashPassword(req.PinCode)
		if err != nil {
			models.SendInternalErrorLogged(c, "Failed to hash PIN", err)
			return
		}
		hashedPin = &hPin
	}

	// Hash password
	passHash, err := utils.HashPassword(pass)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to hash password", err)
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	newUser := models.User{
		Username:           req.Username,
		FullName:           strings.TrimSpace(req.FullName),
		Phone:              strings.TrimSpace(req.Phone),
		Email:              strings.TrimSpace(req.Email),
		PasswordHash:       passHash,
		PinCode:            hashedPin,
		Role:               req.Role,
		IsActive:           isActive,
		NeedsPasswordSetup: true,
		TokenVersion:       1,
	}

	err = h.db.Transaction(func(tx *gorm.DB) error {
		// Check uniqueness of username (case-insensitive)
		var count int64
		if err := tx.Model(&models.User{}).Where("LOWER(username) = ?", strings.ToLower(req.Username)).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return &services.StoreError{
				Status:  http.StatusConflict,
				Code:    "USER_EXISTS",
				Message: "Tên đăng nhập đã tồn tại trong hệ thống",
			}
		}

		if err := tx.Create(&newUser).Error; err != nil {
			return err
		}

		// Handle memberships if provided
		hasDefault := false
		for i, m := range req.Memberships {
			isDef := m.IsDefault && !hasDefault
			if i == 0 && !hasDefault {
				isDef = true
			}
			if isDef {
				hasDefault = true
			}
			if err := tx.Create(&models.UserStore{
				UserID:    newUser.ID,
				StoreID:   m.StoreID,
				Role:      m.Role,
				IsDefault: isDef,
			}).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		var se *services.StoreError
		if errors.As(err, &se) {
			models.SendErrorCode(c, se.Status, se.Code, se.Message)
			return
		}
		models.SendInternalErrorLogged(c, "Failed to create user", err)
		return
	}

	h.audit(c, "CREATE_USER", "users", newUser.ID, map[string]interface{}{
		"username":  newUser.Username,
		"role":      newUser.Role,
		"full_name": newUser.FullName,
	})

	resp := models.UserResponse{
		ID:                 newUser.ID,
		Username:           newUser.Username,
		FullName:           newUser.FullName,
		Phone:              newUser.Phone,
		Email:              newUser.Email,
		Role:               newUser.Role,
		IsActive:           newUser.IsActive,
		HasPin:             newUser.PinCode != nil,
		NeedsPasswordSetup: newUser.NeedsPasswordSetup,
		LastLoginAt:        newUser.LastLoginAt,
		CreatedAt:          newUser.CreatedAt,
		UpdatedAt:          newUser.UpdatedAt,
	}

	models.SendSuccess(c, http.StatusCreated, resp, "Tạo người dùng mới thành công")
}

// UpdateUser updates user details, role, status, or resets password/PIN
func (h *UserHandler) UpdateUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID")
		return
	}

	var req models.UpdateUserDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload: "+err.Error())
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find user", err)
		return
	}

	callerID := h.callerID(c)
	callerRole := h.callerRole(c)

	// Role alteration permissions
	if req.Role != nil {
		if !callerRole.IsMaster() {
			if (*req.Role).IsMaster() || (*req.Role).IsOwner() {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owners cannot assign master or owner roles")
				return
			}
		}
		user.Role = *req.Role
	}

	// Update fields safely without corrupting unaffected fields
	if req.FullName != nil {
		user.FullName = strings.TrimSpace(*req.FullName)
	}
	if req.Phone != nil {
		user.Phone = strings.TrimSpace(*req.Phone)
	}
	if req.Email != nil {
		user.Email = strings.TrimSpace(*req.Email)
	}

	if req.IsActive != nil {
		if !*req.IsActive {
			if user.ID == callerID {
				models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DEACTIVATE_SELF", "Không thể tự vô hiệu hóa tài khoản đang đăng nhập")
				return
			}
			if user.Role.IsMaster() {
				var activeMasters int64
				h.db.Model(&models.User{}).Where("role IN ('master', 'super_admin', 'admin') AND is_active = TRUE AND id != ?", user.ID).Count(&activeMasters)
				if activeMasters == 0 {
					models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DEACTIVATE_LAST_MASTER", "Không thể vô hiệu hóa tài khoản Master cuối cùng trong hệ thống")
					return
				}
			}
			user.TokenVersion++
		}
		user.IsActive = *req.IsActive
	}

	// Password reset
	if req.Password != "" {
		if len(req.Password) < 6 {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Password must be at least 6 characters")
			return
		}
		hash, err := utils.HashPassword(req.Password)
		if err != nil {
			models.SendInternalErrorLogged(c, "Failed to hash password", err)
			return
		}
		user.PasswordHash = hash
		user.TokenVersion++ // Invalidate active login tokens
		user.NeedsPasswordSetup = false
	}

	// PIN code update
	if req.PinCode != nil {
		pinVal := strings.TrimSpace(*req.PinCode)
		if pinVal == "" {
			user.PinCode = nil
		} else {
			if !pinRegex.MatchString(pinVal) {
				models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "PIN code must be exactly 4 to 6 numeric digits")
				return
			}
			hPin, err := utils.HashPassword(pinVal)
			if err != nil {
				models.SendInternalErrorLogged(c, "Failed to hash PIN", err)
				return
			}
			user.PinCode = &hPin
		}
	}

	if err := h.db.Save(&user).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to update user", err)
		return
	}

	h.audit(c, "UPDATE_USER", "users", user.ID, map[string]interface{}{
		"username": user.Username,
		"role":     user.Role,
	})

	resp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: user.NeedsPasswordSetup,
		LastLoginAt:        user.LastLoginAt,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Cập nhật thông tin nhân viên thành công")
}

// ToggleUserStatus quickly toggles or sets user active status
func (h *UserHandler) ToggleUserStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID")
		return
	}

	callerID := h.callerID(c)
	if uint(id) == callerID {
		models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DEACTIVATE_SELF", "Không thể tự vô hiệu hóa tài khoản đang đăng nhập")
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find user", err)
		return
	}

	var req models.ToggleStatusDTO
	_ = c.ShouldBindJSON(&req)

	newStatus := !user.IsActive
	if req.IsActive != nil {
		newStatus = *req.IsActive
	}

	// Guard against deactivating the last active master
	if !newStatus && user.Role.IsMaster() {
		var activeMasters int64
		h.db.Model(&models.User{}).Where("role IN ('master', 'super_admin', 'admin') AND is_active = TRUE AND id != ?", user.ID).Count(&activeMasters)
		if activeMasters == 0 {
			models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DEACTIVATE_LAST_MASTER", "Không thể vô hiệu hóa tài khoản Master cuối cùng trong hệ thống")
			return
		}
	}

	user.IsActive = newStatus
	if !user.IsActive {
		user.TokenVersion++ // Invalidate active sessions
	}

	if err := h.db.Save(&user).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to toggle status", err)
		return
	}

	action := "DEACTIVATE_USER"
	if user.IsActive {
		action = "ACTIVATE_USER"
	}
	h.audit(c, action, "users", user.ID, map[string]interface{}{
		"username":  user.Username,
		"is_active": user.IsActive,
	})

	resp := models.UserResponse{
		ID:                 user.ID,
		Username:           user.Username,
		FullName:           user.FullName,
		Phone:              user.Phone,
		Email:              user.Email,
		Role:               user.Role,
		IsActive:           user.IsActive,
		HasPin:             user.PinCode != nil && *user.PinCode != "",
		NeedsPasswordSetup: user.NeedsPasswordSetup,
		LastLoginAt:        user.LastLoginAt,
		CreatedAt:          user.CreatedAt,
		UpdatedAt:          user.UpdatedAt,
	}

	models.SendSuccess(c, http.StatusOK, resp, "Cập nhật trạng thái người dùng thành công")
}

// DeleteUser deactivates user to safely preserve relational integrity with past orders and receipts
func (h *UserHandler) DeleteUser(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid user ID")
		return
	}

	callerID := h.callerID(c)
	if uint(id) == callerID {
		models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DELETE_SELF", "Không thể xóa hoặc vô hiệu hóa tài khoản đang đăng nhập")
		return
	}

	var user models.User
	if err := h.db.First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "NOT_FOUND", "User not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to find user", err)
		return
	}

	if user.Role.IsMaster() {
		var activeMasters int64
		h.db.Model(&models.User{}).Where("role IN ('master', 'super_admin', 'admin') AND is_active = TRUE AND id != ?", user.ID).Count(&activeMasters)
		if activeMasters == 0 {
			models.SendErrorCode(c, http.StatusBadRequest, "CANNOT_DELETE_LAST_MASTER", "Không thể xóa tài khoản Master cuối cùng trong hệ thống")
			return
		}
	}

	user.IsActive = false
	user.TokenVersion++
	if err := h.db.Save(&user).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to deactivate user", err)
		return
	}

	h.audit(c, "DELETE_USER", "users", user.ID, map[string]interface{}{
		"username": user.Username,
	})

	models.SendSuccess(c, http.StatusOK, gin.H{"id": user.ID, "is_active": false}, "Đã vô hiệu hóa tài khoản người dùng thành công")
}
