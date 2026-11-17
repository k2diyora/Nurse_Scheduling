package services

import (
	"testing"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"
)

func TestAutoCompleteShifts_NoShifts(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// No shifts in DB, should not error
	err := AutoCompleteShifts(db)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestAutoCompleteShifts_ShiftsCompleted(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create nurse
	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"IV", "Wound"},
		Available: false,
	}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	// Create request
	req := models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      testutils.TodayUTC().Add(-2 * time.Hour), // 2 hours ago
		Duration:       1,
		Status:         models.StatusAssigned,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	// Create shift that ended 1+ hour ago
	shift := models.Shift{
		NurseID:       nurse.ID,
		RequestID:     req.ID,
		StartDateTime: req.ShiftDate,
		EndDateTime:   req.ShiftDate.Add(time.Duration(req.Duration) * time.Hour),
	}
	if err := db.Create(&shift).Error; err != nil {
		t.Fatalf("failed to create shift: %v", err)
	}

	// Run autocomplete
	if err := AutoCompleteShifts(db); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// Verify nurse is available again
	var updatedNurse models.Nurse
	if err := db.First(&updatedNurse, nurse.ID).Error; err != nil {
		t.Fatalf("failed to fetch nurse: %v", err)
	}
	if !updatedNurse.Available {
		t.Fatalf("expected nurse to be available, got false")
	}

	// Verify request status is COMPLETED
	var updatedReq models.Request
	if err := db.First(&updatedReq, req.ID).Error; err != nil {
		t.Fatalf("failed to fetch request: %v", err)
	}
	if updatedReq.Status != models.StatusCompleted {
		t.Fatalf("expected request status COMPLETED, got %s", updatedReq.Status)
	}
}

func TestAutoCompleteShifts_QueryError(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Drop the table so the query fails
	if err := db.Migrator().DropTable(&models.Shift{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	err := AutoCompleteShifts(db)

	if err == nil {
		t.Fatal("expected error but got nil")
	}
}

func TestAutoCompleteShifts_UpdateErrorNurse(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create an expired request so the update branch runs
	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"IV", "Wound"},
		Available: false,
	}

	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	// Create request
	req := models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      testutils.TodayUTC().Add(-2 * time.Hour), // 2 hours ago
		Duration:       1,
		Status:         models.StatusAssigned,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	shift := models.Shift{
		NurseID:       nurse.ID,
		RequestID:     req.ID,
		StartDateTime: req.ShiftDate,
		EndDateTime:   req.ShiftDate.Add(time.Duration(req.Duration) * time.Hour),
	}
	if err := db.Create(&shift).Error; err != nil {
		t.Fatalf("failed to create shift: %v", err)
	}

	// Add a constraint that makes the update fail
	db.Exec(`CREATE TRIGGER fail_update
	BEFORE UPDATE ON nurses
	BEGIN
		SELECT RAISE(FAIL, "forced update failure");
	END;
	`)

	err := AutoCompleteShifts(db)

	if err == nil {
		t.Fatal("expected error from update but got nil")
	}
}

func TestAutoCompleteShifts_UpdateErrorShifts(t *testing.T) {
	db := testutils.SetupTestDB(t)

	// Create an expired request so the update branch runs
	nurse := models.Nurse{
		Name:      "Alice",
		Skills:    []string{"IV", "Wound"},
		Available: false,
	}

	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	// Create request
	req := models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      testutils.TodayUTC().Add(-2 * time.Hour), // 2 hours ago
		Duration:       1,
		Status:         models.StatusAssigned,
	}
	if err := db.Create(&req).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	shift := models.Shift{
		NurseID:       nurse.ID,
		RequestID:     req.ID,
		StartDateTime: req.ShiftDate,
		EndDateTime:   req.ShiftDate.Add(time.Duration(req.Duration) * time.Hour),
	}
	if err := db.Create(&shift).Error; err != nil {
		t.Fatalf("failed to create shift: %v", err)
	}

	// Add a constraint that makes the update fail

	db.Exec(`CREATE TRIGGER fail_update
	BEFORE UPDATE ON requests
	BEGIN
		SELECT RAISE(FAIL, "forced update failure");
	END;
	`)

	err := AutoCompleteShifts(db)

	if err == nil {
		t.Fatal("expected error from update but got nil")
	}
}
