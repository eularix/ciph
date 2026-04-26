package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/Eularix/ciph/modules/ciph-go/middleware"
)

type User struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type CreateUserRequest struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

var users = []User{
	{ID: 1, Name: "Alice", Email: "alice@example.com"},
	{ID: 2, Name: "Bob", Email: "bob@example.com"},
}

func main() {
	// Load CIPH_PRIVATE_KEY from env
	privateKey := os.Getenv("CIPH_PRIVATE_KEY")
	if privateKey == "" {
		log.Fatal("CIPH_PRIVATE_KEY env var not set")
	}

	// Create Ciph middleware
	ciphConfig := &middleware.Config{
		PrivateKey:        privateKey,
		StrictFingerprint: false, // Allow any IP (for local testing)
		MaxPayloadSize:    10 * 1024 * 1024,
		AllowUnencrypted:  true, // DEBUG: allow unencrypted for testing
	}
	ciphMw, err := middleware.New(ciphConfig)
	if err != nil {
		log.Fatalf("Failed to create Ciph middleware: %v", err)
	}

	// Enable devtools
	ciphMw.EnableDevTools(500)

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

	// Health check (unencrypted)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// Public key endpoint (unencrypted)
	// TODO: Derive public key from private key
	// For now, client must use env var VITE_CIPH_SERVER_PUBLIC_KEY
	mux.HandleFunc("/ciph/public-key", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// In production, derive from CIPH_PRIVATE_KEY
		w.WriteHeader(501) // Not implemented
		json.NewEncoder(w).Encode(map[string]string{"error": "use env var VITE_CIPH_SERVER_PUBLIC_KEY"})
	})

	// DevTools endpoints
	if buffer := ciphMw.GetDevToolsBuffer(); buffer != nil {
		mux.Handle("/ciph", ciphMw.RegisterDevToolsRoutes(buffer))
		mux.HandleFunc("/ciph/logs", func(w http.ResponseWriter, r *http.Request) {
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
	mux.HandleFunc("/api/users", handleUsers)
	mux.HandleFunc("/api/users/", handleUserByID)

	// Wrap with Ciph → CORS (CORS must be outermost)
	ciphWrapped := ciphMw.Wrap(mux)
	finalHandler := corsHandler(ciphWrapped)

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	log.Printf("Server starting on http://localhost:%s", port)
	log.Printf("DevTools at http://localhost:%s/ciph", port)
	log.Fatal(http.ListenAndServe(":"+port, finalHandler))
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
