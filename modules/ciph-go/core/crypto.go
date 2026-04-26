package core

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
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

// parsePrivateKey parses a private key from bytes.
// Supports PKCS8 format (from @ciph/core generateKeyPair) and raw 32-byte format.
// x509.ParsePKCS8PrivateKey returns *ecdsa.PrivateKey which we convert to *ecdh.PrivateKey.
func parsePrivateKey(privKeyBytes []byte) (*ecdh.PrivateKey, error) {
	// Try PKCS8 first (standard format from @ciph/core)
	privKeyInterface, err := x509.ParsePKCS8PrivateKey(privKeyBytes)
	if err == nil {
		// x509 returns *ecdsa.PrivateKey, convert to *ecdh.PrivateKey
		switch k := privKeyInterface.(type) {
		case *ecdsa.PrivateKey:
			ecdhKey, err := k.ECDH()
			if err != nil {
				return nil, &CiphError{
					Code:    CIPH007,
					Message: "failed to convert ECDSA key to ECDH",
					Err:     err,
				}
			}
			return ecdhKey, nil
		case *ecdh.PrivateKey:
			return k, nil
		default:
			return nil, &CiphError{
				Code:    CIPH007,
				Message: "private key is not P-256 ECDH",
			}
		}
	}

	// Fallback: try raw 32-byte format (client ephemeral keys)
	privKey, err := ecdh.P256().NewPrivateKey(privKeyBytes)
	if err != nil {
		return nil, &CiphError{
			Code:    CIPH007,
			Message: "invalid private key format (not PKCS8 or raw)",
			Err:     err,
		}
	}
	return privKey, nil
}

// DerivePublicKeyFromPrivate derives the public key from a PKCS8-encoded private key.
// Used to serve the public key at /ciph-public-key endpoint.
func DerivePublicKeyFromPrivate(privateKeyBase64 string) (string, error) {
	privKeyBytes, err := base64.RawURLEncoding.DecodeString(privateKeyBase64)
	if err != nil {
		return "", &CiphError{
			Code:    CIPH002,
			Message: "failed to decode private key",
			Err:     err,
		}
	}

	privKey, err := parsePrivateKey(privKeyBytes)
	if err != nil {
		return "", err
	}

	pubKeyBytes := privKey.PublicKey().Bytes()
	return base64.RawURLEncoding.EncodeToString(pubKeyBytes), nil
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

	privKey, err := parsePrivateKey(privKeyBytes)
	if err != nil {
		return "", err
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
// Uses HKDF-SHA256 with 32 zero-byte salt and info = "ciph-v2-session".
// Matches @ciph/core deriveSessionKey exactly.
func DeriveSessionKey(rawSharedBase64 string) (string, error) {
	rawShared, err := base64.RawURLEncoding.DecodeString(rawSharedBase64)
	if err != nil {
		return "", &CiphError{
			Code:    "DECODE_ERROR",
			Message: "failed to decode shared secret",
			Err:     err,
		}
	}

	// Use 32 zero bytes as salt (matches TS: new Uint8Array(32))
	salt := make([]byte, 32)
	hash := sha256.New
	hkdf := hkdf.New(hash, rawShared, salt, []byte("ciph-v2-session"))

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
// Uses HKDF-SHA256 with salt = fingerprint_hash bytes, info = "ciph-v2-request".
// Matches @ciph/core deriveRequestKey exactly.
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
// This format matches @ciph/core encrypt exactly.
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

	// gcm.Seal produces: ciphertext_data + auth_tag (tag is appended at end)
	sealed := gcm.Seal(nil, iv, plaintext, nil)

	// sealed = data[n] + tag[16]
	// We need: IV[12] + Tag[16] + Data[n] (to match @ciph/core format)
	tagSize := gcm.Overhead() // 16
	dataLen := len(sealed) - tagSize
	data := sealed[:dataLen]
	tag := sealed[dataLen:]

	// Assemble: IV + Tag + Data
	combined := make([]byte, 12+tagSize+dataLen)
	copy(combined[0:12], iv)
	copy(combined[12:12+tagSize], tag)
	copy(combined[12+tagSize:], data)

	encoded := base64.RawURLEncoding.EncodeToString(combined)

	return &EncryptResult{
		Ciphertext: encoded,
	}, nil
}

// Decrypt decrypts base64url(IV[12] + AuthTag[16] + Ciphertext[n]) with AES-256-GCM.
// Accepts the @ciph/core format: IV[12] + AuthTag[16] + Data[n].
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

	// Format: IV[12] + AuthTag[16] + Data[n]
	if len(combined) < 12+16 {
		return nil, &CiphError{
			Code:    CIPH004,
			Message: "ciphertext too short",
		}
	}

	iv := combined[:12]
	tag := combined[12:28]
	data := combined[28:]

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

	// gcm.Open expects: data + tag (Go standard GCM format)
	sealedForOpen := make([]byte, len(data)+len(tag))
	copy(sealedForOpen, data)
	copy(sealedForOpen[len(data):], tag)

	plaintext, err := gcm.Open(nil, iv, sealedForOpen, nil)
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
