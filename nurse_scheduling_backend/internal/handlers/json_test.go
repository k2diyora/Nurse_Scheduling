package handlers

import (
	"encoding/json"
	"testing"
	"net/http/httptest"
)
func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()

	data := map[string]string{
		"message": "hello",
	}

	err := WriteJSON(w, data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 1. Check header
	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("expected Content-Type application/json")
	}

	// 2. Check body
	var got map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	if got["message"] != "hello" {
		t.Errorf("expected message 'hello', got %s", got["message"])
	}
}