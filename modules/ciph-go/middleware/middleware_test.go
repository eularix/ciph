package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Eularix/ciph/modules/ciph-go/core"
)

// Helper: generate server+client key pairs and all derived keys for testing
type testKeys struct {
	ServerKeyPair *core.KeyPair
	ClientKeyPair *core.KeyPair
	SharedSecret  string
	SessionKey    string
	RequestKey    string
	FpHash        string
	FpComponents  map[string]string
}

func generateTestKeys(t *testing.T) *testKeys {
	t.Helper()

	serverKP, err := core.GenerateServerKeyPair()
	if err != nil {
		t.Fatalf("failed to generate server key pair: %v", err)
	}

	clientKP, err := core.GenerateClientKeyPair()
	if err != nil {
		t.Fatalf("failed to generate client key pair: %v", err)
	}

	// Server-side derivation (using server privKey + client pubKey)
	shared, err := core.DeriveSharedSecret(serverKP.PrivateKey, clientKP.PublicKey)
	if err != nil {
		t.Fatalf("failed to derive shared secret: %v", err)
	}

	sessionKey, err := core.DeriveSessionKey(shared)
	if err != nil {
		t.Fatalf("failed to derive session key: %v", err)
	}

	fpComponents := map[string]string{
		"userAgent": "TestAgent/1.0",
		"screen":    "1920x1080",
		"timezone":  "UTC",
	}

	// Compute hash matching @ciph/core generateFingerprint
	fpJSON, _ := json.Marshal(fpComponents)
	_ = fpJSON

	// We need the same hash computation as the middleware
	fpHash := computeTestFingerprintHash(fpComponents)

	requestKey, err := core.DeriveRequestKey(sessionKey, fpHash)
	if err != nil {
		t.Fatalf("failed to derive request key: %v", err)
	}

	return &testKeys{
		ServerKeyPair: serverKP,
		ClientKeyPair: clientKP,
		SharedSecret:  shared,
		SessionKey:    sessionKey,
		RequestKey:    requestKey,
		FpHash:        fpHash,
		FpComponents:  fpComponents,
	}
}

// Compute fingerprint hash the same way the middleware does
func computeTestFingerprintHash(components map[string]string) string {
	data, _ := json.Marshal(components)
	return sha256Hex(data)
}

// Helper: build encrypted request headers
func buildTestHeaders(t *testing.T, keys *testKeys) map[string]string {
	t.Helper()

	// Encrypt fingerprint with session key
	fpJSON, _ := json.Marshal(keys.FpComponents)
	encFp, err := core.Encrypt(fpJSON, keys.SessionKey)
	if err != nil {
		t.Fatalf("failed to encrypt fingerprint: %v", err)
	}

	return map[string]string{
		"X-Client-PublicKey": keys.ClientKeyPair.PublicKey,
		"X-Fingerprint":     encFp.Ciphertext,
		"User-Agent":        keys.FpComponents["userAgent"],
		"Content-Type":      "text/plain",
	}
}

// Helper: encrypt body with request key
func encryptTestBody(t *testing.T, body interface{}, requestKey string) string {
	t.Helper()
	plainJSON, _ := json.Marshal(body)
	result, err := core.Encrypt(plainJSON, requestKey)
	if err != nil {
		t.Fatalf("failed to encrypt body: %v", err)
	}
	return result.Ciphertext
}

// Helper: decrypt wire response body
func decryptWireResponse(t *testing.T, body []byte, requestKey string) json.RawMessage {
	t.Helper()

	// Parse wire format: { "status": "encrypted", "data": "<ciphertext>" }
	var wire struct {
		Status string `json:"status"`
		Data   string `json:"data"`
	}
	if err := json.Unmarshal(body, &wire); err != nil {
		t.Fatalf("failed to parse wire response: %v (body: %s)", err, string(body))
	}

	if wire.Status != "encrypted" {
		t.Fatalf("expected wire status 'encrypted', got %q", wire.Status)
	}

	result, err := core.Decrypt(wire.Data, requestKey)
	if err != nil {
		t.Fatalf("failed to decrypt response: %v", err)
	}

	return json.RawMessage(result.Plaintext)
}

func TestNew_RequiresPrivateKey(t *testing.T) {
	_, err := New(&Config{})
	if err == nil {
		t.Error("expected error for empty private key")
	}
}

func TestNew_DerivesPublicKey(t *testing.T) {
	serverKP, _ := core.GenerateServerKeyPair()
	m, err := New(&Config{PrivateKey: serverKP.PrivateKey})
	if err != nil {
		t.Fatalf("failed to create middleware: %v", err)
	}

	if m.GetPublicKey() == "" {
		t.Error("public key should not be empty")
	}
	if m.GetPublicKey() != serverKP.PublicKey {
		t.Error("public key should match original")
	}
}

func TestPublicKeyEndpoint(t *testing.T) {
	serverKP, _ := core.GenerateServerKeyPair()
	m, _ := New(&Config{PrivateKey: serverKP.PrivateKey})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(404)
	}))

	req := httptest.NewRequest("GET", "/ciph-public-key", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	json.NewDecoder(rec.Body).Decode(&body)
	if body["publicKey"] != serverKP.PublicKey {
		t.Errorf("publicKey mismatch: got %q, want %q", body["publicKey"], serverKP.PublicKey)
	}
}

func TestExcludedRoute_Health(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{PrivateKey: keys.ServerKeyPair.PrivateKey})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))

	req := httptest.NewRequest("GET", "/health", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	var body map[string]string
	json.NewDecoder(rec.Body).Decode(&body)
	if body["status"] != "ok" {
		t.Error("health endpoint should return plain response")
	}
}

func TestCIPH001_MissingPublicKeyHeader(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{PrivateKey: keys.ServerKeyPair.PrivateKey})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	req := httptest.NewRequest("GET", "/api/data", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Errorf("expected 401, got %d", rec.Code)
	}

	var errBody map[string]string
	json.NewDecoder(rec.Body).Decode(&errBody)
	if errBody["code"] != "CIPH001" {
		t.Errorf("expected CIPH001, got %s", errBody["code"])
	}
}

func TestCIPH001_MissingFingerprintHeader(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{PrivateKey: keys.ServerKeyPair.PrivateKey})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	req := httptest.NewRequest("GET", "/api/data", nil)
	req.Header.Set("X-Client-PublicKey", keys.ClientKeyPair.PublicKey)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Errorf("expected 401, got %d", rec.Code)
	}

	var errBody map[string]string
	json.NewDecoder(rec.Body).Decode(&errBody)
	if errBody["code"] != "CIPH001" {
		t.Errorf("expected CIPH001, got %s", errBody["code"])
	}
}

func TestCIPH003_UAMismatch(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: true,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("GET", "/api/data", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	// Override User-Agent to mismatch
	req.Header.Set("User-Agent", "DifferentBrowser/2.0")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Errorf("expected 401, got %d", rec.Code)
	}

	var errBody map[string]string
	json.NewDecoder(rec.Body).Decode(&errBody)
	if errBody["code"] != "CIPH003" {
		t.Errorf("expected CIPH003, got %s", errBody["code"])
	}
}

func TestHappyPath_GET(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: true,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("GET", "/api/data", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		body, _ := io.ReadAll(rec.Body)
		t.Fatalf("expected 200, got %d, body: %s", rec.Code, string(body))
	}

	// Response should be encrypted JSON wire format
	body := rec.Body.Bytes()
	plain := decryptWireResponse(t, body, keys.RequestKey)

	var result map[string]bool
	json.Unmarshal(plain, &result)
	if !result["ok"] {
		t.Error("expected ok: true")
	}
}

func TestHappyPath_POST(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: true,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]string
		json.NewDecoder(r.Body).Decode(&reqBody)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"echoed": reqBody["hello"]})
	}))

	// Encrypt request body
	reqBody := map[string]string{"hello": "world"}
	encryptedBody := encryptTestBody(t, reqBody, keys.RequestKey)

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("POST", "/api/echo", strings.NewReader(encryptedBody))
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		body, _ := io.ReadAll(rec.Body)
		t.Fatalf("expected 200, got %d, body: %s", rec.Code, string(body))
	}

	// Decrypt response
	body := rec.Body.Bytes()
	plain := decryptWireResponse(t, body, keys.RequestKey)

	var result map[string]string
	json.Unmarshal(plain, &result)
	if result["echoed"] != "world" {
		t.Errorf("expected echoed 'world', got %q", result["echoed"])
	}
}

func TestCIPH004_InvalidBody(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: true,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("POST", "/api/data", strings.NewReader("invalid-ciphertext"))
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 400 {
		t.Errorf("expected 400, got %d", rec.Code)
	}

	var errBody map[string]string
	json.NewDecoder(rec.Body).Decode(&errBody)
	if errBody["code"] != "CIPH004" {
		t.Errorf("expected CIPH004, got %s", errBody["code"])
	}
}

func TestCIPH005_PayloadTooLarge(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: true,
		MaxPayloadSize:    5,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("POST", "/api/data", strings.NewReader("1234567890")) // > 5 bytes
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 413 {
		t.Errorf("expected 413, got %d", rec.Code)
	}

	var errBody map[string]string
	json.NewDecoder(rec.Body).Decode(&errBody)
	if errBody["code"] != "CIPH005" {
		t.Errorf("expected CIPH005, got %s", errBody["code"])
	}
}

func TestAllowUnencrypted(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:       keys.ServerKeyPair.PrivateKey,
		AllowUnencrypted: true,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))

	// Send request without encryption headers
	req := httptest.NewRequest("GET", "/api/data", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	// Response should be plain (not encrypted) since no keys were exchanged
	var body map[string]bool
	json.NewDecoder(rec.Body).Decode(&body)
	if !body["ok"] {
		t.Error("expected ok: true in plain response")
	}
}

func TestIsExcluded_WildcardMatching(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:    keys.ServerKeyPair.PrivateKey,
		ExcludeRoutes: []string{"/health", "/ciph/*"},
	})

	tests := []struct {
		path     string
		excluded bool
	}{
		{"/health", true},
		{"/ciph/logs", true},
		{"/ciph/stream", true},
		{"/api/users", false},
		{"/ciphx", false}, // should NOT match /ciph/*
	}

	for _, tc := range tests {
		t.Run(tc.path, func(t *testing.T) {
			if got := m.isExcluded(tc.path); got != tc.excluded {
				t.Errorf("isExcluded(%q) = %v, want %v", tc.path, got, tc.excluded)
			}
		})
	}
}

func TestStrictFingerprintFalse_SkipsUACheck(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{
		PrivateKey:        keys.ServerKeyPair.PrivateKey,
		StrictFingerprint: false,
	})

	handler := m.Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]bool{"ok": true})
	}))

	headers := buildTestHeaders(t, keys)
	req := httptest.NewRequest("GET", "/api/data", nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	// Override User-Agent
	req.Header.Set("User-Agent", "DifferentBrowser/2.0")

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != 200 {
		body, _ := io.ReadAll(rec.Body)
		t.Errorf("expected 200 with strictFingerprint=false, got %d, body: %s", rec.Code, string(body))
	}
}

func TestDevToolsBuffer(t *testing.T) {
	keys := generateTestKeys(t)
	m, _ := New(&Config{PrivateKey: keys.ServerKeyPair.PrivateKey})
	m.EnableDevTools(10)

	if m.GetDevToolsBuffer() == nil {
		t.Error("devtools buffer should not be nil after EnableDevTools")
	}

	if m.GetDevToolsBuffer().Size() != 0 {
		t.Error("buffer should be empty initially")
	}
}
