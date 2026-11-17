package utils

import (
	"os"
	"time"
)

var AppLocation *time.Location

func InitTimezone() {
	// Read from ENV (recommended)
	locName := os.Getenv("APP_TIMEZONE")

	// Default to Toronto if not set
	if locName == "" {
		locName = "America/Toronto"
	}

	loc, err := time.LoadLocation(locName)
	if err != nil {
		panic("failed to load timezone: " + err.Error())
	}

	AppLocation = loc
}

// Convert UTC → App local time (for responses)
func ConvertToLocal(t time.Time) time.Time {
	return t.In(AppLocation)
}