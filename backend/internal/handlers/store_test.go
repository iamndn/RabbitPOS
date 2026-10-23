package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/RabbitPOS/backend/internal/config"
	"github.com/RabbitPOS/backend/internal/middleware"
	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func storeTestRouter(db *gorm.DB, userID uint, role models.UserRole, multi bool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := NewStoreHandler(db, &config.Config{EnableMultiStore: multi}, nil)
	inject := func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Set("user_role", role)
		c.Set("username", "tester")
		c.Next()
	}
	g := r.Group("/api/v1", inject)
	g.GET("/stores", h.ListStores)
	sa := g.Group("", middleware.RequireSuperAdmin())
	sa.POST("/stores", h.CreateStore)
	sa.PUT("/stores/:id", h.UpdateStore)
	sa.GET("/stores/:id/members", h.ListMembers)
	sa.PUT("/stores/:id/members", h.UpsertMember)
	sa.DELETE("/stores/:id/members/:user_id", h.RemoveMember)
	sa.GET("/users", h.ListUsers)
	sa.POST("/users", h.CreateUser)
	return r
}

func doJSON(r *gin.Engine, method, path string, body interface{}) (*httptest.ResponseRecorder, map[string]interface{}) {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	var out map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

func errCode(out map[string]interface{}) string {
	if v, ok := out["error_code"].(string); ok {
		return v
	}
	if v, ok := out["code"].(string); ok {
		return v
	}
	return ""
}

func TestStoreCRUD_Endpoints(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	fx, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatal(err)
	}
	admin := storeTestRouter(db, fx.AdminUser.ID, models.RoleSuperAdmin, true)

	// Create.
	w, _ := doJSON(admin, "POST", "/api/v1/stores", map[string]interface{}{"code": "branch-2", "name": "Branch 2"})
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body.String())
	}
	var st models.Store
	db.Where("code = ?", "branch-2").First(&st)
	if st.ID == 0 {
		t.Fatal("store not persisted")
	}

	// Duplicate code.
	w, out := doJSON(admin, "POST", "/api/v1/stores", map[string]interface{}{"code": "BRANCH-2", "name": "Dup"})
	if w.Code != http.StatusConflict || errCode(out) != "STORE_CODE_TAKEN" {
		t.Errorf("duplicate: %d %s", w.Code, w.Body.String())
	}

	// Update name.
	w, _ = doJSON(admin, "PUT", "/api/v1/stores/"+itoa(st.ID), map[string]interface{}{"name": "Branch Two"})
	if w.Code != http.StatusOK {
		t.Errorf("update: %d %s", w.Code, w.Body.String())
	}

	// Staff-level caller is forbidden; list is limited to memberships.
	staff := storeTestRouter(db, fx.StaffUser.ID, models.RoleStaff, true)
	w, _ = doJSON(staff, "POST", "/api/v1/stores", map[string]interface{}{"code": "nope", "name": "Nope"})
	if w.Code != http.StatusForbidden {
		t.Errorf("staff create should be 403, got %d", w.Code)
	}
	w, _ = doJSON(staff, "GET", "/api/v1/stores", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("staff list: %d", w.Code)
	}

	// Members: add, list, remove.
	w, _ = doJSON(admin, "PUT", "/api/v1/stores/"+itoa(st.ID)+"/members", map[string]interface{}{"user_id": fx.StaffUser.ID, "role": "staff"})
	if w.Code != http.StatusOK {
		t.Fatalf("add member: %d %s", w.Code, w.Body.String())
	}
	w, out = doJSON(staff, "GET", "/api/v1/stores", nil)
	if data, _ := out["data"].([]interface{}); len(data) != 1 {
		t.Errorf("staff should see exactly 1 store, got %d (%s)", len(data), w.Body.String())
	}
	w, _ = doJSON(admin, "GET", "/api/v1/stores/"+itoa(st.ID)+"/members", nil)
	if w.Code != http.StatusOK {
		t.Errorf("list members: %d", w.Code)
	}
	w, _ = doJSON(admin, "DELETE", "/api/v1/stores/"+itoa(st.ID)+"/members/"+itoa(fx.StaffUser.ID), nil)
	if w.Code != http.StatusOK {
		t.Errorf("remove member: %d", w.Code)
	}
	w, _ = doJSON(admin, "DELETE", "/api/v1/stores/"+itoa(st.ID)+"/members/"+itoa(fx.StaffUser.ID), nil)
	if w.Code != http.StatusNotFound {
		t.Errorf("remove missing member should 404, got %d", w.Code)
	}

	// Deactivate: allowed while another store is active; blocked for the last active store.
	f := false
	w, _ = doJSON(admin, "PUT", "/api/v1/stores/"+itoa(st.ID), map[string]interface{}{"is_active": &f})
	if w.Code != http.StatusOK {
		t.Errorf("deactivate: %d %s", w.Code, w.Body.String())
	}
	w, out = doJSON(admin, "PUT", "/api/v1/stores/1", map[string]interface{}{"is_active": &f})
	if w.Code != http.StatusConflict || errCode(out) != "STORE_LAST_ACTIVE" {
		t.Errorf("last active: %d %s", w.Code, w.Body.String())
	}

	// Users: create with membership, duplicate, list.
	w, _ = doJSON(admin, "POST", "/api/v1/users", map[string]interface{}{
		"username": "newcashier", "temp_password": "secret12", "role": "staff",
		"memberships": []map[string]interface{}{{"store_id": 1, "role": "staff"}}})
	if w.Code != http.StatusCreated {
		t.Fatalf("create user: %d %s", w.Code, w.Body.String())
	}
	var u models.User
	db.Where("username = ?", "newcashier").First(&u)
	if u.Role != models.RoleStaff || !u.NeedsPasswordSetup || u.PasswordHash == "" || u.PasswordHash == "secret12" {
		t.Errorf("user not created correctly: %+v", u)
	}
	w, out = doJSON(admin, "POST", "/api/v1/users", map[string]interface{}{"username": "NewCashier", "temp_password": "secret12", "role": "staff"})
	if w.Code != http.StatusConflict || errCode(out) != "USER_EXISTS" {
		t.Errorf("dup user: %d %s", w.Code, w.Body.String())
	}
	w, _ = doJSON(admin, "GET", "/api/v1/users", nil)
	if w.Code != http.StatusOK {
		t.Errorf("list users: %d", w.Code)
	}
}

func TestCreateStore_DisabledFlag(t *testing.T) {
	db := testutils.GetTestDB(t)
	if db == nil {
		return
	}
	fx, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatal(err)
	}
	r := storeTestRouter(db, fx.AdminUser.ID, models.RoleSuperAdmin, false)
	w, out := doJSON(r, "POST", "/api/v1/stores", map[string]interface{}{"code": "off", "name": "Off"})
	if w.Code != http.StatusForbidden || errCode(out) != "MULTI_STORE_DISABLED" {
		t.Errorf("expected MULTI_STORE_DISABLED, got %d %s", w.Code, w.Body.String())
	}
}

func TestRequireRole_SuperAdminInheritsAdmin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/x", func(c *gin.Context) { c.Set("user_role", models.RoleSuperAdmin); c.Next() },
		middleware.RequireRole(models.RoleAdmin), func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/x", nil))
	if w.Code != http.StatusOK {
		t.Errorf("super_admin must pass RequireRole(admin), got %d", w.Code)
	}
}

func itoa(n uint) string { return strconv.FormatUint(uint64(n), 10) }
