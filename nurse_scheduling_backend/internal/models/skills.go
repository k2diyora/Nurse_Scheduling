package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

// Skills is a custom type to handle the []string field in the Nurse struct for GORM.
type Skills []string

// Convert Go -> DB
func (s Skills) Value() (driver.Value, error) {
	return json.Marshal(s)
}

// Convert DB -> Go
func (s *Skills) Scan(value interface{}) error {
	if value == nil {
		*s = Skills{}
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}

	return json.Unmarshal(bytes, s)
}
