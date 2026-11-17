package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"
)

func TestGetShifts_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	// Seed DB
	db.Create(&models.Shift{
		NurseID:       1,
		RequestID:     1,
		StartDateTime: time.Now(),
		EndDateTime:   time.Now().Add(2 * time.Hour),
	})

	req := httptest.NewRequest(http.MethodGet, "/shifts", nil)
	w := httptest.NewRecorder()

	handler.GetShifts(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}

	var shifts []models.Shift
	if err := json.NewDecoder(w.Result().Body).Decode(&shifts); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(shifts) != 1 {
		t.Fatalf("expected 1 shift, got %d", len(shifts))
	}
}

func TestGetShifts_Empty(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/shifts", nil)
	w := httptest.NewRecorder()

	handler.GetShifts(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}

	var shifts []models.Shift
	if err := json.NewDecoder(w.Result().Body).Decode(&shifts); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(shifts) != 0 {
		t.Fatalf("expected 0 shifts, got %d", len(shifts))
	}
}

func TestGetTodayShifts_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	todayUTC := testutils.TodayUTC()

	// Shift that starts today (local Toronto day)
	db.Create(&models.Shift{
		NurseID:       1,
		RequestID:     1,
		StartDateTime: todayUTC.Add(10 * time.Hour),
		EndDateTime:   todayUTC.Add(12 * time.Hour),
	})

	// Shift that starts tomorrow (should be excluded)
	db.Create(&models.Shift{
		NurseID:       2,
		RequestID:     2,
		StartDateTime: todayUTC.Add(26 * time.Hour),
		EndDateTime:   todayUTC.Add(28 * time.Hour),
	})

	req := httptest.NewRequest(http.MethodGet, "/shifts/today", nil)
	w := httptest.NewRecorder()

	handler.GetTodayShifts(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}

	var shifts []models.Shift
	if err := json.NewDecoder(w.Result().Body).Decode(&shifts); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(shifts) != 1 {
		t.Fatalf("expected 1 shift, got %d", len(shifts))
	}
}

func TestGetTodayShifts_Empty(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	todayUTC := testutils.TodayUTC()

	// Only non-today shift
	db.Create(&models.Shift{
		NurseID:       1,
		RequestID:     1,
		StartDateTime: todayUTC.Add(-2 * time.Hour),
		EndDateTime:   todayUTC.Add(-1 * time.Hour),
	})

	req := httptest.NewRequest(http.MethodGet, "/shifts/today", nil)
	w := httptest.NewRecorder()

	handler.GetTodayShifts(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}

	var shifts []models.Shift
	if err := json.NewDecoder(w.Result().Body).Decode(&shifts); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(shifts) != 0 {
		t.Fatalf("expected 0 shifts, got %d", len(shifts))
	}
}

func TestGetShifts_FetchError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Shift{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/shifts", nil)
	w := httptest.NewRecorder()

	handler.GetShifts(w, req)

	if w.Result().StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Result().StatusCode)
	}
}

func TestGetTodayShifts_FetchError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &ShiftHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Shift{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/shifts", nil)
	w := httptest.NewRecorder()

	handler.GetTodayShifts(w, req)

	if w.Result().StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Result().StatusCode)
	}
}