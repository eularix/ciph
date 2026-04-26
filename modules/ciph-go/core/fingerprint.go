package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

// GenerateFingerprint generates SHA-256 hash of sorted fingerprint components.
func GenerateFingerprint(components FingerprintComponents) (*FingerprintResult, error) {
	// Sort components for consistent hash
	sorted := sortedFingerprintJSON(components)

	hash := sha256.Sum256(sorted)
	hashHex := hex.EncodeToString(hash[:])

	return &FingerprintResult{
		Hash:       hashHex,
		Components: components,
	}, nil
}

// ValidateFingerprint compares two fingerprints.
func ValidateFingerprint(stored string, incoming string) bool {
	return stored == incoming
}

// sortedFingerprintJSON returns JSON with sorted keys for deterministic hashing.
func sortedFingerprintJSON(components FingerprintComponents) []byte {
	// Create ordered map
	m := map[string]interface{}{
		"userAgent": components.UserAgent,
		"screen":    components.Screen,
		"timezone":  components.Timezone,
		"ip":        components.IP,
	}

	if len(components.Custom) > 0 {
		m["custom"] = components.Custom
	}

	// Marshal to JSON (Go's json.Marshal uses sorted keys)
	data, _ := json.Marshal(m)
	return data
}

// FingerprintFromJSON parses JSON and creates FingerprintComponents.
func FingerprintFromJSON(jsonData []byte) (*FingerprintComponents, error) {
	var components FingerprintComponents
	if err := json.Unmarshal(jsonData, &components); err != nil {
		return nil, &CiphError{
			Code:    "JSON_ERROR",
			Message: "failed to parse fingerprint JSON",
			Err:     err,
		}
	}
	return &components, nil
}

// FingerprintToJSON converts FingerprintComponents to sorted JSON.
func FingerprintToJSON(components FingerprintComponents) []byte {
	return sortedFingerprintJSON(components)
}

// GetFingerprintHash computes SHA-256 hash of components.
func GetFingerprintHash(components FingerprintComponents) string {
	sorted := sortedFingerprintJSON(components)
	hash := sha256.Sum256(sorted)
	return hex.EncodeToString(hash[:])
}

// EncryptFingerprintComponents encrypts fingerprint with session_key.
func EncryptFingerprintComponents(components FingerprintComponents, sessionKeyBase64 string) (string, error) {
	jsonData := FingerprintToJSON(components)
	result, err := Encrypt(jsonData, sessionKeyBase64)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH006,
			Message: "failed to encrypt fingerprint",
			Err:     err,
		}
	}
	return result.Ciphertext, nil
}

// DecryptFingerprintComponents decrypts fingerprint with session_key.
func DecryptFingerprintComponents(ciphertextBase64 string, sessionKeyBase64 string) (*FingerprintComponents, error) {
	result, err := Decrypt(ciphertextBase64, sessionKeyBase64)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to decrypt fingerprint",
			Err:     err,
		}
	}

	components, err := FingerprintFromJSON(result.Plaintext)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to parse decrypted fingerprint",
			Err:     err,
		}
	}

	return components, nil
}

// ValidateFingerprintIP checks if IP matches stored fingerprint.
func ValidateFingerprintIP(storedIP string, incomingIP string) bool {
	return storedIP == incomingIP
}

// ValidateFingerprintUA checks if User-Agent matches stored fingerprint.
func ValidateFingerprintUA(storedUA string, incomingUA string) bool {
	return storedUA == incomingUA
}
