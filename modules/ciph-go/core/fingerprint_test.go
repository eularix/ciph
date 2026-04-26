package core

import (
	"testing"
)

func TestGenerateFingerprint(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	result, err := GenerateFingerprint(components)
	if err != nil {
		t.Fatalf("failed to generate fingerprint: %v", err)
	}

	if result.Hash == "" {
		t.Error("fingerprint hash is empty")
	}

	if len(result.Hash) != 64 {
		t.Errorf("expected 64-char SHA-256 hex, got %d", len(result.Hash))
	}
}

func TestFingerprintDeterministic(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	fp1, _ := GenerateFingerprint(components)
	fp2, _ := GenerateFingerprint(components)

	if fp1.Hash != fp2.Hash {
		t.Error("same components should produce same hash")
	}
}

func TestFingerprintDifferent(t *testing.T) {
	fp1 := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	fp2 := FingerprintComponents{
		UserAgent: "Chrome",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	hash1, _ := GenerateFingerprint(fp1)
	hash2, _ := GenerateFingerprint(fp2)

	if hash1.Hash == hash2.Hash {
		t.Error("different components should produce different hashes")
	}
}

func TestGetFingerprintHash(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	hash1 := GetFingerprintHash(components)
	hash2 := GetFingerprintHash(components)

	if hash1 != hash2 {
		t.Error("same components should produce same hash")
	}

	if len(hash1) != 64 {
		t.Errorf("expected 64-char hex, got %d", len(hash1))
	}
}

func TestFingerprintJSON(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	jsonData := FingerprintToJSON(components)
	if len(jsonData) == 0 {
		t.Error("fingerprint JSON is empty")
	}

	parsed, err := FingerprintFromJSON(jsonData)
	if err != nil {
		t.Fatalf("failed to parse fingerprint JSON: %v", err)
	}

	if parsed.UserAgent != components.UserAgent {
		t.Errorf("UserAgent mismatch: got %q, want %q", parsed.UserAgent, components.UserAgent)
	}
	if parsed.IP != components.IP {
		t.Errorf("IP mismatch: got %q, want %q", parsed.IP, components.IP)
	}
}

func TestFingerprintJSONDeterministic(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	json1 := FingerprintToJSON(components)
	json2 := FingerprintToJSON(components)

	if string(json1) != string(json2) {
		t.Error("JSON output should be deterministic")
	}
}

func TestEncryptDecryptFingerprint(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
	}

	// Generate valid 32-byte key
	keyBytes, _ := RandomBytes(32)
	key := ToBase64url(keyBytes)

	encrypted, err := EncryptFingerprintComponents(components, key)
	if err != nil {
		t.Fatalf("failed to encrypt fingerprint: %v", err)
	}

	if encrypted == "" {
		t.Error("encrypted fingerprint is empty")
	}

	decrypted, err := DecryptFingerprintComponents(encrypted, key)
	if err != nil {
		t.Fatalf("failed to decrypt fingerprint: %v", err)
	}

	if decrypted.UserAgent != components.UserAgent {
		t.Errorf("UserAgent mismatch: got %q, want %q", decrypted.UserAgent, components.UserAgent)
	}
	if decrypted.IP != components.IP {
		t.Errorf("IP mismatch: got %q, want %q", decrypted.IP, components.IP)
	}
}

func TestValidateFingerprintIP(t *testing.T) {
	if !ValidateFingerprintIP("192.168.1.1", "192.168.1.1") {
		t.Error("matching IPs should validate")
	}

	if ValidateFingerprintIP("192.168.1.1", "10.0.0.1") {
		t.Error("different IPs should not validate")
	}
}

func TestValidateFingerprintUA(t *testing.T) {
	ua := "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

	if !ValidateFingerprintUA(ua, ua) {
		t.Error("matching User-Agents should validate")
	}

	if ValidateFingerprintUA(ua, "Chrome") {
		t.Error("different User-Agents should not validate")
	}
}

func TestValidateFingerprint(t *testing.T) {
	stored := "abc123def456"
	incoming := "abc123def456"

	if !ValidateFingerprint(stored, incoming) {
		t.Error("matching fingerprints should validate")
	}

	if ValidateFingerprint(stored, "xyz789") {
		t.Error("different fingerprints should not validate")
	}
}

func TestFingerprintWithCustomFields(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
		Custom: map[string]string{
			"app_version": "1.0.0",
			"device_id":   "abc123",
		},
	}

	hash1 := GetFingerprintHash(components)

	// Remove custom fields
	components.Custom = nil
	hash2 := GetFingerprintHash(components)

	if hash1 == hash2 {
		t.Error("fingerprints with/without custom fields should differ")
	}
}

func TestFingerprintJSONWithCustom(t *testing.T) {
	components := FingerprintComponents{
		UserAgent: "Mozilla/5.0",
		Screen:    "1920x1080",
		Timezone:  "UTC",
		IP:        "192.168.1.1",
		Custom: map[string]string{
			"app_version": "1.0.0",
		},
	}

	jsonData := FingerprintToJSON(components)
	parsed, err := FingerprintFromJSON(jsonData)
	if err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	if parsed.Custom["app_version"] != "1.0.0" {
		t.Error("custom fields not preserved")
	}
}
