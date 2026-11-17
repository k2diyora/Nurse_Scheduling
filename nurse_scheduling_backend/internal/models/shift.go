package models

import (
	"time"

	"gorm.io/gorm"
)

// Shift represents the final assignment of a nurse to a specific request.
type Shift struct {
	gorm.Model
	NurseID       uint      `json:"nurse_id"`
	RequestID     uint      `json:"request_id"`
	StartDateTime time.Time `json:"start_date_time"`
	EndDateTime   time.Time `json:"end_date_time"`
}
