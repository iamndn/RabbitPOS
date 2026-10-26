package handlers

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/RabbitPOS/backend/internal/middleware"
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
		if r := models.ParseUserRole(val); r != "" {
			return r
		}
	}
	if s := c.GetString("role"); s != "" {
		return models.ParseUserRole(s)
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
// If the caller is an owner, they only see themselves and staff from stores they manage.
func (h *UserHandler) ListUsers(c *gin.Context) {
	callerRole := h.callerRole(c)
	callerID := h.callerID(c)

	query := h.db.Model(&models.User{})

	var callerOwnedStoreIDs []uint
	if !callerRole.IsMaster() {
		// Non-masters cannot view master accounts
		query = query.Where("role NOT IN ('master', 'super_admin', 'admin')")

		// Store Owner isolation: strictly return users from stores where caller has store_admin
		if err := h.db.Model(&models.UserStore{}).
			Where("user_id = ? AND role = ?", callerID, models.StoreRoleStoreAdmin).
			Pluck("store_id", &callerOwnedStoreIDs).Error; err != nil {
			models.SendInternalErrorLogged(c, "Failed to load store permissions", err)
			return
		}

		if len(callerOwnedStoreIDs) == 0 {
			models.SendSuccess(c, http.StatusOK, []models.UserResponse{}, "Users retrieved successfully")
			return
		}

		targetStoreIDs := callerOwnedStoreIDs
		// Optional ?store_id= filter
		if storeIDStr := strings.TrimSpace(c.Query("store_id")); storeIDStr != "" {
			if parsedSID, err := strconv.ParseUint(storeIDStr, 10, 64); err == nil && parsedSID > 0 {
				isOwned := false
				for _, sid := range callerOwnedStoreIDs {
					if sid == uint(parsedSID) {
						isOwned = true
						break
					}
				}
				if !isOwned {
					models.SendErrorCode(c, http.StatusForbidden, "STORE_FORBIDDEN", "Access denied: store not accessible")
					return
				}
				targetStoreIDs = []uint{uint(parsedSID)}
			}
		}

		var allowedUserIDs []uint
		if err := h.db.Model(&models.UserStore{}).
			Where("store_id IN ?", targetStoreIDs).
			Pluck("user_id", &allowedUserIDs).Error; err != nil {
			models.SendInternalErrorLogged(c, "Failed to load store members", err)
			return
		}

		// Include caller themselves
		allowedUserIDs = append(allowedUserIDs, callerID)

		// Owner only sees themselves (if owner) and staff accounts. NEVER sees other owners!
		query = query.Where("id IN ?", allowedUserIDs).
			Where("role != 'owner' OR id = ?", callerID)
	} else {
		// Master caller: optional ?store_id= filter
		if storeIDStr := strings.TrimSpace(c.Query("store_id")); storeIDStr != "" {
			if parsedSID, err := strconv.ParseUint(storeIDStr, 10, 64); err == nil && parsedSID > 0 {
				var userIDsInStore []uint
				_ = h.db.Model(&models.UserStore{}).Where("store_id = ?", parsedSID).Pluck("user_id", &userIDsInStore).Error
				if len(userIDsInStore) == 0 {
					models.SendSuccess(c, http.StatusOK, []models.UserResponse{}, "Users retrieved successfully")
					return
				}
				query = query.Where("id IN ?", userIDsInStore)
			}
		}
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
		usQuery := h.db.Where("user_id IN ?", userIDs)
		if !callerRole.IsMaster() && len(callerOwnedStoreIDs) > 0 {
			// For owner caller, only show stores owned by this owner
			usQuery = usQuery.Where("store_id IN ?", callerOwnedStoreIDs)
		}
		if err := usQuery.Find(&userStores).Error; err == nil {
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
	callerID := h.callerID(c)
	if !callerRole.IsMaster() {
		if user.Role.IsMaster() {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Access denied: cannot view master accounts")
			return
		}
		if user.ID != callerID {
			if user.Role.IsOwner() {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Access denied: cannot view other owner accounts")
				return
			}
			var ownedStoreIDs []uint
			h.db.Model(&models.UserStore{}).Where("user_id = ? AND role = ?", callerID, models.StoreRoleStoreAdmin).Pluck("store_id", &ownedStoreIDs)
			var targetStoreIDs []uint
			h.db.Model(&models.UserStore{}).Where("user_id = ?", user.ID).Pluck("store_id", &targetStoreIDs)
			if len(targetStoreIDs) == 0 {
				models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Target staff member does not belong to your store scope")
				return
			}
			ownedMap := make(map[uint]bool, len(ownedStoreIDs))
			for _, sid := range ownedStoreIDs {
				ownedMap[sid] = true
			}
			for _, sid := range targetStoreIDs {
				if !ownedMap[sid] {
					models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Access denied: staff belongs to other stores outside your ownership")
					return
				}
			}
		}
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
	callerID := h.callerID(c)
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

	// Role permission check and store scoping
	if !callerRole.IsMaster() {
		// Non-master (owner) can ONLY create staff accounts
		req.Role = models.RoleStaff

		var ownedStoreIDs []uint
		if err := h.db.Model(&models.UserStore{}).
			Where("user_id = ? AND role = ?", callerID, models.StoreRoleStoreAdmin).
			Pluck("store_id", &ownedStoreIDs).Error; err != nil || len(ownedStoreIDs) == 0 {
			models.SendErrorCode(c, http.StatusForbidden, "AUTH_FORBIDDEN", "Store owner does not manage any stores")
			return
		}

		ownedMap := make(map[uint]bool, len(ownedStoreIDs))
		for _, sid := range ownedStoreIDs {
			ownedMap[sid] = true
		}

		if len(req.Memberships) > 0 {
			for i := range req.Memberships {
				if !ownedMap[req.Memberships[i].StoreID] {
					models.SendErrorCode(c, http.StatusForbidden, "STORE_FORBIDDEN", "Cannot assign user to a store you do not own")
					return
				}
				req.Memberships[i].Role = models.StoreRoleStaff
			}
		} else {
			activeSID := middleware.GetStoreID(c)
			if activeSID == 0 || !ownedMap[activeSID] {
				activeSID = ownedStoreIDs[0]
			}
			req.Memberships = []models.UserMembership{
				{StoreID: activeSID, Role: models.StoreRoleStaff, IsDefault: true},
			}
		}
	} else {
		// Validate role for master
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
			role := m.Role
			if role == "" {
				role = models.StoreRoleStaff
			}
			if err := tx.Create(&models.UserStore{
				UserID:    newUser.ID,
				StoreID:   m.StoreID,
				Role:      role,
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

	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(&user).Error; err != nil {
			return err
		}

		if req.Memberships != nil {
			if !callerRole.IsMaster() {
				// Verify all target stores are owned by caller
				var ownedStoreIDs []uint
				if err := tx.Model(&models.UserStore{}).Where("user_id = ? AND role = ?", callerID, models.StoreRoleStoreAdmin).Pluck("store_id", &ownedStoreIDs).Error; err != nil {
					return err
				}
				ownedMap := make(map[uint]bool, len(ownedStoreIDs))
				for _, sid := range ownedStoreIDs {
					ownedMap[sid] = true
				}
				for _, m := range req.Memberships {
					if !ownedMap[m.StoreID] {
						return &services.StoreError{
							Status:  http.StatusForbidden,
							Code:    "STORE_FORBIDDEN",
							Message: "Cannot assign user to a store you do not own",
						}
					}
				}
				// Remove existing memberships in caller's owned stores
				if err := tx.Where("user_id = ? AND store_id IN ?", user.ID, ownedStoreIDs).Delete(&models.UserStore{}).Error; err != nil {
					return err
				}
				// Insert new memberships (forced to staff role for owner caller)
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
						UserID:    user.ID,
						StoreID:   m.StoreID,
						Role:      models.StoreRoleStaff,
						IsDefault: isDef,
					}).Error; err != nil {
						return err
					}
				}
			} else {
				// Master caller: replace all memberships
				if err := tx.Where("user_id = ?", user.ID).Delete(&models.UserStore{}).Error; err != nil {
					return err
				}
				hasDefault := false
				for i, m := range req.Memberships {
					isDef := m.IsDefault && !hasDefault
					if i == 0 && !hasDefault {
						isDef = true
					}
					if isDef {
						hasDefault = true
					}
					role := m.Role
					if role == "" {
						role = models.StoreRoleStaff
					}
					if err := tx.Create(&models.UserStore{
						UserID:    user.ID,
						StoreID:   m.StoreID,
						Role:      role,
						IsDefault: isDef,
					}).Error; err != nil {
						return err
					}
				}
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
		models.SendInternalErrorLogged(c, "Failed to update user", err)
		return
	}

	h.audit(c, "UPDATE_USER", "users", user.ID, map[string]interface{}{
		"username": user.Username,
		"role":     user.Role,
	})

	var userStores []models.UserStore
	var updatedStores []models.StoreResponse
	var defaultStoreID *uint
	if err := h.db.Where("user_id = ?", user.ID).Find(&userStores).Error; err == nil && len(userStores) > 0 {
		var storeIDs []uint
		for _, us := range userStores {
			storeIDs = append(storeIDs, us.StoreID)
		}
		var stores []models.Store
		if err := h.db.Where("id IN ?", storeIDs).Find(&stores).Error; err == nil {
			storeMap := make(map[uint]models.Store, len(stores))
			for _, s := range stores {
				storeMap[s.ID] = s
			}
			for _, us := range userStores {
				if s, ok := storeMap[us.StoreID]; ok {
					if us.IsDefault {
						idCopy := us.StoreID
						defaultStoreID = &idCopy
					}
					updatedStores = append(updatedStores, models.StoreResponse{
						Store:     s,
						Role:      us.Role,
						IsDefault: us.IsDefault,
					})
				}
			}
		}
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
		Stores:             updatedStores,
		DefaultStoreID:     defaultStoreID,
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
