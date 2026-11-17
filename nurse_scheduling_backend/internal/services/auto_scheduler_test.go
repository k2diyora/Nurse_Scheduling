package services

import (
	"testing"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"
)

// --------------------------------------------------
// TEST 1: No pending request → returns nil, nil
// --------------------------------------------------
func TestAutoScheduleOne_NoRequest(t *testing.T) {
	db := testutils.SetupTestDB(t)

	shift, err := AutoScheduleOne(db)

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if shift != nil {
		t.Fatalf("expected nil shift, got %+v", shift)
	}
}

// --------------------------------------------------
// TEST 2: Request exists but no matching nurse
// --------------------------------------------------
func TestAutoScheduleOne_NoMatchingNurse(t *testing.T) {
	db := testutils.SetupTestDB(t)

	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}

	db.Create(&req)

	// Nurse does NOT have ICU skill
	nurse := models.Nurse{
		Available: true,
		Skills:    []string{"ER"},
	}
	db.Create(&nurse)

	shift, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	if shift != nil {
		t.Fatalf("expected nil shift")
	}
}

// --------------------------------------------------
// TEST 3: Successful scheduling
// --------------------------------------------------
func TestAutoScheduleOne_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)

	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}
	db.Create(&req)

	nurse := models.Nurse{
		Available: true,
		Skills:    []string{"ICU"},
	}
	db.Create(&nurse)

	shift, err := AutoScheduleOne(db)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if shift == nil {
		t.Fatalf("expected shift, got nil")
	}

	// Verify shift created
	var count int64
	db.Model(&models.Shift{}).Count(&count)
	if count != 1 {
		t.Fatalf("expected 1 shift, got %d", count)
	}

	// Verify nurse marked unavailable
	var updatedNurse models.Nurse
	db.First(&updatedNurse, nurse.ID)
	if updatedNurse.Available {
		t.Fatalf("expected nurse to be unavailable")
	}

	// Verify request status updated
	var updatedReq models.Request
	db.First(&updatedReq, req.ID)
	if updatedReq.Status != models.StatusAssigned {
		t.Fatalf("expected request status ASSIGNED, got %v", updatedReq.Status)
	}
}

func TestAutoScheduler_QueryError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Drop the table so the query fails
	if err := db.Migrator().DropTable(&models.Request{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	_, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestAutoScheduler_NurseQueryError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}
	db.Create(&req)

	// Drop the table so the query fails
	if err := db.Migrator().DropTable(&models.Nurse{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	_, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestAutoScheduler_ShiftsQueryError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"ICU", "Wound"},
		Available: true,
	}

	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	if err := db.Migrator().DropTable(&models.Shift{}); err != nil {
		t.Fatalf("failed to drop shift table: %v", err)
	}

	_, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestAutoScheduler_NurseUpdateError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create a pending request
	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"ICU", "Wound"},
		Available: true,
	}

	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	db.Exec(`CREATE TRIGGER fail_update
	BEFORE UPDATE ON nurses
	BEGIN
		SELECT RAISE(FAIL, "forced update failure");
	END;
	`)

	_, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatal("expected error on nurse update but got nil")
	}
}

func TestAutoScheduler_RequestsUpdateError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create a pending request
	req := models.Request{
		Status:         models.StatusPending,
		ShiftDate:      testutils.TodayUTC(),
		Duration:       8,
		RequiredSkills: []string{"ICU"},
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"ICU", "Wound"},
		Available: true,
	}

	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	db.Exec(`CREATE TRIGGER fail_update
	BEFORE UPDATE ON requests
	BEGIN
		SELECT RAISE(FAIL, "forced update failure");
	END;
	`)

	_, err := AutoScheduleOne(db)

	if err == nil {
		t.Fatal("expected error on req update but got nil")
	}
}

func TestNurseHasAllSkills(t *testing.T) {
	nurseSkills := []string{"ICU"}

	requiredSkills := []string{}

	if !nurseHasAllSkills(nurseSkills, requiredSkills) {
		t.Fatal("expected true when requiredSkills is empty")
	}

}