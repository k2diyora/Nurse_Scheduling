package models

import (
	"encoding/json"
	"testing"
)

func TestSkills_Value(t *testing.T) {
	s := Skills{"a", "b"}

	val, err := s.Value()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	bytes, ok := val.([]byte)
	if !ok {
		t.Fatalf("expected []byte, got %T", val)
	}

	var decoded []string
	if err := json.Unmarshal(bytes, &decoded); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(decoded) != 2 || decoded[0] != "a" || decoded[1] != "b" {
		t.Fatalf("unexpected value: %v", decoded)
	}
}

func TestSkills_Scan(t *testing.T) {
	t.Run("nil value", func(t *testing.T) {
		var s Skills

		err := s.Scan(nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(s) != 0 {
			t.Fatalf("expected empty slice, got %v", s)
		}
	})

	t.Run("valid json bytes", func(t *testing.T) {
		var s Skills

		input := []byte(`["x","y"]`)
		err := s.Scan(input)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(s) != 2 || s[0] != "x" || s[1] != "y" {
			t.Fatalf("unexpected value: %v", s)
		}
	})

	t.Run("invalid type", func(t *testing.T) {
		var s Skills

		err := s.Scan("not-bytes") 
		if err == nil {
			t.Fatal("expected error but got nil")
		}
	})
}
