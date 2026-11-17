package services

import (
	"testing"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"
)

func TestAutoCancelExpiredRequests(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// 1) Create a request that is expired (shift_date + duration < now)
	expiredRequest := models.Request{
		RequiredSkills: []string{"skill1"},
		ShiftDate:      testutils.TodayUTC().Add(-3 * time.Hour), // 3 hours ago
		Duration:       1,                                        // 1 hour
		Status:         models.StatusPending,
	}

	if err := db.Create(&expiredRequest).Error; err != nil {
		t.Fatalf("failed to create expired request: %v", err)
	}

	// 2) Create a request that is not expired
	futureRequest := models.Request{
		RequiredSkills: []string{"skill1"},
		ShiftDate:      testutils.TodayUTC().Add(2 * time.Hour), // 2 hours in future
		Duration:       1,
		Status:         models.StatusPending,
	}

	if err := db.Create(&futureRequest).Error; err != nil {
		t.Fatalf("failed to create future request: %v", err)
	}

	// 3) Run AutoCancelExpiredRequests
	if err := AutoCancelExpiredRequests(db); err != nil {
		t.Fatalf("AutoCancelExpiredRequests failed: %v", err)
	}

	// 4) Verify expired request is cancelled
	var r models.Request
	if err := db.First(&r, expiredRequest.ID).Error; err != nil {
		t.Fatalf("failed to fetch expired request: %v", err)
	}
	if r.Status != models.StatusCancelled {
		t.Errorf("expected expired request to be CANCELLED, got %s", r.Status)
	}
}

func TestAutoCancelExpiredRequests_NoPendingRequests(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// No requests in DB
	if err := AutoCancelExpiredRequests(db); err != nil {
		t.Fatalf("AutoCancelExpiredRequests failed: %v", err)
	}
	// Nothing to assert, just ensure no panic or error
}

func TestAutoCancelExpiredRequests_QueryError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Drop the table so the query fails
	if err := db.Migrator().DropTable(&models.Request{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	err := AutoCancelExpiredRequests(db)

	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestAutoCancelExpiredRequests_UpdateError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create an expired request so the update branch runs
	expiredRequest := models.Request{
		RequiredSkills: []string{"skill1"},
		ShiftDate:      testutils.TodayUTC().Add(-3 * time.Hour),
		Duration:       1,
		Status:         models.StatusPending,
	}

	if err := db.Create(&expiredRequest).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Add a constraint that makes the update fail
	db.Exec(`CREATE TRIGGER fail_update
	BEFORE UPDATE ON requests
	BEGIN
		SELECT RAISE(FAIL, "forced update failure");
	END;
	`)

	err := AutoCancelExpiredRequests(db)

	if err == nil {
		t.Fatal("expected error from update but got nil")
	}
}
