package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"nurse-scheduling-system/internal/handlers"
	"nurse-scheduling-system/internal/models"
	"nurse-scheduling-system/internal/services"
	"nurse-scheduling-system/internal/utils"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// ============================================================================
// GLOBALS
// ============================================================================

var (
	gormDB    *gorm.DB
	jwtSecret []byte
)

// ============================================================================
// AUTH MODELS (request/response shapes)
// ============================================================================

type RegisterRequest struct {
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	Role      string `json:"role"` // "admin" or "nurse"
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginResponse struct {
	Token     string `json:"token"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	Message   string `json:"message"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

// UpdateAccountRequest is used by POST /api/change-password.
// currentPassword is always required as proof of identity.
// newPassword and newEmail are both optional — send either or both.
// At least one of the two must be non-empty.
type UpdateAccountRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"` // optional
	NewEmail        string `json:"newEmail"`    // optional
}

type Claims struct {
	Email string `json:"email"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

func initDatabase() {
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")

	if dbUser == "" || dbHost == "" || dbPort == "" || dbName == "" {
		log.Fatal("Missing DB env vars. Set DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME")
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=UTC",
		dbUser, dbPass, dbHost, dbPort, dbName,
	)

	var err error
	gormDB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to MySQL:", err)
	}
	log.Println("Connected to MySQL via GORM")

	// Auto-migrate ALL tables — auth + scheduling
	if err := gormDB.AutoMigrate(
		&models.AuthUser{},
		&models.Nurse{},
		&models.Request{},
		&models.Shift{},
	); err != nil {
		log.Fatal("AutoMigrate failed:", err)
	}
	log.Println("All tables migrated successfully")
}

// ============================================================================
// HELPERS
// ============================================================================

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func checkPasswordHash(password, hash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func generateToken(email, role string) (string, error) {
	claims := &Claims{
		Email: email,
		Role:  role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// parseClaims extracts JWT claims from the Authorization header.
// authMiddleware has already validated the token, so this will not fail
// under normal operation.
func parseClaims(r *http.Request) (*Claims, error) {
	tokenString := r.Header.Get("Authorization")
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	return claims, err
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

func registerHandler(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Invalid request body"})
		return
	}

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Password == "" || req.Role == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"All fields are required"})
		return
	}
	if req.Role != "admin" && req.Role != "nurse" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Role must be 'admin' or 'nurse'"})
		return
	}
	if len(req.Password) < 6 {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Password must be at least 6 characters"})
		return
	}

	// Check duplicate email+role
	var existing models.AuthUser
	if err := gormDB.Where("email = ? AND role = ?", req.Email, req.Role).First(&existing).Error; err == nil {
		writeJSON(w, http.StatusConflict, ErrorResponse{"Email already registered for this role"})
		return
	}

	hashed, err := hashPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Error processing password"})
		return
	}

	user := models.AuthUser{
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Password:  hashed,
		Role:      req.Role,
	}
	if err := gormDB.Create(&user).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Error creating account"})
		return
	}

	log.Printf("Registered %s: %s %s (ID: %d)", req.Role, req.FirstName, req.LastName, user.ID)

	token, err := generateToken(user.Email, user.Role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Error generating token"})
		return
	}

	writeJSON(w, http.StatusCreated, LoginResponse{
		Token:     token,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
		Role:      user.Role,
		Message:   "Registration successful",
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" || req.Role == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Email, password, and role are required"})
		return
	}
	if req.Role != "admin" && req.Role != "nurse" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Role must be 'admin' or 'nurse'"})
		return
	}

	var user models.AuthUser
	if err := gormDB.Where("email = ? AND role = ?", req.Email, req.Role).First(&user).Error; err != nil {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Invalid credentials"})
		return
	}

	if !checkPasswordHash(req.Password, user.Password) {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Invalid credentials"})
		return
	}

	token, err := generateToken(user.Email, user.Role)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Error generating token"})
		return
	}

	log.Printf("%s logged in: %s %s (ID: %d)", user.Role, user.FirstName, user.LastName, user.ID)

	writeJSON(w, http.StatusOK, LoginResponse{
		Token:     token,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		Email:     user.Email,
		Role:      user.Role,
		Message:   "Login successful",
	})
}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}

func protectedHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "This is a protected route"})
}

// POST /api/change-password
//
// Allows an authenticated user (admin or nurse) to update their password,
// their email, or both in a single request.
//
// Request body:
//
//	{
//	  "currentPassword": "required — proves identity",
//	  "newPassword":     "optional — min 6 chars",
//	  "newEmail":        "optional — must not already exist for the same role"
//	}
//
// Response (no email change):
//
//	{ "message": "Account updated successfully" }
//
// Response (email changed):
//
//	{
//	  "message": "Account updated successfully",
//	  "token":   "<new JWT>",
//	  "note":    "Email changed — use the new token for subsequent requests"
//	}
//
// Because the JWT encodes the user's email, changing the email invalidates
// the old token. A fresh token is returned automatically so the client
// does not need to re-login.
func changePasswordHandler(w http.ResponseWriter, r *http.Request) {
	claims, err := parseClaims(r)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Invalid token"})
		return
	}

	var req UpdateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Invalid request body"})
		return
	}

	// currentPassword is always required — it proves the caller owns the account.
	if req.CurrentPassword == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"currentPassword is required"})
		return
	}

	// At least one thing to change must be provided.
	if req.NewPassword == "" && req.NewEmail == "" {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"Provide newPassword, newEmail, or both"})
		return
	}

	if req.NewPassword != "" && len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{"New password must be at least 6 characters"})
		return
	}

	// Look up the authenticated user.
	var user models.AuthUser
	if err := gormDB.Where("email = ? AND role = ?", claims.Email, claims.Role).First(&user).Error; err != nil {
		writeJSON(w, http.StatusNotFound, ErrorResponse{"User not found"})
		return
	}

	// Verify identity before making any change.
	if !checkPasswordHash(req.CurrentPassword, user.Password) {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Current password is incorrect"})
		return
	}

	// Build the map of columns to update — only touch what was requested.
	updates := map[string]interface{}{}
	newEmail := user.Email // will stay unchanged unless a valid newEmail is supplied

	if req.NewEmail != "" && req.NewEmail != user.Email {
		// Reject if the new email is already taken by another record with the
		// same role. Different roles are allowed to share an email (existing
		// system behaviour enforced by the uniqueIndex:idx_email_role constraint).
		var conflict models.AuthUser
		if err := gormDB.Where("email = ? AND role = ?", req.NewEmail, user.Role).First(&conflict).Error; err == nil {
			writeJSON(w, http.StatusConflict, ErrorResponse{"Email already in use for this role"})
			return
		}
		updates["email"] = req.NewEmail
		newEmail = req.NewEmail
	}

	if req.NewPassword != "" {
		hashed, err := hashPassword(req.NewPassword)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Error processing new password"})
			return
		}
		updates["password"] = hashed
	}

	if len(updates) == 0 {
		// e.g. newEmail was supplied but equals the current email.
		writeJSON(w, http.StatusOK, map[string]string{"message": "Nothing to update"})
		return
	}

	if err := gormDB.Model(&user).Updates(updates).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Failed to update account"})
		return
	}

	log.Printf("Account updated for %s (%s): fields=%v", user.Email, user.Role, mapKeys(updates))

	// If the email changed we must issue a new JWT. The old token still encodes
	// the previous email and would fail the DB lookup on the very next request.
	resp := map[string]string{"message": "Account updated successfully"}
	if _, emailChanged := updates["email"]; emailChanged {
		newToken, err := generateToken(newEmail, user.Role)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, ErrorResponse{"Account updated but failed to generate new token — please log in again"})
			return
		}
		resp["token"] = newToken
		resp["note"] = "Email changed — use the new token for subsequent requests"
	}

	writeJSON(w, http.StatusOK, resp)
}

// mapKeys returns the keys of a string-keyed map (used only for log lines).
func mapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")
		if tokenString == "" {
			writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Missing authorization token"})
			return
		}
		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			writeJSON(w, http.StatusUnauthorized, ErrorResponse{"Invalid or expired token"})
			return
		}
		next.ServeHTTP(w, r)
	}
}

// ============================================================================
// MAIN
// ============================================================================

func main() {
	utils.InitTimezone()

	jwtSecret = []byte(getEnv("JWT_SECRET", "ankushyadavAuthTesting"))
	if getEnv("JWT_SECRET", "") == "" {
		log.Println("Warning: using default JWT secret — set JWT_SECRET in production!")
	}

	initDatabase()

	nurseHandler := &handlers.NurseHandler{DB: gormDB}
	requestHandler := &handlers.RequestHandler{DB: gormDB}
	shiftHandler := &handlers.ShiftHandler{DB: gormDB}

	router := mux.NewRouter()

	// Public auth routes
	router.HandleFunc("/api/health", healthCheckHandler).Methods("GET")
	router.HandleFunc("/api/register", registerHandler).Methods("POST")
	router.HandleFunc("/api/login", loginHandler).Methods("POST")
	router.HandleFunc("/api/protected", authMiddleware(protectedHandler)).Methods("GET")
	router.HandleFunc("/api/change-password", authMiddleware(changePasswordHandler)).Methods("POST")

	// Protected scheduling routes
	router.HandleFunc("/api/nurses", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			nurseHandler.CreateNurse(w, r)
		case http.MethodGet:
			nurseHandler.GetNurses(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})).Methods("GET", "POST")

	router.HandleFunc("/api/nurses/{id}", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			nurseHandler.UpdateNurse(w, r)
		case http.MethodDelete:
			nurseHandler.DeleteNurse(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})).Methods("PUT", "DELETE")

	router.HandleFunc("/api/requests", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			requestHandler.CreateRequest(w, r)
		case http.MethodGet:
			requestHandler.GetRequests(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})).Methods("GET", "POST")

	router.HandleFunc("/api/requests/{id}", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPut:
			requestHandler.UpdateRequest(w, r)
		case http.MethodDelete:
			requestHandler.DeleteRequest(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})).Methods("PUT", "DELETE")

	router.HandleFunc("/api/shifts", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			shiftHandler.GetShifts(w, r)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})).Methods("GET")

	router.HandleFunc("/api/shifts/today", authMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			shiftHandler.GetTodayShifts(w, r)
			return
		}
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	})).Methods("GET")

	// Background workers
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		log.Println("AutoScheduler running every 30s...")
		for range ticker.C {
			shift, err := services.AutoScheduleOne(gormDB)
			if err != nil || shift == nil {
				continue
			}
			log.Printf("AutoScheduler: shift ID=%d nurse ID=%d request ID=%d",
				shift.ID, shift.NurseID, shift.RequestID)
		}
	}()

	go func() {
		ticker := time.NewTicker(10 * time.Minute)
		defer ticker.Stop()
		log.Println("AutoComplete running every 10m...")
		for range ticker.C {
			if err := services.AutoCompleteShifts(gormDB); err != nil {
				log.Println("AutoComplete error:", err)
			}
		}
	}()

	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		log.Println("AutoCancel running every 1h...")
		for range ticker.C {
			services.AutoCancelExpiredRequests(gormDB)
		}
	}()

	port := getEnv("PORT", "8080")
	fmt.Printf("\n🚀 Server on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, enableCORS(router)))
}