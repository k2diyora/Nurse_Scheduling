package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"nurse-scheduling-system/internal/models"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const defaultNursePassword = "nursepass"

// bcryptGenerateFromPassword is a test seam for forcing bcrypt failures.
var bcryptGenerateFromPassword = bcrypt.GenerateFromPassword

type NurseHandler struct {
	DB *gorm.DB
}

// nurseEmail derives a deterministic login email from the nurse's display name.
// e.g. "Alice Johnson" → "alice.johnson@nurse.internal"
func nurseEmail(name string) string {
	slug := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(name), " ", "."))
	return fmt.Sprintf("%s@nurse.internal", slug)
}

// POST /nurses
func (h *NurseHandler) CreateNurse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var nurse models.Nurse
	if err := json.NewDecoder(r.Body).Decode(&nurse); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	nurse.Available = true

	// Wrap nurse creation + auth-user seeding in a transaction so both
	// succeed or both roll back together.
	err := h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&nurse).Error; err != nil {
			return err
		}

		// Derive first/last name from the single Name field.
		// "Alice Johnson" → first="Alice", last="Johnson"
		// "Alice" (no space) → first="Alice", last=""
		parts := strings.SplitN(strings.TrimSpace(nurse.Name), " ", 2)
		firstName := parts[0]
		lastName := ""
		if len(parts) == 2 {
			lastName = parts[1]
		}

		email := nurseEmail(nurse.Name)

		// Only create the auth record if it doesn't already exist, so
		// re-running or duplicate names don't cause a hard failure.
		var existing models.AuthUser
		if err := tx.Where("email = ? AND role = ?", email, "nurse").First(&existing).Error; err == gorm.ErrRecordNotFound {
			hashed, err := bcryptGenerateFromPassword([]byte(defaultNursePassword), bcrypt.DefaultCost)
			if err != nil {
				return fmt.Errorf("bcrypt error: %w", err)
			}

			authUser := models.AuthUser{
				FirstName: firstName,
				LastName:  lastName,
				Email:     email,
				Password:  string(hashed),
				Role:      "nurse",
			}
			if err := tx.Create(&authUser).Error; err != nil {
				return fmt.Errorf("failed to create auth user: %w", err)
			}

			// Store the AuthUser ID on the nurse record so deletion is always
			// precise — no re-deriving emails that might not match.
			if err := tx.Model(&nurse).Update("auth_user_id", authUser.ID).Error; err != nil {
				return fmt.Errorf("failed to link auth user to nurse: %w", err)
			}
			nurse.AuthUserID = authUser.ID
		} else if err == nil {
			// Auth record already existed — link it anyway.
			if err := tx.Model(&nurse).Update("auth_user_id", existing.ID).Error; err != nil {
				return fmt.Errorf("failed to link existing auth user to nurse: %w", err)
			}
			nurse.AuthUserID = existing.ID
		}

		return nil
	})

	if err != nil {
		http.Error(w, "Failed to create nurse", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nurse)
}

// GET /nurses
func (h *NurseHandler) GetNurses(w http.ResponseWriter, r *http.Request) {
	var nurses []models.Nurse

	if err := h.DB.Find(&nurses).Error; err != nil {
		http.Error(w, "Failed to fetch nurses", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nurses)
}

type updateNurseRequest struct {
	Name      *string        `json:"name"`
	Skills    *models.Skills `json:"skills"`
	Available *bool          `json:"available"`
}

// PUT /nurses/{id}
func (h *NurseHandler) UpdateNurse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := mux.Vars(r)["id"]
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		http.Error(w, "Invalid nurse ID", http.StatusBadRequest)
		return
	}

	var nurse models.Nurse
	if err := h.DB.First(&nurse, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Nurse not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to fetch nurse", http.StatusInternalServerError)
		return
	}

	var payload updateNurseRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if payload.Name != nil {
		nurse.Name = *payload.Name
	}
	if payload.Skills != nil {
		nurse.Skills = *payload.Skills
	}
	if payload.Available != nil {
		nurse.Available = *payload.Available
	}

	if err := h.DB.Save(&nurse).Error; err != nil {
		http.Error(w, "Failed to update nurse", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(nurse)
}

// DELETE /nurses/{id}
// Deletes the nurse record and its corresponding AuthUser in a single
// transaction so the nurse cannot log in after being removed.
func (h *NurseHandler) DeleteNurse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idParam := mux.Vars(r)["id"]
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		http.Error(w, "Invalid nurse ID", http.StatusBadRequest)
		return
	}

	// Fetch the nurse first so we have AuthUserID before deleting.
	var nurse models.Nurse
	if err := h.DB.First(&nurse, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			http.Error(w, "Nurse not found", http.StatusNotFound)
			return
		}
		http.Error(w, "Failed to fetch nurse", http.StatusInternalServerError)
		return
	}

	txErr := h.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Hard-delete the nurse scheduling record (Unscoped bypasses soft delete).
		if err := tx.Unscoped().Delete(&models.Nurse{}, id).Error; err != nil {
			return fmt.Errorf("failed to delete nurse: %w", err)
		}

		// 2. Hard-delete the AuthUser by its exact ID so the row is fully removed
		//    and the nurse cannot log in after deletion.
		if nurse.AuthUserID != 0 {
			if err := tx.Unscoped().Delete(&models.AuthUser{}, nurse.AuthUserID).Error; err != nil {
				return fmt.Errorf("failed to delete auth user: %w", err)
			}
		}

		return nil
	})

	if txErr != nil {
		http.Error(w, "Failed to delete nurse", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}