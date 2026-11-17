package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

type RequestHandler struct {
	DB *gorm.DB
}

// POST /requests
func (h *RequestHandler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req models.Request

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Convert incoming time to UTC before saving
	req.ShiftDate = req.ShiftDate.UTC()
	req.Status = models.StatusPending

	if err := h.DB.Create(&req).Error; err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Convert back to local BEFORE sending response
	req.ShiftDate = utils.ConvertToLocal(req.ShiftDate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

// GET /requests
func (h *RequestHandler) GetRequests(w http.ResponseWriter, r *http.Request) {
	var requests []models.Request

	if err := h.DB.Find(&requests).Error; err != nil {
		http.Error(w, "Failed to fetch requests", http.StatusInternalServerError)
		return
	}

	// Convert all UTC shift dates to local before returning
	for i := range requests {
		requests[i].ShiftDate = utils.ConvertToLocal(requests[i].ShiftDate)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

type updateRequestPayload struct {
	PatientID        *uint                 `json:"patient_id"`
	PatientFirstName *string               `json:"patient_first_name"`
	PatientLastName  *string               `json:"patient_last_name"`
	RequiredSkills   *models.Skills        `json:"required_skills"`
	ShiftDate        *time.Time            `json:"shift_date"`
	Duration         *int                  `json:"duration"`
	Status           *models.RequestStatus `json:"status"`
}

// PUT /requests/{id}
func (h *RequestHandler) UpdateRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := mux.Vars(r)["id"]
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	var req models.Request
	if err := h.DB.First(&req, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Request not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to fetch request", http.StatusInternalServerError)
		return
	}

	var payload updateRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.PatientID != nil {
		req.PatientID = *payload.PatientID
	}
	if payload.PatientFirstName != nil {
		req.PatientFirstName = *payload.PatientFirstName
	}
	if payload.PatientLastName != nil {
		req.PatientLastName = *payload.PatientLastName
	}
	if payload.RequiredSkills != nil {
		req.RequiredSkills = *payload.RequiredSkills
	}
	if payload.ShiftDate != nil {
		req.ShiftDate = payload.ShiftDate.UTC()
	}
	if payload.Duration != nil {
		req.Duration = *payload.Duration
	}
	if payload.Status != nil {
		req.Status = *payload.Status
	}

	if err := h.DB.Save(&req).Error; err != nil {
		http.Error(w, "Failed to update request", http.StatusInternalServerError)
		return
	}

	req.ShiftDate = utils.ConvertToLocal(req.ShiftDate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

// DELETE /requests/{id}
func (h *RequestHandler) DeleteRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := mux.Vars(r)["id"]
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		http.Error(w, "Invalid request ID", http.StatusBadRequest)
		return
	}

	result := h.DB.Delete(&models.Request{}, id)
	if result.Error != nil {
		http.Error(w, "Failed to delete request", http.StatusInternalServerError)
		return
	}
	if result.RowsAffected == 0 {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
