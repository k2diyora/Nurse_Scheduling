package models

import (
	"time"

	"gorm.io/gorm"
)

// Request represents a client request for nurse scheduling
type Request struct {
	gorm.Model
	PatientID        uint   `json:"patient_id"`
	PatientFirstName string `json:"patient_first_name"`
	PatientLastName  string `json:"patient_last_name"`

	RequiredSkills Skills        `json:"required_skills" gorm:"type:json"`
	ShiftDate      time.Time     `json:"shift_date"`
	Duration       int           `json:"duration"` // hours
	Status         RequestStatus `json:"status" gorm:"default:'PENDING'"`
}
