package middleware

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

// Config holds middleware configuration.
type Config struct {
	PrivateKey          string   // base64url-encoded P-256 private key
	ExcludeRoutes       []string // default: ["/health", "/ciph/public-key", "/ciph", "/ciph/*"]
	StrictFingerprint   bool     // default: true — set false behind proxy/NAT
	MaxPayloadSize      int64    // default: 10MB
	AllowUnencrypted    bool     // default: false
	PublicKeyHandler    func(http.ResponseWriter, *http.Request) // auto-registered if nil
}

// New creates a new Ciph middleware with the given config.
func New(config *Config) (*Middleware, error) {
	if config.PrivateKey == "" {
		return nil, &core.CiphError{
			Code:    "CONFIG_ERROR",
			Message: "CIPH_PRIVATE_KEY required",
		}
	}

	m := &Middleware{
		config:     config,
		privateKey: config.PrivateKey,
	}

	// Set defaults
	if len(m.config.ExcludeRoutes) == 0 {
		m.config.ExcludeRoutes = []string{"/health", "/ciph/public-key", "/ciph", "/ciph/*"}
	}
	if m.config.MaxPayloadSize == 0 {
		m.config.MaxPayloadSize = 10 * 1024 * 1024 // 10MB
	}

	// Derive server public key from private key
	privKeyBytes, err := base64.RawURLEncoding.DecodeString(config.PrivateKey)
	if err != nil {
		return nil, &core.CiphError{
			Code:    "CONFIG_ERROR",
			Message: "failed to decode private key",
			Err:     err,
		}
	}

	// Just store for later use
	m.config.PrivateKey = config.PrivateKey
	_ = privKeyBytes // Use in actual ECDH

	return m, nil
}

type Middleware struct {
	config     *Config
	privateKey string
	devtools   *DevToolsBuffer // optional, for /ciph inspector
}

// EnableDevTools enables /ciph inspector endpoint (dev-only).
func (m *Middleware) EnableDevTools(maxLogs int) {
	if maxLogs <= 0 {
		maxLogs = 500
	}
	m.devtools = NewDevToolsBuffer(maxLogs)
}

// GetDevToolsBuffer returns devtools buffer if enabled.
func (m *Middleware) GetDevToolsBuffer() *DevToolsBuffer {
	return m.devtools
}

// Wrap wraps an http.Handler with Ciph middleware.
func (m *Middleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if route is excluded
		if m.isExcluded(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Handle public key endpoint
		if r.URL.Path == "/ciph/public-key" && r.Method == http.MethodGet {
			m.handlePublicKey(w, r)
			return
		}

		// Phase 1: Pre-handler (decrypt request)
		ctx, err := m.phase1Decrypt(r)
		if err != nil {
			m.writeError(w, err)
			return
		}

		// Create new request with decrypted body
		newReq := r.WithContext(ctx)
		if ctx.Value("body") != nil {
			body := ctx.Value("body").([]byte)
			newReq.Body = io.NopCloser(bytes.NewReader(body))
			newReq.ContentLength = int64(len(body))
		}

		// Phase 2: Post-handler (encrypt response)
		// Wrap response writer to capture response body
		wrappedWriter := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			body:           &bytes.Buffer{},
		}

		// Call next handler
		next.ServeHTTP(wrappedWriter, newReq)

		// Encrypt response body
		if err := m.phase2Encrypt(wrappedWriter, ctx); err != nil {
			m.writeError(w, err)
			return
		}
	})
}

// phase1Decrypt handles request decryption, validation, and ECDH.
func (m *Middleware) phase1Decrypt(r *http.Request) (context.Context, error) {
	ctx := r.Context()

	// Extract client public key from header
	clientPubKeyB64 := r.Header.Get("X-Client-PublicKey")
	if clientPubKeyB64 == "" {
		return ctx, &core.CiphError{
			Code:    core.CIPH001,
			Message: "missing X-Client-PublicKey header",
		}
	}

	// Extract encrypted fingerprint from header
	encFingerprintB64 := r.Header.Get("X-Fingerprint")
	if encFingerprintB64 == "" {
		return ctx, &core.CiphError{
			Code:    core.CIPH001,
			Message: "missing X-Fingerprint header",
		}
	}

	// ECDH: Derive shared secret using server private key + client public key
	sharedSecret, err := core.DeriveSharedSecret(m.privateKey, clientPubKeyB64)
	if err != nil {
		return ctx, err // Already CIPH007
	}

	// Derive session key from shared secret
	sessionKey, err := core.DeriveSessionKey(sharedSecret)
	if err != nil {
		return ctx, &core.CiphError{
			Code:    core.CIPH007,
			Message: "failed to derive session key",
			Err:     err,
		}
	}

	// Decrypt fingerprint with session key
	fingerprintComps, err := core.DecryptFingerprintComponents(encFingerprintB64, sessionKey)
	if err != nil {
		return ctx, err // Already CIPH004
	}

	// Validate IP + UA
	if m.config.StrictFingerprint {
		clientIP := getClientIP(r)
		if !core.ValidateFingerprintIP(fingerprintComps.IP, clientIP) {
			return ctx, &core.CiphError{
				Code:    core.CIPH003,
				Message: fmt.Sprintf("fingerprint mismatch: IP address changed (stored: %s, incoming: %s)", fingerprintComps.IP, clientIP),
			}
		}

		if !core.ValidateFingerprintUA(fingerprintComps.UserAgent, r.Header.Get("User-Agent")) {
			return ctx, &core.CiphError{
				Code:    core.CIPH003,
				Message: "fingerprint mismatch: User-Agent changed",
			}
		}
	}

	// Compute fingerprint hash for request key derivation
	fpHash := core.GetFingerprintHash(*fingerprintComps)

	// Derive request key
	requestKey, err := core.DeriveRequestKey(sessionKey, fpHash)
	if err != nil {
		return ctx, &core.CiphError{
			Code:    core.CIPH007,
			Message: "failed to derive request key",
			Err:     err,
		}
	}

	// Decrypt request body (if POST/PUT/PATCH)
	var plainBody []byte
	if r.ContentLength > 0 && (r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodPatch) {
		if r.ContentLength > m.config.MaxPayloadSize {
			return ctx, &core.CiphError{
				Code:    core.CIPH005,
				Message: fmt.Sprintf("payload exceeds maxPayloadSize (%d > %d)", r.ContentLength, m.config.MaxPayloadSize),
			}
		}

		ciphertextB64, err := io.ReadAll(r.Body)
		if err != nil {
			return ctx, &core.CiphError{
				Code:    core.CIPH004,
				Message: "failed to read request body",
				Err:     err,
			}
		}
		defer r.Body.Close()

		result, err := core.Decrypt(string(ciphertextB64), requestKey)
		if err != nil {
			return ctx, err // Already CIPH004
		}
		plainBody = result.Plaintext
	}

	// Store in context
	ctx = context.WithValue(ctx, "body", plainBody)
	ctx = context.WithValue(ctx, "sessionKey", sessionKey)
	ctx = context.WithValue(ctx, "requestKey", requestKey)
	ctx = context.WithValue(ctx, "fingerprint", fingerprintComps)

	return ctx, nil
}

// phase2Encrypt encrypts response body.
func (m *Middleware) phase2Encrypt(w *responseWriter, ctx context.Context) error {
	requestKey := ctx.Value("requestKey").(string)

	body := w.body.Bytes()
	if len(body) == 0 {
		return nil
	}

	result, err := core.Encrypt(body, requestKey)
	if err != nil {
		return &core.CiphError{
			Code:    core.CIPH006,
			Message: "failed to encrypt response",
			Err:     err,
		}
	}

	// Write encrypted body
	w.ResponseWriter.Header().Set("Content-Type", "text/plain")
	_, err = w.ResponseWriter.Write([]byte(result.Ciphertext))
	return err
}

// handlePublicKey serves server public key at GET /ciph/public-key.
func (m *Middleware) handlePublicKey(w http.ResponseWriter, r *http.Request) {
	// TODO: Derive public key from private key stored at init
	// For now, return placeholder
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"publicKey": "placeholder",
	})
}

// isExcluded checks if route is in exclude list.
func (m *Middleware) isExcluded(path string) bool {
	for _, route := range m.config.ExcludeRoutes {
		if route == path || strings.HasPrefix(path, route) {
			return true
		}
	}
	return false
}

// getClientIP extracts client IP from request.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For first (proxy)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

// writeError writes error response in Ciph format.
func (m *Middleware) writeError(w http.ResponseWriter, err error) {
	var code string
	var message string
	var status int

	if cErr, ok := err.(*core.CiphError); ok {
		code = string(cErr.Code)
		message = cErr.Message
	} else {
		code = "INTERNAL_ERROR"
		message = err.Error()
	}

	// Determine HTTP status
	switch code {
	case string(core.CIPH001), string(core.CIPH002), string(core.CIPH003), string(core.CIPH007):
		status = http.StatusUnauthorized
	case string(core.CIPH004):
		status = http.StatusBadRequest
	case string(core.CIPH005):
		status = http.StatusRequestEntityTooLarge
	case string(core.CIPH006):
		status = http.StatusInternalServerError
	default:
		status = http.StatusInternalServerError
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"code":    code,
		"message": message,
	})
}

// responseWriter captures response status and body.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (w *responseWriter) WriteHeader(status int) {
	w.statusCode = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}
