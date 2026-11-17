package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils/testutils"

	"github.com/gorilla/mux"
)

func TestCreateNurse_BcryptError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	original := bcryptGenerateFromPassword
	bcryptGenerateFromPassword = func(password []byte, cost int) ([]byte, error) {
		return nil, errors.New("forced bcrypt failure")
	}
	defer func() { bcryptGenerateFromPassword = original }()

	payload := models.Nurse{
		Name:   "Alice Johnson",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestCreateNurse_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	payload := models.Nurse{
		Name:   "Alice Johnson",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	handler.CreateNurse(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var created models.Nurse
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if created.ID == 0 {
		t.Errorf("expected nurse ID to be set")
	}

	if !created.Available {
		t.Errorf("expected nurse to be available by default")
	}
}

func TestCreateNurse_InvalidMethod(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/nurses", nil)
	w := httptest.NewRecorder()

	handler.CreateNurse(w, req)

	if w.Result().StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", w.Result().StatusCode)
	}
}

func TestCreateNurse_InvalidBody(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer([]byte("invalid-json")))
	w := httptest.NewRecorder()

	handler.CreateNurse(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestGetNurses(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	db.Create(&models.Nurse{
		Name:      "Alice",
		Skills:    []string{"IV"},
		Available: true,
	})

	db.Create(&models.Nurse{
		Name:      "Bob",
		Skills:    []string{"Wound"},
		Available: true,
	})

	req := httptest.NewRequest(http.MethodGet, "/nurses", nil)
	w := httptest.NewRecorder()

	handler.GetNurses(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var nurses []models.Nurse
	if err := json.NewDecoder(resp.Body).Decode(&nurses); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(nurses) != 2 {
		t.Errorf("expected 2 nurses, got %d", len(nurses))
	}
}

func TestUpdateNurse_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	nurse := models.Nurse{Name: "Alice", Skills: []string{"IV"}, Available: true}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to seed nurse: %v", err)
	}

	body := bytes.NewBufferString(`{"name":"Alice Updated","skills":["ER"],"available":false}`)
	req := httptest.NewRequest(http.MethodPut, "/nurses/1", body)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.UpdateNurse(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	var updated models.Nurse
	if err := json.NewDecoder(resp.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if updated.Name != "Alice Updated" {
		t.Errorf("expected updated name, got %s", updated.Name)
	}
	if updated.Available {
		t.Errorf("expected updated availability false")
	}
	if len(updated.Skills) != 1 || updated.Skills[0] != "ER" {
		t.Errorf("expected updated skills, got %+v", updated.Skills)
	}
}

func TestUpdateNurse_NotFound(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodPut, "/nurses/999", bytes.NewBufferString(`{"name":"Ghost"}`))
	req = mux.SetURLVars(req, map[string]string{"id": "999"})
	w := httptest.NewRecorder()

	handler.UpdateNurse(w, req)

	if w.Result().StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Result().StatusCode)
	}
}

func TestUpdateNurse_InvalidID(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodPut, "/nurses/abc", bytes.NewBufferString(`{"name":"Alice"}`))
	req = mux.SetURLVars(req, map[string]string{"id": "abc"})
	w := httptest.NewRecorder()

	handler.UpdateNurse(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestUpdateNurse_InvalidBody(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	nurse := models.Nurse{Name: "Alice", Skills: []string{"IV"}, Available: true}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to seed nurse: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/nurses/1", bytes.NewBufferString(`{invalid-json`))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.UpdateNurse(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestDeleteNurse_Success(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	nurse := models.Nurse{Name: "Delete Me", Skills: []string{"IV"}, Available: true}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to seed nurse: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/nurses/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	handler.DeleteNurse(w, req)

	if w.Result().StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", w.Result().StatusCode)
	}

	var found models.Nurse
	err := db.First(&found, nurse.ID).Error
	if err == nil {
		t.Errorf("expected nurse to be deleted")
	}
}

func TestDeleteNurse_NotFound(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodDelete, "/nurses/999", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "999"})
	w := httptest.NewRecorder()

	handler.DeleteNurse(w, req)

	if w.Result().StatusCode != http.StatusNotFound {
		t.Errorf("expected 404, got %d", w.Result().StatusCode)
	}
}

func TestDeleteNurse_InvalidID(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodDelete, "/nurses/abc", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "abc"})
	w := httptest.NewRecorder()

	handler.DeleteNurse(w, req)

	if w.Result().StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Result().StatusCode)
	}
}

func TestCreateNurse_CreationFail(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	payload := models.Nurse{
		Name:   "Alice",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	if err := db.Migrator().DropTable(&models.Nurse{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	handler.CreateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}
}

func TestCreateNurse_NoExistingAuthUser(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	payload := models.Nurse{
		Name:   "Alice",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCreateNurse_NoExistingAuthUserCreationFail(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_auth_user_insert
		BEFORE INSERT ON auth_users
		BEGIN
			SELECT RAISE(FAIL, "forced insert failure");
		END;
	`)

	payload := models.Nurse{
		Name:   "Alice",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestCreateNurse_NoExistingAuthUserUpdateFail(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_nurse_update
		BEFORE UPDATE ON nurses
		BEGIN
			SELECT RAISE(FAIL, "forced update failure");
		END;
	`)

	payload := models.Nurse{
		Name:   "Alice",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestCreateNurse_ExistingAuthUser(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	email := "alice.johnson@nurse.internal"

	existing := models.AuthUser{
		FirstName: "Alice",
		LastName:  "Johnson",
		Email:     email,
		Password:  "hashed",
		Role:      "nurse",
	}

	if err := db.Create(&existing).Error; err != nil {
		t.Fatalf("failed to create auth user: %v", err)
	}

	payload := models.Nurse{
		Name:   "Alice Johnson",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestCreateNurse_ExistingAuthUserUpdateError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_nurse_update
		BEFORE UPDATE ON nurses
		BEGIN
			SELECT RAISE(FAIL, "forced update failure");
		END;
	`)

	email := "alice.johnson@nurse.internal"

	existing := models.AuthUser{
		FirstName: "Alice",
		LastName:  "Johnson",
		Email:     email,
		Password:  "hashed",
		Role:      "nurse",
	}

	if err := db.Create(&existing).Error; err != nil {
		t.Fatalf("failed to create auth user: %v", err)
	}

	payload := models.Nurse{
		Name:   "Alice Johnson",
		Skills: []string{"IV", "Wound"},
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/nurses", bytes.NewBuffer(body))
	w := httptest.NewRecorder()

	h.CreateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestGetNurse_FindNurseError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	handler := &NurseHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Nurse{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/nurses", nil)
	w := httptest.NewRecorder()

	handler.GetNurses(w, req)

	resp := w.Result()
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", resp.StatusCode)
	}
}

func TestUpdateNurse_MethodNotAllowed(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/nurses/1", nil)
	w := httptest.NewRecorder()

	h.UpdateNurse(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestUpdateNurse_DBErrorOnFetch(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Nurse{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodPut, "/nurses/1", strings.NewReader(`{}`))
	w := httptest.NewRecorder()

	req = mux.SetURLVars(req, map[string]string{"id": "1"})

	h.UpdateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestUpdateNurse_SaveError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_update_nurse
		BEFORE UPDATE ON nurses
		BEGIN
			SELECT RAISE(FAIL, "forced update error");
		END;
	`)

	nurse := models.Nurse{Name: "Alice"}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	body := `{"name": "Alice Updated"}`
	req := httptest.NewRequest(http.MethodPut, "/nurses/1", strings.NewReader(body))
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	h.UpdateNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestDeleteNurse_MethodNotAllowed(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/nurses/1", nil)
	w := httptest.NewRecorder()

	h.DeleteNurse(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestDeleteNurse_DBErrorOnFetch(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	if err := db.Migrator().DropTable(&models.Nurse{}); err != nil {
		t.Fatalf("failed to drop table: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/nurses/1", strings.NewReader(`{}`))
	w := httptest.NewRecorder()

	req = mux.SetURLVars(req, map[string]string{"id": "1"})

	h.DeleteNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestDeleteNurse_DeleteError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	db.Exec(`
		CREATE TRIGGER fail_delete_nurse
		BEFORE DELETE ON nurses
		BEGIN
			SELECT RAISE(FAIL, "forced delete error");
		END;
	`)

	nurse := models.Nurse{Name: "Alice"}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/nurses/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	h.DeleteNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}

func TestDeleteNurse_DeleteAuthUserError(t *testing.T) {
	db := testutils.SetupTestDB(t)
	h := &NurseHandler{DB: db}

	auth := models.AuthUser{
		FirstName: "Alice",
		LastName:  "Johnson",
		Email:     "alice@nurse.internal",
		Password:  "hashed",
		Role:      "nurse",
	}
	if err := db.Create(&auth).Error; err != nil {
		t.Fatalf("failed to create auth user: %v", err)
	}

	nurse := models.Nurse{
		Name:       "Alice Johnson",
		AuthUserID: auth.ID, 
	}
	if err := db.Create(&nurse).Error; err != nil {
		t.Fatalf("failed to create nurse: %v", err)
	}

	db.Exec(`
		CREATE TRIGGER fail_delete_auth_user
		BEFORE DELETE ON auth_users
		BEGIN
			SELECT RAISE(FAIL, "forced delete error");
		END;
	`)

	req := httptest.NewRequest(http.MethodDelete, "/nurses/1", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "1"})
	w := httptest.NewRecorder()

	h.DeleteNurse(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500, got %d", w.Code)
	}
}