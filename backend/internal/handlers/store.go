package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/services"
	"github.com/RabbitPOS/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// StoreHandler serves store CRUD, membership and user-assignment endpoints.
type StoreHandler struct {
	db       *gorm.DB
	cfg      *config.Config
	svc      *services.StoreService
	auditSvc *services.AuditService
}

func NewStoreHandler(db *gorm.DB, cfg *config.Config, auditSvc *services.AuditService) *StoreHandler {
	return &StoreHandler{db: db, cfg: cfg, svc: services.NewStoreService(db), auditSvc: auditSvc}
}

func (h *StoreHandler) callerID(c *gin.Context) uint {
	v, _ := c.Get("user_id")
	id, _ := v.(uint)
	return id
}

func (h *StoreHandler) callerRole(c *gin.Context) models.UserRole {
	v, _ := c.Get("user_role")
	r, _ := v.(models.UserRole)
	return r
}

func (h *StoreHandler) audit(c *gin.Context, action, resource string, id uint, meta map[string]interface{}) {
	if h.auditSvc == nil {
		return
	}
	uid := h.callerID(c)
	username, _ := c.Get("username")
	un, _ := username.(string)
	rid := strconv.FormatUint(uint64(id), 10)
	h.auditSvc.RecordLog(&uid, un, string(h.callerRole(c)), action, resource, &rid, "success", c.ClientIP(), c.Request.UserAgent(), meta)
}

// respondErr maps StoreError to the standard envelope, otherwise 500.
func (h *StoreHandler) respondErr(c *gin.Context, err error) {
	var se *services.StoreError
	if errors.As(err, &se) {
		models.SendErrorCode(c, se.Status, se.Code, se.Message)
		return
	}
	models.SendInternalErrorLogged(c, "Internal server error", err)
}

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	n, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || n == 0 {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid "+name)
		return 0, false
	}
	return uint(n), true
}

// ListStores returns stores accessible to the caller (all for super_admin).
func (h *StoreHandler) ListStores(c *gin.Context) {
	uid := h.callerID(c)
	out := []models.StoreResponse{}

	var stores []models.Store
	var memberships []models.UserStore
	if err := h.db.Where("user_id = ?", uid).Find(&memberships).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load stores", err)
		return
	}
	byStore := map[uint]models.UserStore{}
	for _, m := range memberships {
		byStore[m.StoreID] = m
	}

	q := h.db.Order("id ASC")
	isSuper := h.callerRole(c).IsSuperAdmin()
	if !isSuper {
		ids := make([]uint, 0, len(byStore))
		for id := range byStore {
			ids = append(ids, id)
		}
		if len(ids) == 0 {
			models.SendSuccess(c, http.StatusOK, out, "Stores retrieved")
			return
		}
		q = q.Where("id IN ?", ids)
	}
	if err := q.Find(&stores).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load stores", err)
		return
	}

	type cnt struct {
		StoreID uint
		N       int64
	}
	var counts []cnt
	_ = h.db.Model(&models.UserStore{}).Select("store_id, COUNT(*) AS n").Group("store_id").Scan(&counts).Error
	cm := map[uint]int64{}
	for _, x := range counts {
		cm[x.StoreID] = x.N
	}

	for _, s := range stores {
		r := models.StoreResponse{Store: s, MemberCount: cm[s.ID]}
		if m, ok := byStore[s.ID]; ok {
			r.Role, r.IsDefault = m.Role, m.IsDefault
		}
		if isSuper {
			r.Role = models.StoreRoleSuperAdmin
		}
		if !isSuper && !s.IsActive {
			continue
		}
		out = append(out, r)
	}
	models.SendSuccess(c, http.StatusOK, out, "Stores retrieved")
}

// CreateStore creates a new store (super_admin only, gated by ENABLE_MULTI_STORE).
func (h *StoreHandler) CreateStore(c *gin.Context) {
	if h.cfg != nil && !h.cfg.EnableMultiStore {
		models.SendErrorCode(c, http.StatusForbidden, "MULTI_STORE_DISABLED", "Multi-store creation is disabled")
		return
	}
	var req models.CreateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload")
		return
	}
	store, err := h.svc.CreateStore(h.callerID(c), req)
	if err != nil {
		h.respondErr(c, err)
		return
	}
	h.audit(c, "store.create", "store", store.ID, map[string]interface{}{"code": store.Code, "cloned_from": req.CloneFromStoreID})
	models.SendSuccess(c, http.StatusCreated, store, "Store created")
}

// UpdateStore applies a partial update; the last active store cannot be deactivated.
func (h *StoreHandler) UpdateStore(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var req models.UpdateStoreRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload")
		return
	}
	var store models.Store
	if err := h.db.First(&store, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			models.SendErrorCode(c, http.StatusNotFound, "STORE_NOT_FOUND", "Store not found")
			return
		}
		models.SendInternalErrorLogged(c, "Failed to load store", err)
		return
	}
	if req.Code != nil {
		store.Code = *req.Code
	}
	if req.Name != nil {
		store.Name = *req.Name
	}
	if req.BusinessType != nil {
		store.BusinessType = *req.BusinessType
	}
	if req.LogoURL != nil {
		store.LogoURL = *req.LogoURL
	}
	if req.Address != nil {
		store.Address = *req.Address
	}
	if req.Phone != nil {
		store.Phone = *req.Phone
	}
	if req.CurrencyCode != nil {
		store.CurrencyCode = *req.CurrencyCode
	}
	if req.CurrencySymbol != nil {
		store.CurrencySymbol = *req.CurrencySymbol
	}
	if req.CurrencyPosition != nil {
		store.CurrencyPosition = *req.CurrencyPosition
	}
	if req.VietQRBankID != nil {
		store.VietQRBankID = *req.VietQRBankID
	}
	if req.VietQRAccountNo != nil {
		store.VietQRAccountNo = *req.VietQRAccountNo
	}
	if req.VietQRAccountName != nil {
		store.VietQRAccountName = *req.VietQRAccountName
	}
	if req.Timezone != nil {
		store.Timezone = *req.Timezone
	}
	if err := services.ValidateStoreFields(&store); err != nil {
		h.respondErr(c, err)
		return
	}

	err := h.db.Transaction(func(tx *gorm.DB) error {
		taken, err := services.CodeTaken(tx, store.Code, store.ID)
		if err != nil {
			return err
		}
		if taken {
			return &services.StoreError{Status: http.StatusConflict, Code: "STORE_CODE_TAKEN", Message: "Store code already in use"}
		}
		if req.IsActive != nil {
			if !*req.IsActive && store.IsActive {
				var others int64
				if err := tx.Model(&models.Store{}).Where("is_active = TRUE AND id <> ?", store.ID).Count(&others).Error; err != nil {
					return err
				}
				if others == 0 {
					return &services.StoreError{Status: http.StatusConflict, Code: "STORE_LAST_ACTIVE", Message: "Cannot deactivate the last active store"}
				}
			}
			store.IsActive = *req.IsActive
		}
		return tx.Save(&store).Error
	})
	if err != nil {
		h.respondErr(c, err)
		return
	}
	h.audit(c, "store.update", "store", store.ID, nil)
	models.SendSuccess(c, http.StatusOK, store, "Store updated")
}

// ListMembers returns the store's members.
func (h *StoreHandler) ListMembers(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if !h.storeExists(c, id) {
		return
	}
	out := []models.StoreMemberResponse{}
	err := h.db.Table("user_stores AS us").
		Select("u.id AS user_id, u.username, u.email, u.role AS global_role, u.is_active, u.needs_password_setup, us.role, us.is_default").
		Joins("JOIN users u ON u.id = us.user_id").
		Where("us.store_id = ?", id).Order("u.username ASC").Scan(&out).Error
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to load members", err)
		return
	}
	models.SendSuccess(c, http.StatusOK, out, "Members retrieved")
}

func (h *StoreHandler) storeExists(c *gin.Context, id uint) bool {
	var n int64
	if err := h.db.Model(&models.Store{}).Where("id = ?", id).Count(&n).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load store", err)
		return false
	}
	if n == 0 {
		models.SendErrorCode(c, http.StatusNotFound, "STORE_NOT_FOUND", "Store not found")
		return false
	}
	return true
}

// UpsertMember adds or updates a member's role in the store.
func (h *StoreHandler) UpsertMember(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	var req models.StoreMemberInput
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload")
		return
	}
	if !h.storeExists(c, id) {
		return
	}
	if err := h.svc.UpsertMember(id, req); err != nil {
		h.respondErr(c, err)
		return
	}
	h.audit(c, "store.member_upsert", "store", id, map[string]interface{}{"user_id": req.UserID, "role": req.Role})
	models.SendSuccess(c, http.StatusOK, nil, "Member saved")
}

// RemoveMember removes a user from the store.
func (h *StoreHandler) RemoveMember(c *gin.Context) {
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	uid, ok := parseUintParam(c, "user_id")
	if !ok {
		return
	}
	if err := h.svc.RemoveMember(id, uid); err != nil {
		h.respondErr(c, err)
		return
	}
	h.audit(c, "store.member_remove", "store", id, map[string]interface{}{"user_id": uid})
	models.SendSuccess(c, http.StatusOK, nil, "Member removed")
}

// ListUsers returns all users with their memberships (for member assignment).
func (h *StoreHandler) ListUsers(c *gin.Context) {
	var users []models.User
	if err := h.db.Order("username ASC").Find(&users).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load users", err)
		return
	}
	var all []models.UserStore
	if err := h.db.Order("store_id ASC").Find(&all).Error; err != nil {
		models.SendInternalErrorLogged(c, "Failed to load memberships", err)
		return
	}
	by := map[uint][]models.UserMembership{}
	for _, m := range all {
		by[m.UserID] = append(by[m.UserID], models.UserMembership{StoreID: m.StoreID, Role: m.Role, IsDefault: m.IsDefault})
	}
	out := make([]models.UserListItem, 0, len(users))
	for _, u := range users {
		ms := by[u.ID]
		if ms == nil {
			ms = []models.UserMembership{}
		}
		out = append(out, models.UserListItem{ID: u.ID, Username: u.Username, Email: u.Email, Role: u.Role,
			IsActive: u.IsActive, NeedsPasswordSetup: u.NeedsPasswordSetup, Memberships: ms})
	}
	models.SendSuccess(c, http.StatusOK, out, "Users retrieved")
}

// CreateUser creates a user with a temporary password and optional store memberships.
func (h *StoreHandler) CreateUser(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid request payload")
		return
	}
	req.Username = strings.TrimSpace(req.Username)

	globalRole := models.RoleStaff
	switch req.Role {
	case models.StoreRoleSuperAdmin:
		globalRole = models.RoleSuperAdmin
	case models.StoreRoleStoreAdmin, models.StoreRoleStaff:
	default:
		models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid role")
		return
	}
	for _, m := range req.Memberships {
		if !m.Role.IsAssignable() {
			models.SendErrorCode(c, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid membership role")
			return
		}
	}
	hash, err := utils.HashPassword(req.TempPassword)
	if err != nil {
		models.SendInternalErrorLogged(c, "Failed to create user", err)
		return
	}

	user := models.User{Username: req.Username, Email: req.Email, PasswordHash: hash, Role: globalRole,
		IsActive: true, NeedsPasswordSetup: true}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var n int64
		if err := tx.Model(&models.User{}).Where("LOWER(username) = ?", strings.ToLower(req.Username)).Count(&n).Error; err != nil {
			return err
		}
		if n > 0 {
			return &services.StoreError{Status: http.StatusConflict, Code: "USER_EXISTS", Message: "Username already exists"}
		}
		for _, m := range req.Memberships {
			var sc int64
			if err := tx.Model(&models.Store{}).Where("id = ?", m.StoreID).Count(&sc).Error; err != nil {
				return err
			}
			if sc == 0 {
				return &services.StoreError{Status: http.StatusNotFound, Code: "STORE_NOT_FOUND", Message: "Store not found"}
			}
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		hasDefault := false
		for i, m := range req.Memberships {
			isDef := m.IsDefault && !hasDefault
			if i == 0 && !hasDefault && !anyDefault(req.Memberships) {
				isDef = true
			}
			if isDef {
				hasDefault = true
			}
			if err := tx.Create(&models.UserStore{UserID: user.ID, StoreID: m.StoreID, Role: m.Role, IsDefault: isDef}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		h.respondErr(c, err)
		return
	}
	h.audit(c, "user.create", "user", user.ID, map[string]interface{}{"username": user.Username, "role": req.Role})
	models.SendSuccess(c, http.StatusCreated, models.UserListItem{ID: user.ID, Username: user.Username, Email: user.Email,
		Role: user.Role, IsActive: true, NeedsPasswordSetup: true, Memberships: append([]models.UserMembership{}, req.Memberships...)}, "User created")
}

func anyDefault(ms []models.UserMembership) bool {
	for _, m := range ms {
		if m.IsDefault {
			return true
		}
	}
	return false
}
