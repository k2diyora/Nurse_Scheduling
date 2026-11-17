package models

import "gorm.io/gorm"

// Nurse represents a nurse with relevant details. JSON tags are included for serialization.
type Nurse struct {
	gorm.Model
	Name       string `json:"name"`
	Skills     Skills `json:"skills" gorm:"type:json"`
	Available  bool   `json:"available"`
	AuthUserID uint   `json:"auth_user_id" gorm:"index"` // FK to auth_users.id — used for precise deletion
}