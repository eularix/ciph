package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"io"

	"golang.org/x/crypto/hkdf"
)

// GenerateServerKeyPair generates a static P-256 ECDH key pair for server.
// Returns PKCS8-encoded private key (matches @ciph/core format).
func GenerateServerKeyPair() (*KeyPair, error) {
	privKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, &CiphError{
			Code:    "KEY_GEN_ERROR",
			Message: "failed to generate server key pair",
			Err:     err,
		}
	}

	pubKeyBytes := privKey.PublicKey().Bytes()

	// Export as PKCS8 (same format as @ciph/core)
	privPkcs8, err := x509.MarshalPKCS8PrivateKey(privKey)
	if err != nil {
		return nil, &CiphError{
			Code:    "KEY_GEN_ERROR",
			Message: "failed to marshal private key to PKCS8",
			Err:     err,
		}
	}

	return &KeyPair{
		PrivateKey: base64.RawURLEncoding.EncodeToString(privPkcs8),
		PublicKey:  base64.RawURLEncoding.EncodeToString(pubKeyBytes),
	}, nil
}

// GenerateClientKeyPair generates an ephemeral P-256 ECDH key pair for client.
func GenerateClientKeyPair() (*KeyPair, error) {
	privKey, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, &CiphError{
			Code:    "KEY_GEN_ERROR",
			Message: "failed to generate client key pair",
			Err:     err,
		}
	}

	pubKeyBytes := privKey.PublicKey().Bytes()
	privKeyBytes := privKey.Bytes()

	return &KeyPair{
		PrivateKey: base64.RawURLEncoding.EncodeToString(privKeyBytes),
		PublicKey:  base64.RawURLEncoding.EncodeToString(pubKeyBytes),
	}, nil
}

// DeriveSharedSecret performs ECDH with private key and peer public key.
// privateKeyBase64 can be PKCS8 format (from GenerateServerKeyPair or @ciph/core)
// peerPublicKeyBase64 must be raw uncompressed P-256 public key (65 bytes).
// Both sides derive the same raw_shared_secret.
func DeriveSharedSecret(privateKeyBase64 string, peerPublicKeyBase64 string) (string, error) {
	privKeyBytes, err := base64.RawURLEncoding.DecodeString(privateKeyBase64)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH002,
			Message: "failed to decode private key",
			Err:     err,
		}
	}

	pubKeyBytes, err := base64.RawURLEncoding.DecodeString(peerPublicKeyBase64)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH002,
			Message: "failed to decode peer public key",
			Err:     err,
		}
	}

	// Try to parse as PKCS8 first (standard format from @ciph/core)
	privKeyInterface, err := x509.ParsePKCS8PrivateKey(privKeyBytes)
	var privKey *ecdh.PrivateKey

	if err != nil {
		// Fallback: try raw 32-byte format (legacy)
		privKey, err = ecdh.P256().NewPrivateKey(privKeyBytes)
		if err != nil {
			return "", &CiphError{
				Code:    CIPH007,
				Message: "invalid private key format (not PKCS8 or raw)",
				Err:     err,
			}
		}
	} else {
		// Extract ECDH private key from parsed interface
		var ok bool
		privKey, ok = privKeyInterface.(*ecdh.PrivateKey)
		if !ok {
			return "", &CiphError{
				Code:    CIPH007,
				Message: "private key is not P-256 ECDH",
				Err:     nil,
			}
		}
	}

	pubKey, err := ecdh.P256().NewPublicKey(pubKeyBytes)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH007,
			Message: "invalid peer public key format",
			Err:     err,
		}
	}

	sharedSecret, err := privKey.ECDH(pubKey)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH007,
			Message: "ECDH derivation failed",
			Err:     err,
		}
	}

	return base64.RawURLEncoding.EncodeToString(sharedSecret), nil
}

// DeriveSessionKey derives session_key from raw_shared_secret via HKDF.
func DeriveSessionKey(rawSharedBase64 string) (string, error) {
	rawShared, err := base64.RawURLEncoding.DecodeString(rawSharedBase64)
	if err != nil {
		return "", &CiphError{
			Code:    "DECODE_ERROR",
			Message: "failed to decode shared secret",
			Err:     err,
		}
	}

	hash := sha256.New
	hkdf := hkdf.New(hash, rawShared, nil, []byte("ciph-v2-session"))

	sessionKey := make([]byte, 32)
	if _, err := io.ReadFull(hkdf, sessionKey); err != nil {
		return "", &CiphError{
			Code:    "HKDF_ERROR",
			Message: "failed to derive session key",
			Err:     err,
		}
	}

	return base64.RawURLEncoding.EncodeToString(sessionKey), nil
}

// DeriveRequestKey derives request_key from session_key + fingerprint_hash via HKDF.
func DeriveRequestKey(sessionKeyBase64 string, fingerprintHash string) (string, error) {
	sessionKey, err := base64.RawURLEncoding.DecodeString(sessionKeyBase64)
	if err != nil {
		return "", &CiphError{
			Code:    "DECODE_ERROR",
			Message: "failed to decode session key",
			Err:     err,
		}
	}

	salt := []byte(fingerprintHash)
	hash := sha256.New
	hkdf := hkdf.New(hash, sessionKey, salt, []byte("ciph-v2-request"))

	requestKey := make([]byte, 32)
	if _, err := io.ReadFull(hkdf, requestKey); err != nil {
		return "", &CiphError{
			Code:    "HKDF_ERROR",
			Message: "failed to derive request key",
			Err:     err,
		}
	}

	return base64.RawURLEncoding.EncodeToString(requestKey), nil
}

// Encrypt encrypts plaintext with AES-256-GCM.
// Returns base64url(IV[12] + AuthTag[16] + Ciphertext[n])
func Encrypt(plaintext []byte, keyBase64 string) (*EncryptResult, error) {
	key, err := base64.RawURLEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, &CiphError{
			Code:    "DECODE_ERROR",
			Message: "failed to decode key",
			Err:     err,
		}
	}

	if len(key) != 32 {
		return nil, &CiphError{
			Code:    "KEY_ERROR",
			Message: "key must be 32 bytes",
		}
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH006,
			Message: "failed to create cipher",
			Err:     err,
		}
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH006,
			Message: "failed to create GCM",
			Err:     err,
		}
	}

	iv := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, &CiphError{
			Code:    CIPH006,
			Message: "failed to generate IV",
			Err:     err,
		}
	}

	ciphertext := gcm.Seal(nil, iv, plaintext, nil)
	// ciphertext already contains: nonce || ciphertext (from Seal)
	// GCM Seal appends auth tag to the ciphertext
	// So we need: IV || ciphertext (which includes auth tag)

	combined := append(iv, ciphertext...)
	encoded := base64.RawURLEncoding.EncodeToString(combined)

	return &EncryptResult{
		Ciphertext: encoded,
	}, nil
}

// Decrypt decrypts base64url(IV + AuthTag + Ciphertext) with AES-256-GCM.
func Decrypt(ciphertextBase64 string, keyBase64 string) (*DecryptResult, error) {
	key, err := base64.RawURLEncoding.DecodeString(keyBase64)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to decode key",
			Err:     err,
		}
	}

	if len(key) != 32 {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "key must be 32 bytes",
		}
	}

	combined, err := base64.RawURLEncoding.DecodeString(ciphertextBase64)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to decode ciphertext",
			Err:     err,
		}
	}

	if len(combined) < 12 {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "ciphertext too short",
		}
	}

	iv := combined[:12]
	ciphertext := combined[12:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to create cipher",
			Err:     err,
		}
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "failed to create GCM",
			Err:     err,
		}
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "decryption failed",
			Err:     err,
		}
	}

	return &DecryptResult{
		Plaintext: plaintext,
	}, nil
}

// RandomBytes generates n random bytes.
func RandomBytes(n int) ([]byte, error) {
	b := make([]byte, n)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return nil, err
	}
	return b, nil
}

// ToBase64url encodes bytes to base64url string.
func ToBase64url(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

// FromBase64url decodes base64url string to bytes.
func FromBase64url(encoded string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(encoded)
}
