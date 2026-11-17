package models

import "gorm.io/gorm"

type AuthUser struct {
	gorm.Model
	FirstName string `json:"firstName" gorm:"size:100;not null"`
	LastName  string `json:"lastName"  gorm:"size:100;not null"`
	Email     string `json:"email"     gorm:"size:255;not null;uniqueIndex:idx_email_role"`
	Password  string `json:"-"         gorm:"size:255;not null"`
	Role      string `json:"role"      gorm:"size:20;not null;uniqueIndex:idx_email_role;index"`
}