package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/RabbitPOS/backend/internal/models"
	"github.com/RabbitPOS/backend/internal/testutils"
	"github.com/gin-gonic/gin"
)

func setupReconcileTestRouter(fundHandler *FundHandler, txHandler *TransactionHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("role", "admin")
		c.Set("username", "admin_boss")
		c.Set("user_id", uint(1))
		c.Next()
	})
	router.POST("/api/v1/funds/:id/reconcile", fundHandler.ReconcileFund)
	router.PUT("/api/v1/funds/:id/reconcile", fundHandler.UpdateReconciliation)
	router.DELETE("/api/v1/funds/:id/reconcile/latest", fundHandler.DeleteLatestReconciliation)
	router.DELETE("/api/v1/funds/:id/reconcile", fundHandler.DeleteLatestReconciliation)
	router.POST("/api/v1/funds/:id/reconcile/restore", fundHandler.RestorePreviousReconciliation)
	router.GET("/api/v1/funds/:id/reconcile/history", fundHandler.GetReconciliationHistory)
	router.DELETE("/api/v1/transactions/:id", txHandler.DeleteTransaction)
	return router
}

func TestReconcile_FullLifecycle_UpdateAndRestore(t *testing.T) {
	db := testutils.GetTestDB(t)
	_ = testutils.CleanTables(db)
	fixtures, err := testutils.SeedMinimalFixtures(db)
	if err != nil {
		t.Fatalf("Failed to seed fixtures: %v", err)
	}

	fundHandler := NewFundHandler(db, nil)
	txHandler := NewTransactionHandler(db, nil, nil)
	router := setupReconcileTestRouter(fundHandler, txHandler)

	initialBalance := fixtures.CashFund.CurrentBalance

	// 1. Initial Reconciliation with Surplus (+50,000)
	surplusTarget := initialBalance + 50000
	reconcilePayload1 := models.ReconcileFundRequest{
		ActualBalance: surplusTarget,
		Notes:         "Kiểm quỹ ca sáng thừa 50k",
		CreatedBy:     "manager",
	}
	body1, _ := json.Marshal(reconcilePayload1)
	req1, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/funds/%d/reconcile", fixtures.CashFund.ID), bytes.NewBuffer(body1))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)

	if w1.Code != http.StatusOK {
		t.Fatalf("Reconcile 1 failed: %s", w1.Body.String())
	}

	// 2. UPDATE Actual Reconciliation ("Cập nhật đối soát thực tế")
	// Counted again: actual is actually +80,000 (an additional 30,000 was found)
	updatedActualTarget := initialBalance + 80000
	updatePayload := models.UpdateReconcileRequest{
		ActualBalance: updatedActualTarget,
		Notes:         "Đếm lại két: phát hiện thêm 30k kẹp dưới khay",
	}
	bodyUpdate, _ := json.Marshal(updatePayload)
	reqUpdate, _ := http.NewRequest("PUT", fmt.Sprintf("/api/v1/funds/%d/reconcile", fixtures.CashFund.ID), bytes.NewBuffer(bodyUpdate))
	reqUpdate.Header.Set("Content-Type", "application/json")
	wUpdate := httptest.NewRecorder()
	router.ServeHTTP(wUpdate, reqUpdate)

	if wUpdate.Code != http.StatusOK {
		t.Fatalf("Update reconciliation failed: %s", wUpdate.Body.String())
	}

	// Verify fund balance adjusted to updatedActualTarget
	var fundAfterUpdate models.Fund
	db.First(&fundAfterUpdate, fixtures.CashFund.ID)
	if fundAfterUpdate.CurrentBalance != updatedActualTarget {
		t.Fatalf("Expected fund balance updated to %.0f, got %.0f", updatedActualTarget, fundAfterUpdate.CurrentBalance)
	}

	// Verify transaction amount was updated to 80,000
	var updatedTx models.Transaction
	if err := db.Where("fund_id = ? AND category = ?", fixtures.CashFund.ID, models.CategoryReconciliationVariance).
		Order("id desc").First(&updatedTx).Error; err != nil {
		t.Fatalf("Failed to find updated transaction: %v", err)
	}
	if updatedTx.Amount != 80000 || updatedTx.TransactionType != models.TransactionTypeInflow {
		t.Fatalf("Expected updated tx Amount 80000 Inflow, got %.0f %s", updatedTx.Amount, updatedTx.TransactionType)
	}

	// 3. Second Reconciliation with Deficit (-20,000)
	deficitTarget := updatedActualTarget - 20000
	reconcilePayload2 := models.ReconcileFundRequest{
		ActualBalance: deficitTarget,
		Notes:         "Kiểm quỹ ca tối thiếu 20k",
		CreatedBy:     "manager",
	}
	body2, _ := json.Marshal(reconcilePayload2)
	req2, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/funds/%d/reconcile", fixtures.CashFund.ID), bytes.NewBuffer(body2))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("Reconcile 2 failed: %s", w2.Body.String())
	}

	var fundAfterRec2 models.Fund
	db.First(&fundAfterRec2, fixtures.CashFund.ID)
	if fundAfterRec2.CurrentBalance != deficitTarget {
		t.Fatalf("Expected fund balance %.0f, got %.0f", deficitTarget, fundAfterRec2.CurrentBalance)
	}

	// 4. Delete/Revert latest reconciliation (-20,000)
	delLatestReq, _ := http.NewRequest("DELETE", fmt.Sprintf("/api/v1/funds/%d/reconcile/latest", fixtures.CashFund.ID), nil)
	wDelLatest := httptest.NewRecorder()
	router.ServeHTTP(wDelLatest, delLatestReq)

	if wDelLatest.Code != http.StatusOK {
		t.Fatalf("Deleting latest reconciliation failed: %s", wDelLatest.Body.String())
	}

	// Fund balance reverts back to updatedActualTarget (deficit was reverted)
	var fundAfterRevert models.Fund
	db.First(&fundAfterRevert, fixtures.CashFund.ID)
	if fundAfterRevert.CurrentBalance != updatedActualTarget {
		t.Fatalf("Expected fund balance restored to %.0f, got %.0f", updatedActualTarget, fundAfterRevert.CurrentBalance)
	}

	// 5. RESTORE the previously reverted reconciliation ("Khôi phục lệnh đối soát trước đó")
	restoreReq, _ := http.NewRequest("POST", fmt.Sprintf("/api/v1/funds/%d/reconcile/restore", fixtures.CashFund.ID), nil)
	wRestore := httptest.NewRecorder()
	router.ServeHTTP(wRestore, restoreReq)

	if wRestore.Code != http.StatusOK {
		t.Fatalf("Restoring reconciliation failed: %s", wRestore.Body.String())
	}

	// Fund balance returns to deficitTarget
	var fundAfterRestore models.Fund
	db.First(&fundAfterRestore, fixtures.CashFund.ID)
	if fundAfterRestore.CurrentBalance != deficitTarget {
		t.Fatalf("Expected fund balance after restore to be %.0f, got %.0f", deficitTarget, fundAfterRestore.CurrentBalance)
	}

	// 6. Test GET Reconciliation History
	histReq, _ := http.NewRequest("GET", fmt.Sprintf("/api/v1/funds/%d/reconcile/history", fixtures.CashFund.ID), nil)
	wHist := httptest.NewRecorder()
	router.ServeHTTP(wHist, histReq)

	if wHist.Code != http.StatusOK {
		t.Fatalf("Get history failed: %s", wHist.Body.String())
	}

	var histResp struct {
		Data []models.FundReconciliation `json:"data"`
	}
	_ = json.Unmarshal(wHist.Body.Bytes(), &histResp)
	if len(histResp.Data) == 0 {
		t.Fatalf("Expected non-empty reconciliation history")
	}
}
