package handlers

import (
	"bytes"
	"strings"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"

	"github.com/gorilla/mux"
)

func TestCreateRequest_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	payload := models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      time.Now(),
		Duration:       2,
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/requests", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	handler.CreateRequest(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}

	// Verify it was saved
	var requests []models.Request
	if err := db.Find(&requests).Error; err != nil {
		t.Fatalf("failed to fetch requests: %v", err)
	}

	if len(requests) != 1 {
		t.Fatalf("expected 1 request, got %d", len(requests))
	}
}

func TestCreateRequest_InvalidMethod(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/requests", nil)
	w := httptest.NewRecorder()

	handler.CreateRequest(w, req)

	if w.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Result().StatusCode)
	}
}

func TestCreateRequest_InvalidBody(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodPost, "/requests", bytes.NewBuffer([]byte("bad-json")))
	w := httptest.NewRecorder()

	handler.CreateRequest(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestGetRequests(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	// Seed DB
	db.Create(&models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      time.Now(),
		Duration:       1,
		Status:         models.StatusPending,
	})

	req := httptest.NewRequest(http.MethodGet, "/requests", nil)
	w := httptest.NewRecorder()

	handler.GetRequests(w, req)

	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}
}

func TestUpdateRequest_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	request := models.Request{
		PatientID:        1,
		PatientFirstName: "Alice",
		PatientLastName:  "Smith",
		RequiredSkills:   []string{"IV"},
		ShiftDate:        time.Now().UTC(),
		Duration:         2,
		Status:           models.StatusPending,
	}
	if err := db.Create(&request).Error; err != nil {
		t.Fatalf("failed to seed request: %v", err)
	}

	body := bytes.NewBufferString(`{"patient_first_name":"Bob","required_skills":["ER"],"duration":4,"status":"PENDING"}`)
	req := httptest.NewRequest(http.MethodPut, "/requests/1", body)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	resp := w.Result()
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var updated models.Request
	if err := json.NewDecoder(resp.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if updated.PatientFirstName != "Bob" {
		t.Errorf("expected updated first name, got %s", updated.PatientFirstName)
	}
	if updated.Duration != 4 {
		t.Errorf("expected updated duration 4, got %d", updated.Duration)
	}
	if len(updated.RequiredSkills) != 1 || updated.RequiredSkills[0] != "ER" {
		t.Errorf("expected updated skills, got %+v", updated.RequiredSkills)
	}
}

func TestUpdateRequest_NotFound(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodPut, "/requests/999", bytes.NewBufferString(`{"duration":3}`))
	req = mux.SetURLVars(req, map[string]string{"id": "999"})
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	if w.Result().StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Result().StatusCode)
	}
}

func TestUpdateRequest_InvalidID(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodPut, "/requests/abc", bytes.NewBufferString(`{"duration":3}`))
	req = mux.SetURLVars(req, map[string]string{"id": "abc"})
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestUpdateRequest_InvalidBody(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	request := models.Request{RequiredSkills: []string{"IV"}, ShiftDate: time.Now().UTC(), Duration: 1, Status: models.StatusPending}
	if err := db.Create(&request).Error; err != nil {
		t.Fatalf("failed to seed request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/requests/1", bytes.NewBufferString(`{bad-json`))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestDeleteRequest_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	request := models.Request{RequiredSkills: []string{"IV"}, ShiftDate: time.Now().UTC(), Duration: 1, Status: models.StatusPending}
	if err := db.Create(&request).Error; err != nil {
		t.Fatalf("failed to seed request: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/requests/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.DeleteRequest(w, req)

	if w.Result().StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Result().StatusCode)
	}
}

func TestDeleteRequest_NotFound(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodDelete, "/requests/999", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "999"})
	w := httptest.NewRecorder()

	handler.DeleteRequest(w, req)

	if w.Result().StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Result().StatusCode)
	}
}

func TestDeleteRequest_InvalidID(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodDelete, "/requests/abc", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "abc"})
	w := httptest.NewRecorder()

	handler.DeleteRequest(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestCreateRequest_DBCreationError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	payload := models.Request{
		RequiredSkills: []string{"IV"},
		ShiftDate:      time.Now(),
		Duration:       2,
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/requests", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	if err := db.Migrator().DropTable(&models.Request{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	handler.CreateRequest(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("Expected 500, got %d", w.Code)
	}
}

func TestGetRequests_FetchError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/requests", nil)
	w := httptest.NewRecorder()

	if err := db.Migrator().DropTable(&models.Request{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	handler.GetRequests(w, req)

	if w.Result().StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Result().StatusCode)
	}
}

func TestUpdateRequest_MethodNotAllowed(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/requests/1", nil)
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestUpdateRequest_DBFetchError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Request{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/requests/1", strings.NewReader(`{}`))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.UpdateRequest(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestUpdateRequest_AllFields(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &RequestHandler{DB: db}

	reqModel := models.Request{
		PatientID:        1,
		PatientFirstName: "Old",
		PatientLastName:  "Name",
		RequiredSkills:   []string{"old"},
		ShiftDate:        testutils.TodayUTC(),
		Duration:         1,
		Status:           models.StatusPending,
	}
	if err := db.Create(&reqModel).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	body := `{
		"patient_id": 2,
		"patient_first_name": "NewFirst",
		"patient_last_name": "NewLast",
		"required_skills": ["skill1", "skill2"],
		"shift_date": "2025-01-01T10:00:00Z",
		"duration": 5,
		"status": "ASSIGNED"
	}`

	req := httptest.NewRequest(http.MethodPut, "/requests/1", strings.NewReader(body))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	h.UpdateRequest(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var updated models.Request
	db.First(&updated, reqModel.ID)

	if updated.PatientID != 2 {
		t.Errorf("PatientID not updated")
	}
	if updated.PatientFirstName != "NewFirst" {
		t.Errorf("PatientFirstName not updated")
	}
	if updated.Duration != 5 {
		t.Errorf("Duration not updated")
	}
}

func TestUpdateRequest_DBSaveError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &RequestHandler{DB: db}

	reqModel := models.Request{
		PatientID:        1,
		PatientFirstName: "Old",
		PatientLastName:  "Name",
		RequiredSkills:   []string{"old"},
		ShiftDate:        testutils.TodayUTC(),
		Duration:         1,
		Status:           models.StatusPending,
	}
	if err := db.Create(&reqModel).Error; err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	body := `{
		"patient_id": 2,
		"patient_first_name": "NewFirst",
		"patient_last_name": "NewLast",
		"required_skills": ["skill1", "skill2"],
		"shift_date": "2025-01-01T10:00:00Z",
		"duration": 5,
		"status": "ASSIGNED"
	}`

	req := httptest.NewRequest(http.MethodPut, "/requests/1", strings.NewReader(body))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()


	db.Exec(`
		CREATE TRIGGER fail_update_request
		BEFORE UPDATE ON requests
		BEGIN
			SELECT RAISE(FAIL, "forced update error");
		END;
	`)

	h.UpdateRequest(w, req)
}

func TestDeleteRequest_MethodNotAlloed(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/requests/1", nil)
	w := httptest.NewRecorder()

	handler.DeleteRequest(w, req)

	if w.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Result().StatusCode)
	}
}

func TestDeleteRequest_DBDeleteError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &RequestHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_delete_request
		BEFORE UPDATE ON requests
		BEGIN
			SELECT RAISE(FAIL, "forced delete error");
		END;
	`)

	request := models.Request{RequiredSkills: []string{"IV"}, ShiftDate: time.Now().UTC(), Duration: 1, Status: models.StatusPending}
	if err := db.Create(&request).Error; err != nil {
		t.Fatalf("failed to seed request: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/requests/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.DeleteRequest(w, req)

	if w.Result().StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Result().StatusCode)
	}
}