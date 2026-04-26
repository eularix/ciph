package core

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestGenerateServerKeyPair(t *testing.T) {
	keyPair, err := GenerateServerKeyPair()
	if err != nil {
		t.Fatalf("failed to generate server key pair: %v", err)
	}

	if keyPair.PrivateKey == "" {
		t.Error("private key is empty")
	}
	if keyPair.PublicKey == "" {
		t.Error("public key is empty")
	}

	// Keys should be base64url encoded
	if strings.ContainsAny(keyPair.PrivateKey, "+/=") {
		t.Error("private key should be base64url (no +/=)")
	}
	if strings.ContainsAny(keyPair.PublicKey, "+/=") {
		t.Error("public key should be base64url (no +/=)")
	}

	// Public key should be 65 bytes (uncompressed P-256 point)
	pubKeyBytes, _ := base64.RawURLEncoding.DecodeString(keyPair.PublicKey)
	if len(pubKeyBytes) != 65 {
		t.Errorf("public key should be 65 bytes, got %d", len(pubKeyBytes))
	}
	if pubKeyBytes[0] != 0x04 {
		t.Error("public key should start with 0x04 (uncompressed)")
	}
}

func TestGenerateClientKeyPair(t *testing.T) {
	keyPair, err := GenerateClientKeyPair()
	if err != nil {
		t.Fatalf("failed to generate client key pair: %v", err)
	}

	if keyPair.PrivateKey == "" {
		t.Error("private key is empty")
	}
	if keyPair.PublicKey == "" {
		t.Error("public key is empty")
	}

	// Client private key is raw 32 bytes
	privKeyBytes, _ := base64.RawURLEncoding.DecodeString(keyPair.PrivateKey)
	if len(privKeyBytes) != 32 {
		t.Errorf("client private key should be 32 bytes, got %d", len(privKeyBytes))
	}

	// Public key should be 65 bytes (uncompressed P-256 point)
	pubKeyBytes, _ := base64.RawURLEncoding.DecodeString(keyPair.PublicKey)
	if len(pubKeyBytes) != 65 {
		t.Errorf("public key should be 65 bytes, got %d", len(pubKeyBytes))
	}
}

func TestDerivePublicKeyFromPrivate(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()

	derivedPubKey, err := DerivePublicKeyFromPrivate(serverKeyPair.PrivateKey)
	if err != nil {
		t.Fatalf("failed to derive public key: %v", err)
	}

	if derivedPubKey != serverKeyPair.PublicKey {
		t.Error("derived public key does not match original")
	}
}

func TestDerivePublicKeyFromPrivate_InvalidKey(t *testing.T) {
	_, err := DerivePublicKeyFromPrivate("invalid-key-data")
	if err == nil {
		t.Error("expected error for invalid key data")
	}
}

func TestDeriveSharedSecret(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()

	// Client side: use client privKey + server pubKey
	shared1, err := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	if err != nil {
		t.Fatalf("client failed to derive shared secret: %v", err)
	}

	// Server side: use server privKey + client pubKey
	shared2, err := DeriveSharedSecret(serverKeyPair.PrivateKey, clientKeyPair.PublicKey)
	if err != nil {
		t.Fatalf("server failed to derive shared secret: %v", err)
	}

	// Both should produce same shared secret
	if shared1 != shared2 {
		t.Error("shared secrets do not match")
	}

	if shared1 == "" {
		t.Error("shared secret is empty")
	}

	// Shared secret should be 32 bytes
	sharedBytes, _ := base64.RawURLEncoding.DecodeString(shared1)
	if len(sharedBytes) != 32 {
		t.Errorf("shared secret should be 32 bytes, got %d", len(sharedBytes))
	}
}

func TestDeriveSessionKey(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()
	rawShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)

	sessionKey, err := DeriveSessionKey(rawShared)
	if err != nil {
		t.Fatalf("failed to derive session key: %v", err)
	}

	if sessionKey == "" {
		t.Error("session key is empty")
	}

	// Session key should be 32 bytes
	keyBytes, _ := base64.RawURLEncoding.DecodeString(sessionKey)
	if len(keyBytes) != 32 {
		t.Errorf("session key should be 32 bytes, got %d", len(keyBytes))
	}

	// Same input should produce same session key (deterministic)
	sessionKey2, _ := DeriveSessionKey(rawShared)
	if sessionKey != sessionKey2 {
		t.Error("same input should produce same session key")
	}
}

func TestDeriveSessionKey_BothSidesMatch(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()

	// Client derives session key
	clientShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	clientSessionKey, _ := DeriveSessionKey(clientShared)

	// Server derives session key
	serverShared, _ := DeriveSharedSecret(serverKeyPair.PrivateKey, clientKeyPair.PublicKey)
	serverSessionKey, _ := DeriveSessionKey(serverShared)

	if clientSessionKey != serverSessionKey {
		t.Error("client and server session keys should match")
	}
}

func TestDeriveRequestKey(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()
	rawShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	sessionKey, _ := DeriveSessionKey(rawShared)

	fp := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}
	fpHash := GetFingerprintHash(fp)

	requestKey, err := DeriveRequestKey(sessionKey, fpHash)
	if err != nil {
		t.Fatalf("failed to derive request key: %v", err)
	}

	if requestKey == "" {
		t.Error("request key is empty")
	}

	// Request key should be 32 bytes
	keyBytes, _ := base64.RawURLEncoding.DecodeString(requestKey)
	if len(keyBytes) != 32 {
		t.Errorf("request key should be 32 bytes, got %d", len(keyBytes))
	}

	// Different fingerprints should produce different request keys
	fp2 := FingerprintComponents{
		UserAgent: "Chrome",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}
	fpHash2 := GetFingerprintHash(fp2)
	requestKey2, _ := DeriveRequestKey(sessionKey, fpHash2)

	if requestKey == requestKey2 {
		t.Error("different fingerprints should produce different request keys")
	}
}

func TestDeriveRequestKey_BothSidesMatch(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()

	fp := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
	}
	fpHash := GetFingerprintHash(fp)

	// Client side
	clientShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	clientSessionKey, _ := DeriveSessionKey(clientShared)
	clientRequestKey, _ := DeriveRequestKey(clientSessionKey, fpHash)

	// Server side
	serverShared, _ := DeriveSharedSecret(serverKeyPair.PrivateKey, clientKeyPair.PublicKey)
	serverSessionKey, _ := DeriveSessionKey(serverShared)
	serverRequestKey, _ := DeriveRequestKey(serverSessionKey, fpHash)

	if clientRequestKey != serverRequestKey {
		t.Error("client and server request keys should match")
	}
}

func TestEncryptDecrypt(t *testing.T) {
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()
	rawShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	sessionKey, _ := DeriveSessionKey(rawShared)

	plaintext := []byte(`{"user":"alice","email":"alice@example.com"}`)

	result, err := Encrypt(plaintext, sessionKey)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	if result.Ciphertext == "" {
		t.Error("ciphertext is empty")
	}

	// Decrypt and verify
	decrypted, err := Decrypt(result.Ciphertext, sessionKey)
	if err != nil {
		t.Fatalf("decryption failed: %v", err)
	}

	if string(decrypted.Plaintext) != string(plaintext) {
		t.Errorf("decrypted plaintext mismatch: got %s, want %s", string(decrypted.Plaintext), string(plaintext))
	}
}

func TestEncryptDecryptRoundtrip(t *testing.T) {
	// Generate a valid 32-byte key
	keyBytes, _ := RandomBytes(32)
	key := ToBase64url(keyBytes)

	testCases := []struct {
		name      string
		plaintext []byte
	}{
		{"empty", []byte("")},
		{"small", []byte("hi")},
		{"json", []byte(`{"foo":"bar"}`)},
		{"large", []byte(strings.Repeat("x", 1000))},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			encrypted, err := Encrypt(tc.plaintext, key)
			if err != nil {
				t.Fatalf("encryption failed: %v", err)
			}

			decrypted, err := Decrypt(encrypted.Ciphertext, key)
			if err != nil {
				t.Fatalf("decryption failed: %v", err)
			}

			if string(decrypted.Plaintext) != string(tc.plaintext) {
				t.Errorf("mismatch: got %q, want %q", string(decrypted.Plaintext), string(tc.plaintext))
			}
		})
	}
}

func TestCiphertextFormat_IVTagData(t *testing.T) {
	// Verify ciphertext format matches @ciph/core: IV[12] + AuthTag[16] + Data[n]
	keyBytes, _ := RandomBytes(32)
	key := ToBase64url(keyBytes)
	plaintext := []byte("test data for format check")

	result, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("encryption failed: %v", err)
	}

	// Decode the ciphertext
	combined, _ := base64.RawURLEncoding.DecodeString(result.Ciphertext)

	// Must be at least 12 + 16 bytes
	if len(combined) < 28 {
		t.Fatalf("ciphertext too short: %d bytes", len(combined))
	}

	// IV is first 12 bytes
	iv := combined[:12]
	if len(iv) != 12 {
		t.Errorf("IV should be 12 bytes, got %d", len(iv))
	}

	// Tag is next 16 bytes
	tag := combined[12:28]
	if len(tag) != 16 {
		t.Errorf("AuthTag should be 16 bytes, got %d", len(tag))
	}

	// Data is the rest
	data := combined[28:]
	if len(data) != len(plaintext) {
		t.Errorf("data length mismatch: got %d, want %d", len(data), len(plaintext))
	}

	// Verify the format is base64url (no +/=)
	if strings.ContainsAny(result.Ciphertext, "+/=") {
		t.Error("ciphertext should be base64url encoded (no +/=)")
	}
}

func TestDecryptInvalidKey(t *testing.T) {
	// Generate valid key
	keyBytes, _ := RandomBytes(32)
	key := ToBase64url(keyBytes)
	plaintext := []byte("test")

	encrypted, _ := Encrypt(plaintext, key)

	// Try to decrypt with wrong key
	wrongKeyBytes, _ := RandomBytes(32)
	wrongKey := ToBase64url(wrongKeyBytes)
	_, err := Decrypt(encrypted.Ciphertext, wrongKey)

	if err == nil {
		t.Error("expected decryption to fail with wrong key")
	}

	cipherErr, ok := err.(*CiphError)
	if !ok {
		t.Fatalf("expected CiphError, got %T", err)
	}

	if cipherErr.Code != CIPH004 {
		t.Errorf("expected CIPH004, got %s", cipherErr.Code)
	}
}

func TestDecryptTooShort(t *testing.T) {
	keyBytes, _ := RandomBytes(32)
	key := ToBase64url(keyBytes)

	// Test with ciphertext shorter than IV + Tag (28 bytes)
	shortData := base64.RawURLEncoding.EncodeToString([]byte("short"))
	_, err := Decrypt(shortData, key)
	if err == nil {
		t.Error("expected error for short ciphertext")
	}
}

func TestE2E_FullKeyDerivationAndEncryption(t *testing.T) {
	// Simulate full client-server E2E flow
	serverKeyPair, _ := GenerateServerKeyPair()
	clientKeyPair, _ := GenerateClientKeyPair()

	// Client: derive keys
	clientShared, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	clientSessionKey, _ := DeriveSessionKey(clientShared)

	fp := FingerprintComponents{
		UserAgent: "Mozilla/5.0 (Macintosh)",
		Screen:    "1920x1080",
		Timezone:  "Asia/Jakarta",
	}
	fpHash := GetFingerprintHash(fp)
	clientRequestKey, _ := DeriveRequestKey(clientSessionKey, fpHash)

	// Client: encrypt fingerprint with session key
	encFp, err := EncryptFingerprintComponents(fp, clientSessionKey)
	if err != nil {
		t.Fatalf("failed to encrypt fingerprint: %v", err)
	}

	// Client: encrypt body with request key
	body := []byte(`{"name":"alice","email":"alice@example.com"}`)
	encBody, err := Encrypt(body, clientRequestKey)
	if err != nil {
		t.Fatalf("failed to encrypt body: %v", err)
	}

	// --- Server receives: clientKeyPair.PublicKey, encFp, encBody ---

	// Server: derive keys
	serverShared, _ := DeriveSharedSecret(serverKeyPair.PrivateKey, clientKeyPair.PublicKey)
	serverSessionKey, _ := DeriveSessionKey(serverShared)

	// Server: decrypt fingerprint
	decFp, err := DecryptFingerprintComponents(encFp, serverSessionKey)
	if err != nil {
		t.Fatalf("server failed to decrypt fingerprint: %v", err)
	}

	if decFp.UserAgent != fp.UserAgent {
		t.Errorf("fingerprint UA mismatch: got %q, want %q", decFp.UserAgent, fp.UserAgent)
	}

	// Server: derive request key
	serverFpHash := GetFingerprintHash(*decFp)
	serverRequestKey, _ := DeriveRequestKey(serverSessionKey, serverFpHash)

	if clientRequestKey != serverRequestKey {
		t.Error("client and server request keys should match")
	}

	// Server: decrypt body
	decBody, err := Decrypt(encBody.Ciphertext, serverRequestKey)
	if err != nil {
		t.Fatalf("server failed to decrypt body: %v", err)
	}

	if string(decBody.Plaintext) != string(body) {
		t.Errorf("body mismatch: got %q, want %q", string(decBody.Plaintext), string(body))
	}

	// Server: encrypt response
	response := []byte(`{"id":1,"name":"alice","email":"alice@example.com"}`)
	encResponse, err := Encrypt(response, serverRequestKey)
	if err != nil {
		t.Fatalf("server failed to encrypt response: %v", err)
	}

	// Client: decrypt response
	decResponse, err := Decrypt(encResponse.Ciphertext, clientRequestKey)
	if err != nil {
		t.Fatalf("client failed to decrypt response: %v", err)
	}

	if string(decResponse.Plaintext) != string(response) {
		t.Errorf("response mismatch: got %q, want %q", string(decResponse.Plaintext), string(response))
	}
}

func TestRandomBytes(t *testing.T) {
	bytes1, err := RandomBytes(16)
	if err != nil {
		t.Fatalf("failed to generate random bytes: %v", err)
	}

	if len(bytes1) != 16 {
		t.Errorf("expected 16 bytes, got %d", len(bytes1))
	}

	// Generate again - should be different
	bytes2, _ := RandomBytes(16)
	if string(bytes1) == string(bytes2) {
		t.Error("random bytes should be different")
	}
}

func TestBase64urlConversion(t *testing.T) {
	original := []byte("test data 123!@#")

	encoded := ToBase64url(original)
	if strings.ContainsAny(encoded, "+/=") {
		t.Error("base64url should not contain +/=")
	}

	decoded, err := FromBase64url(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if string(decoded) != string(original) {
		t.Errorf("roundtrip failed: got %q, want %q", string(decoded), string(original))
	}
}
