package handlers

import (
	"encoding/json"
	"net/http"
	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils"
	"time"

	"gorm.io/gorm"
)

type ShiftHandler struct {
	DB *gorm.DB
}

// GET /shifts
func (h *ShiftHandler) GetShifts(w http.ResponseWriter, r *http.Request) {
	var shifts []models.Shift

	if err := h.DB.Find(&shifts).Error; err != nil {
		http.Error(w, "Failed to fetch shifts", http.StatusInternalServerError)
		return
	}

	// Convert shift times to local Toronto timezone before returning
	for i := range shifts {
		shifts[i].StartDateTime = utils.ConvertToLocal(shifts[i].StartDateTime)
		shifts[i].EndDateTime = utils.ConvertToLocal(shifts[i].EndDateTime)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shifts)
}

// GET /shifts/today
func (h *ShiftHandler) GetTodayShifts(w http.ResponseWriter, r *http.Request) {
	var shifts []models.Shift

	loc := utils.AppLocation
	nowLocal := time.Now().In(loc)
	startLocal := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, loc)
	endLocal := startLocal.Add(24 * time.Hour)

	startUTC := startLocal.UTC()
	endUTC := endLocal.UTC()

	if err := h.DB.Where("start_date_time >= ? AND start_date_time < ?", startUTC, endUTC).Find(&shifts).Error; err != nil {
		http.Error(w, "Failed to fetch today's shifts", http.StatusInternalServerError)
		return
	}

	// Convert shift times to local Toronto timezone before returning
	for i := range shifts {
		shifts[i].StartDateTime = utils.ConvertToLocal(shifts[i].StartDateTime)
		shifts[i].EndDateTime = utils.ConvertToLocal(shifts[i].EndDateTime)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shifts)
}
