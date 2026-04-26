package core

import (
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

	// Different raw shared secrets should produce different session keys
	rawShared2, _ := DeriveSharedSecret(clientKeyPair.PrivateKey, serverKeyPair.PublicKey)
	sessionKey2, _ := DeriveSessionKey(rawShared2)

	if sessionKey != sessionKey2 {
		t.Error("same input should produce same session key")
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
