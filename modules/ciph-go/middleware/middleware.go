package middleware

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

// contextKey is a typed key to avoid context collisions.
type contextKey string

const (
	ctxBody        contextKey = "ciph.body"
	ctxSessionKey  contextKey = "ciph.sessionKey"
	ctxRequestKey  contextKey = "ciph.requestKey"
	ctxFingerprint contextKey = "ciph.fingerprint"
)

// requestState tracks all intermediate state during a request for devtools logging.
type requestState struct {
	startedAt             time.Time
	excluded              bool
	fingerprint           string
	ip                    string
	userAgent             string
	ipMatch               bool
	uaMatch               bool
	encryptedRequestBody  *string
	plainRequestBody      interface{}
	encryptedResponseBody string
	plainResponseBody     interface{}
	errorCode             *string
	status                int
	ecdhClientPublicKey   *string
	ecdhSessionDerived    bool
	headers               map[string]string
}

// Config holds middleware configuration.
type Config struct {
	PrivateKey        string   // base64url-encoded P-256 private key (PKCS8)
	ExcludeRoutes     []string // default: ["/health", "/ciph-public-key", "/ciph", "/ciph/*"]
	StrictFingerprint bool     // default: true — set false behind proxy/NAT
	MaxPayloadSize    int64    // default: 10MB
	AllowUnencrypted  bool     // default: false
}

// Middleware is the Ciph HTTP middleware.
type Middleware struct {
	config    *Config
	publicKey string // derived from private key at init
	devtools  *DevToolsBuffer
}

// New creates a new Ciph middleware with the given config.
func New(config *Config) (*Middleware, error) {
	if config.PrivateKey == "" {
		return nil, &core.CiphError{
			Code:    "CONFIG_ERROR",
			Message: "CIPH_PRIVATE_KEY required",
		}
	}

	// Derive server public key from private key at init
	publicKey, err := core.DerivePublicKeyFromPrivate(config.PrivateKey)
	if err != nil {
		return nil, &core.CiphError{
			Code:    "CONFIG_ERROR",
			Message: "failed to derive public key from private key",
			Err:     err,
		}
	}

	m := &Middleware{
		config:    config,
		publicKey: publicKey,
	}

	// Set defaults
	if len(m.config.ExcludeRoutes) == 0 {
		m.config.ExcludeRoutes = []string{"/health", "/ciph-public-key", "/ciph", "/ciph/*"}
	}
	if m.config.MaxPayloadSize == 0 {
		m.config.MaxPayloadSize = 10 * 1024 * 1024 // 10MB
	}

	return m, nil
}

// GetPublicKey returns the server's derived public key (base64url).
func (m *Middleware) GetPublicKey() string {
	return m.publicKey
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
		state := &requestState{
			startedAt: time.Now(),
			ip:        getClientIP(r),
			userAgent: r.Header.Get("User-Agent"),
			status:    200,
			headers:   extractHeaders(r),
		}

		// Handle public key endpoint (always accessible, before exclude check)
		if r.URL.Path == "/ciph-public-key" && r.Method == http.MethodGet {
			m.handlePublicKey(w, r)
			return
		}

		// Check if route is excluded
		if m.isExcluded(r.URL.Path) {
			// Don't log excluded routes — they flood the inspector
			next.ServeHTTP(w, r)
			return
		}

		// Phase 1: Pre-handler (decrypt request)
		ctx, err := m.phase1Decrypt(r, state)
		if err != nil {
			m.writeError(w, err)
			m.emitLog(r, state)
			return
		}

		// Create new request with decrypted body
		newReq := r.WithContext(ctx)
		if body := ctx.Value(ctxBody); body != nil {
			bodyBytes := body.([]byte)
			newReq.Body = io.NopCloser(bytes.NewReader(bodyBytes))
			newReq.ContentLength = int64(len(bodyBytes))
			newReq.Header.Set("Content-Type", "application/json")
		}

		// Phase 2: Post-handler (encrypt response)
		// Wrap response writer to BUFFER response body (don't write yet)
		wrappedWriter := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			body:           &bytes.Buffer{},
			headerWritten:  false,
		}

		// Call next handler
		next.ServeHTTP(wrappedWriter, newReq)
		state.status = wrappedWriter.statusCode

		// Capture plain response body for devtools
		plainRespBytes := wrappedWriter.body.Bytes()
		if len(plainRespBytes) > 0 {
			var parsed interface{}
			if err := json.Unmarshal(plainRespBytes, &parsed); err == nil {
				state.plainResponseBody = parsed
			} else {
				state.plainResponseBody = string(plainRespBytes)
			}
		}

		// Encrypt response body
		if err := m.phase2Encrypt(wrappedWriter, ctx, state); err != nil {
			m.writeError(w, err)
			m.emitLog(r, state)
			return
		}

		m.emitLog(r, state)
	})
}

// phase1Decrypt handles request decryption, validation, and ECDH.
func (m *Middleware) phase1Decrypt(r *http.Request, state *requestState) (context.Context, error) {
	ctx := r.Context()

	// Extract client public key from header
	clientPubKeyB64 := r.Header.Get("X-Client-PublicKey")
	if clientPubKeyB64 == "" {
		if m.config.AllowUnencrypted {
			return ctx, nil
		}
		code := string(core.CIPH001)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH001,
			Message: "missing X-Client-PublicKey header",
		}
	}

	state.ecdhClientPublicKey = &clientPubKeyB64
	state.ecdhSessionDerived = false

	// Extract encrypted fingerprint from header
	encFingerprintB64 := r.Header.Get("X-Fingerprint")
	if encFingerprintB64 == "" {
		code := string(core.CIPH001)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH001,
			Message: "missing X-Fingerprint header",
		}
	}

	// ECDH: Derive shared secret using server private key + client public key
	sharedSecret, err := core.DeriveSharedSecret(m.config.PrivateKey, clientPubKeyB64)
	if err != nil {
		code := string(core.CIPH007)
		state.errorCode = &code
		state.status = 401
		return ctx, err
	}

	// Derive session key from shared secret
	sessionKey, err := core.DeriveSessionKey(sharedSecret)
	if err != nil {
		code := string(core.CIPH007)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH007,
			Message: "failed to derive session key",
			Err:     err,
		}
	}

	state.ecdhSessionDerived = true

	// Decrypt fingerprint with session key
	decResult, err := core.Decrypt(encFingerprintB64, sessionKey)
	if err != nil {
		code := string(core.CIPH004)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH004,
			Message: "failed to decrypt fingerprint",
			Err:     err,
		}
	}

	// Parse fingerprint JSON (flexible map, not strict struct)
	var fpComponents map[string]interface{}
	if err := json.Unmarshal(decResult.Plaintext, &fpComponents); err != nil {
		code := string(core.CIPH004)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH004,
			Message: "failed to parse decrypted fingerprint JSON",
			Err:     err,
		}
	}

	// Validate UA (v2 follows Hono: only validate UA, not IP)
	fpUA, _ := fpComponents["userAgent"].(string)
	requestUA := r.Header.Get("User-Agent")
	state.uaMatch = fpUA == requestUA
	state.ipMatch = true // v2 doesn't validate IP

	if m.config.StrictFingerprint && !state.uaMatch {
		code := string(core.CIPH003)
		state.errorCode = &code
		state.status = 401
		return ctx, &core.CiphError{
			Code:    core.CIPH003,
			Message: "Fingerprint mismatch: User-Agent changed",
		}
	}

	// Recompute fingerprint hash using the same sort+SHA-256 the client used
	fpHash := computeFingerprintHash(fpComponents)
	state.fingerprint = fpHash

	// Derive request key
	requestKey, err := core.DeriveRequestKey(sessionKey, fpHash)
	if err != nil {
		code := string(core.CIPH007)
		state.errorCode = &code
		state.status = 401
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
			code := string(core.CIPH005)
			state.errorCode = &code
			state.status = 413
			return ctx, &core.CiphError{
				Code:    core.CIPH005,
				Message: fmt.Sprintf("payload exceeds maxPayloadSize (%d > %d)", r.ContentLength, m.config.MaxPayloadSize),
			}
		}

		ciphertextB64, err := io.ReadAll(r.Body)
		if err != nil {
			code := string(core.CIPH004)
			state.errorCode = &code
			state.status = 400
			return ctx, &core.CiphError{
				Code:    core.CIPH004,
				Message: "failed to read request body",
				Err:     err,
			}
		}
		defer r.Body.Close()

		// Capture encrypted body for devtools
		encBodyStr := string(ciphertextB64)
		state.encryptedRequestBody = &encBodyStr

		// Check actual body size
		if int64(len(ciphertextB64)) > m.config.MaxPayloadSize {
			code := string(core.CIPH005)
			state.errorCode = &code
			state.status = 413
			return ctx, &core.CiphError{
				Code:    core.CIPH005,
				Message: "payload exceeds maxPayloadSize",
			}
		}

		result, err := core.Decrypt(string(ciphertextB64), requestKey)
		if err != nil {
			code := string(core.CIPH004)
			state.errorCode = &code
			state.status = 400
			return ctx, err
		}
		plainBody = result.Plaintext

		// Capture plain body for devtools
		var parsed interface{}
		if err := json.Unmarshal(plainBody, &parsed); err == nil {
			state.plainRequestBody = parsed
		} else {
			state.plainRequestBody = string(plainBody)
		}
	}

	// Store in context
	ctx = context.WithValue(ctx, ctxBody, plainBody)
	ctx = context.WithValue(ctx, ctxSessionKey, sessionKey)
	ctx = context.WithValue(ctx, ctxRequestKey, requestKey)
	ctx = context.WithValue(ctx, ctxFingerprint, fpComponents)

	return ctx, nil
}

// computeFingerprintHash computes SHA-256 hex hash from fingerprint components map.
// Matches @ciph/core generateFingerprint: sortObject(merged) → JSON.stringify → SHA-256.
func computeFingerprintHash(components map[string]interface{}) string {
	// Convert to sorted string map (matching TS sortObject behavior)
	sorted := make(map[string]string)
	for k, v := range components {
		if str, ok := v.(string); ok {
			sorted[k] = str
		}
	}

	// json.Marshal produces sorted keys in Go
	data, _ := json.Marshal(sorted)

	// SHA-256 hex
	hash := sha256Hex(data)
	return hash
}

// sha256Hex returns hex-encoded SHA-256 hash.
func sha256Hex(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("%x", h[:])
}

// phase2Encrypt encrypts response body.
func (m *Middleware) phase2Encrypt(w *responseWriter, ctx context.Context, state *requestState) error {
	requestKeyVal := ctx.Value(ctxRequestKey)
	if requestKeyVal == nil {
		// No encryption needed (allowUnencrypted or excluded)
		// Write buffered response as-is
		w.ResponseWriter.WriteHeader(w.statusCode)
		_, err := w.ResponseWriter.Write(w.body.Bytes())
		return err
	}

	requestKey := requestKeyVal.(string)

	body := w.body.Bytes()
	if len(body) == 0 {
		w.ResponseWriter.WriteHeader(w.statusCode)
		return nil
	}

	result, err := core.Encrypt(body, requestKey)
	if err != nil {
		code := string(core.CIPH006)
		state.errorCode = &code
		state.status = 500
		return &core.CiphError{
			Code:    core.CIPH006,
			Message: "failed to encrypt response",
			Err:     err,
		}
	}

	// Capture encrypted response for devtools
	state.encryptedResponseBody = result.Ciphertext

	// Write encrypted response in JSON wire format (matching @ciph/hono)
	wirePayload := map[string]string{
		"status": "encrypted",
		"data":   result.Ciphertext,
	}
	wireJSON, _ := json.Marshal(wirePayload)

	w.ResponseWriter.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.ResponseWriter.WriteHeader(w.statusCode)
	_, err = w.ResponseWriter.Write(wireJSON)
	return err
}

// handlePublicKey serves server public key at GET /ciph-public-key.
func (m *Middleware) handlePublicKey(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]string{
		"publicKey": m.publicKey,
	})
}

// isExcluded checks if route is in exclude list with proper wildcard support.
func (m *Middleware) isExcluded(path string) bool {
	for _, route := range m.config.ExcludeRoutes {
		if route == path {
			return true
		}
		// Wildcard support: "/ciph/*" matches "/ciph/anything"
		if strings.HasSuffix(route, "/*") {
			prefix := strings.TrimSuffix(route, "/*")
			if path == prefix || strings.HasPrefix(path, prefix+"/") {
				return true
			}
		}
	}
	return false
}

// extractHeaders captures request headers for devtools logging.
func extractHeaders(r *http.Request) map[string]string {
	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[strings.ToLower(k)] = v[0]
		}
	}
	return headers
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

// generateLogID generates a short unique ID for log entries.
func generateLogID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// emitLog builds and emits a devtools log entry if devtools is enabled.
func (m *Middleware) emitLog(r *http.Request, state *requestState) {
	if m.devtools == nil {
		return
	}

	duration := time.Since(state.startedAt).Milliseconds()

	log := core.CiphServerLog{
		ID:        generateLogID(),
		Method:    r.Method,
		Route:     r.URL.Path,
		Status:    state.status,
		Duration:  duration,
		Timestamp: time.Now().Format(time.RFC3339),
		Request: core.CiphServerLogReq{
			PlainBody:     state.plainRequestBody,
			EncryptedBody: state.encryptedRequestBody,
			Headers:       state.headers,
			IP:            state.ip,
			UserAgent:     state.userAgent,
		},
		Response: core.CiphServerLogRes{
			PlainBody:     state.plainResponseBody,
			EncryptedBody: state.encryptedResponseBody,
		},
		Fingerprint: core.CiphServerLogFP{
			Value:   state.fingerprint,
			IPMatch: state.ipMatch,
			UAMatch: state.uaMatch,
		},
		Excluded: state.excluded,
		Error:    state.errorCode,
	}

	if state.ecdhClientPublicKey != nil {
		log.ECDH = &core.ECDHLogInfo{
			ClientPublicKey:    *state.ecdhClientPublicKey,
			SharedSecretDerived: state.ecdhSessionDerived,
		}
	}

	m.devtools.Append(log)
}

// getHTTPStatus returns HTTP status for a Ciph error code.
func getHTTPStatus(code string) int {
	switch code {
	case string(core.CIPH001), string(core.CIPH002), string(core.CIPH003), string(core.CIPH007):
		return http.StatusUnauthorized
	case string(core.CIPH004):
		return http.StatusBadRequest
	case string(core.CIPH005):
		return http.StatusRequestEntityTooLarge
	case string(core.CIPH006):
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}

// responseWriter captures response status and body WITHOUT writing to the underlying writer.
// This allows the middleware to encrypt the response before sending it.
type responseWriter struct {
	http.ResponseWriter
	statusCode    int
	body          *bytes.Buffer
	headerWritten bool
}

func (w *responseWriter) WriteHeader(status int) {
	w.statusCode = status
	// Do NOT call w.ResponseWriter.WriteHeader — we'll do it in phase2Encrypt
}

func (w *responseWriter) Write(b []byte) (int, error) {
	// Buffer only — do NOT write to underlying writer
	return w.body.Write(b)
}
