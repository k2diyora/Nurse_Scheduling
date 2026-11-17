package services

import (
	"errors"
	"fmt"
	"time"

	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils"
	"gorm.io/gorm"
)

// AutoScheduleOne finds ONE pending request and assigns ONE matching available nurse.
// It creates a shift and updates nurse/request state atomically.
func AutoScheduleOne(db *gorm.DB) (*models.Shift, error) {
	var createdShift *models.Shift

	err := db.Transaction(func(tx *gorm.DB) error {

		// 1) Find the oldest pending request with shift date on current day
		var req models.Request
		loc := utils.AppLocation

		nowLocal := time.Now().In(loc)

		// Start of today in Toronto
		startLocal := time.Date(
			nowLocal.Year(),
			nowLocal.Month(),
			nowLocal.Day(),
			0, 0, 0, 0,
			loc,
		)

		// Convert Toronto boundaries → UTC for DB comparison
		startUTC := startLocal.UTC()
		endUTC := startUTC.Add(24 * time.Hour)

		result := tx.
			Where("status = ? AND shift_date >= ? AND shift_date < ?",
				models.StatusPending, startUTC, endUTC).
			Order("created_at ASC").
			First(&req)

		if result.Error != nil {
			if errors.Is(result.Error, gorm.ErrRecordNotFound) {
				// Nothing to schedule today
				return nil
			}
			return result.Error
		}

		// 2) Get all available nurses (simple MVP approach)
		var nurses []models.Nurse
		if err := tx.Where("available = ?", true).Find(&nurses).Error; err != nil {
			return err
		}

		// 3) Pick the first nurse that satisfies all required skills
		var chosen *models.Nurse
		for i := range nurses {
			if nurseHasAllSkills(nurses[i].Skills, req.RequiredSkills) {
				chosen = &nurses[i]
				break
			}
		}

		if chosen == nil {
			return errors.New("no available nurse matches the required skills")
		}

		// 4) Create the shift record
		shift := models.Shift{
			NurseID:       chosen.ID,
			RequestID:     req.ID,
			StartDateTime: req.ShiftDate,
			EndDateTime:   req.ShiftDate.Add(time.Duration(req.Duration) * time.Hour),
		}

		if err := tx.Create(&shift).Error; err != nil {
			return err
		}

		// 5) Update nurse availability
		if err := tx.Model(&models.Nurse{}).
			Where("id = ? AND available = ?", chosen.ID, true).
			Update("available", false).Error; err != nil {
			return err
		}

		// 6) Update request status
		if err := tx.Model(&models.Request{}).
			Where("id = ? AND status = ?", req.ID, models.StatusPending).
			Update("status", models.StatusAssigned).Error; err != nil {
			return err
		}

		createdShift = &shift
		return nil
	})

	if err != nil {
		return nil, err
	}
	if createdShift == nil {
		return nil, nil
	}
	// Background notification simulation (safe here, after commit), we don't start gorutine inside transaction.
	go func(shift models.Shift) {
		time.Sleep(300 * time.Millisecond)
		fmt.Printf("Notification: Nurse %d assigned to Request %d\n", shift.NurseID, shift.RequestID)
	}(*createdShift)

	return createdShift, nil
}

// nurseHasAllSkills checks if nurseSkills contains ALL requiredSkills.
func nurseHasAllSkills(nurseSkills, requiredSkills []string) bool {
	if len(requiredSkills) == 0 {
		return true
	}

	set := make(map[string]bool, len(nurseSkills))
	for _, s := range nurseSkills {
		set[s] = true
	}

	for _, r := range requiredSkills {
		if !set[r] {
			return false
		}
	}

	return true
}
