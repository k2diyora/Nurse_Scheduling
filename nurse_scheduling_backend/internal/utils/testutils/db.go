package testutils

import (
	"testing"
	"time"
	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/utils"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func SetupTestDB(t *testing.T) *gorm.DB {
	// Initialize timezone for tests
	loc, err := time.LoadLocation("America/Toronto")
	if err != nil {
		t.Fatalf("failed to load location: %v", err)
	}
	utils.AppLocation = loc

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	err = db.AutoMigrate(
		&models.Nurse{},
		&models.Request{},
		&models.Shift{},
		&models.AuthUser{},
	)
	if err != nil {
		t.Fatalf("failed to migrate models: %v", err)
	}

	return db
}

func TodayUTC() time.Time {
	loc := utils.AppLocation
	now := time.Now().In(loc)

	startLocal := time.Date(
		now.Year(), now.Month(), now.Day(),
		0, 0, 0, 0, loc,
	)

	return startLocal.UTC()
}