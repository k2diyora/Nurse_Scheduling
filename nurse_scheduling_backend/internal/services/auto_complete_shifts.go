package services

import (
	"time"
	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils"
	"gorm.io/gorm"
)

func AutoCompleteShifts(db *gorm.DB) error {
	//Free nurse if request is ASSIGNED and the shift ended at least 1 hour ago(to give some buffer time for nurse to travel back home, etc). 
	// Also mark the request as COMPLETED.
	
	loc := utils.AppLocation

	// Current Toronto time
	nowLocal := time.Now().In(loc)
	oneHourAgoLocal := nowLocal.Add(-1 * time.Hour)

	// Convert to UTC for DB comparison
	oneHourAgoUTC := oneHourAgoLocal.UTC()

	return db.Transaction(func(tx *gorm.DB) error {

		var shifts []models.Shift

		// Only consider shifts that ended at least 1 hour ago
		if err := tx.
			Where("shifts.end_date_time <= ?",
				oneHourAgoUTC).
			Find(&shifts).Error; err != nil {
			return err
		}

		for _, shift := range shifts {

			// 1. Free nurse
			if err := tx.Model(&models.Nurse{}).
				Where("id = ?", shift.NurseID).
				Update("available", true).Error; err != nil {
				return err
			}

			// 2. Mark request completed
			if err := tx.Model(&models.Request{}).
				Where("id = ?", shift.RequestID).
				Update("status", models.StatusCompleted).Error; err != nil {
				return err
			}
		}

		return nil
	})
}