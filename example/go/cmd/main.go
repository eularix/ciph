package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/Eularix/ciph/modules/ciph-go/middleware"
)

// loadEnvFile loads key=value pairs from a .env file into os environment.
func loadEnvFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		// Skip empty lines and comments
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		// Don't override existing env vars
		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}
	return scanner.Err()
}

// ─── Data types ─────────────────────────────────────────────────────────

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type CreateUserRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Employee struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Dept   string `json:"dept"`
	Salary int    `json:"salary"`
	Joined string `json:"joined"`
	Status string `json:"status"`
}

// ─── Sample data ────────────────────────────────────────────────────────

var users = []User{
	{ID: 1, Name: "Alice", Email: "alice@example.com"},
	{ID: 2, Name: "Bob", Email: "bob@example.com"},
}

var employees = []Employee{
	{ID: 1, Name: "Alice Johnson", Role: "Software Engineer", Dept: "Engineering", Salary: 95000, Joined: "2023-01-15", Status: "active"},
	{ID: 2, Name: "Bob Smith", Role: "Product Manager", Dept: "Product", Salary: 105000, Joined: "2022-06-01", Status: "active"},
	{ID: 3, Name: "Carol Williams", Role: "Designer", Dept: "Design", Salary: 85000, Joined: "2023-03-20", Status: "active"},
	{ID: 4, Name: "Dave Brown", Role: "DevOps Engineer", Dept: "Engineering", Salary: 98000, Joined: "2021-11-10", Status: "active"},
	{ID: 5, Name: "Eve Davis", Role: "QA Lead", Dept: "Engineering", Salary: 92000, Joined: "2022-08-05", Status: "inactive"},
}

func main() {
	// Load .env file (if exists)
	if err := loadEnvFile(".env"); err != nil {
		log.Printf("Note: .env file not loaded (%v), using environment variables", err)
	}

	// Load CIPH_PRIVATE_KEY from env
	privateKey := os.Getenv("CIPH_PRIVATE_KEY")
	if privateKey == "" {
		log.Fatal("CIPH_PRIVATE_KEY env var not set. Run: go run cmd/generate-keys/main.go")
	}

	// Create Ciph middleware
	ciphConfig := &middleware.Config{
		PrivateKey:        privateKey,
		StrictFingerprint: false, // Allow any UA (for local testing with different browsers)
		MaxPayloadSize:    10 * 1024 * 1024,
		AllowUnencrypted:  false, // Enforce encryption
	}
	ciphMw, err := middleware.New(ciphConfig)
	if err != nil {
		log.Fatalf("Failed to create Ciph middleware: %v", err)
	}

	// Enable devtools
	ciphMw.EnableDevTools(500)

	log.Printf("Server public key: %s", ciphMw.GetPublicKey())

	mux := http.NewServeMux()

	// CORS middleware
	corsHandler := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Client-PublicKey, X-Fingerprint")

			if r.Method == "OPTIONS" {
				w.WriteHeader(200)
				return
			}

			next.ServeHTTP(w, r)
		})
	}

	// Health check (excluded from encryption by default)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// DevTools endpoints (excluded from encryption by default)
	if buffer := ciphMw.GetDevToolsBuffer(); buffer != nil {
		mux.Handle("/ciph", ciphMw.RegisterDevToolsRoutes(buffer))
		mux.HandleFunc("/ciph/logs", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			if r.Method == "GET" {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(buffer.GetAll())
			} else if r.Method == "DELETE" {
				buffer.Clear()
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
			}
		})
	}

	// API endpoints (encrypted by Ciph middleware)
	mux.HandleFunc("/api/echo", handleEcho)
	mux.HandleFunc("/api/users", handleUsers)
	mux.HandleFunc("/api/users/", handleUserByID)
	mux.HandleFunc("/api/employees", handleEmployees)

	// Wrap with Ciph → CORS (CORS must be outermost)
	ciphWrapped := ciphMw.Wrap(mux)
	finalHandler := corsHandler(ciphWrapped)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	fmt.Println()
	log.Printf("🔒 Ciph Go Server starting on http://localhost:%s", port)
	log.Printf("   Public key: GET http://localhost:%s/ciph-public-key", port)
	log.Printf("   DevTools:   GET http://localhost:%s/ciph", port)
	log.Printf("   Health:     GET http://localhost:%s/health", port)
	fmt.Println()
	log.Fatal(http.ListenAndServe(":"+port, finalHandler))
}

// ─── Handlers ───────────────────────────────────────────────────────────

func handleEcho(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		w.WriteHeader(405)
		json.NewEncoder(w).Encode(map[string]string{"error": "method not allowed"})
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"received":  body,
		"message":   "Echo from Ciph Go server (ECDH v2)",
		"timestamp": fmt.Sprintf("%d", os.Getpid()), // just something dynamic
	})
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	switch r.Method {
	case "GET":
		json.NewEncoder(w).Encode(map[string]interface{}{
			"users": users,
			"count": len(users),
		})

	case "POST":
		var req CreateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
			return
		}

		newUser := User{
			ID:    len(users) + 1,
			Name:  req.Name,
			Email: req.Email,
		}
		users = append(users, newUser)
		w.WriteHeader(201)
		json.NewEncoder(w).Encode(newUser)

	default:
		w.WriteHeader(405)
	}
}

func handleUserByID(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Extract ID from /api/users/:id
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 4 {
		w.WriteHeader(404)
		return
	}
	idStr := parts[3]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid id"})
		return
	}

	switch r.Method {
	case "GET":
		for _, user := range users {
			if user.ID == id {
				json.NewEncoder(w).Encode(user)
				return
			}
		}
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})

	case "PUT":
		var req CreateUserRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(400)
			json.NewEncoder(w).Encode(map[string]string{"error": "invalid body"})
			return
		}

		for i, user := range users {
			if user.ID == id {
				users[i].Name = req.Name
				users[i].Email = req.Email
				json.NewEncoder(w).Encode(users[i])
				return
			}
		}
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})

	case "DELETE":
		for i, user := range users {
			if user.ID == id {
				users = append(users[:i], users[i+1:]...)
				json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
				return
			}
		}
		w.WriteHeader(404)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})

	default:
		w.WriteHeader(405)
	}
}

func handleEmployees(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "GET" {
		w.WriteHeader(405)
		json.NewEncoder(w).Encode(map[string]string{"error": "method not allowed"})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"data":  employees,
		"total": len(employees),
	})
}
