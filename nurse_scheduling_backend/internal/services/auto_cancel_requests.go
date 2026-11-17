package services

import (
    "log"
    "time"
    "nurse-scheduling-system/internal/models"
    "nurse-scheduling-system/internal/utils"
    "gorm.io/gorm"
)

func AutoCancelExpiredRequests(db *gorm.DB) error {
    loc := utils.AppLocation
    // 1) Now in Toronto
    nowLocal := time.Now().In(loc)
    // 2) Convert to UTC for DB comparison
    nowUTC := nowLocal.UTC()

    return db.Transaction(func(tx *gorm.DB) error {
        var requests []models.Request
        
        // Fetch all pending requests
        if err := tx.Where("status = ?", models.StatusPending).Find(&requests).Error; err != nil {
            return err
        }

        // Check expiration in Go and update
        var cancelledCount int64
        for _, req := range requests {
            shiftEnd := req.ShiftDate.Add(time.Duration(req.Duration) * time.Hour)
            if shiftEnd.Before(nowUTC) || shiftEnd.Equal(nowUTC) {
                result := tx.Model(&models.Request{}).
                    Where("id = ?", req.ID).
                    Update("status", models.StatusCancelled)
                if result.Error != nil {
                    return result.Error
                }
                cancelledCount += result.RowsAffected
            }
        }

        log.Printf("AutoCancel: %d requests cancelled\n", cancelledCount)
        return nil
    })
}