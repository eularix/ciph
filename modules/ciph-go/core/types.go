package core

import "fmt"

type ErrorCode string

const (
	CIPH001 ErrorCode = "CIPH001" // Missing X-Client-PublicKey or X-Fingerprint header
	CIPH002 ErrorCode = "CIPH002" // Invalid/unparseable client public key
	CIPH003 ErrorCode = "CIPH003" // Fingerprint IP/UA mismatch
	CIPH004 ErrorCode = "CIPH004" // Body or fingerprint decrypt failed
	CIPH005 ErrorCode = "CIPH005" // Payload exceeds maxPayloadSize
	CIPH006 ErrorCode = "CIPH006" // Response encrypt failed
	CIPH007 ErrorCode = "CIPH007" // ECDH key derivation failed
)

type CiphError struct {
	Code    ErrorCode
	Message string
	Err     error
}

func (e *CiphError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (%v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

type KeyPair struct {
	PrivateKey string // base64url-encoded
	PublicKey  string // base64url-encoded
}

type EncryptResult struct {
	Ciphertext string // base64url(IV[12] + AuthTag[16] + EncryptedData[n])
}

type DecryptResult struct {
	Plaintext []byte
}

type FingerprintComponents struct {
	UserAgent string            `json:"userAgent"`
	Screen    string            `json:"screen"`
	Timezone  string            `json:"timezone"`
	IP        string            `json:"ip"`
	Custom    map[string]string `json:"custom,omitempty"`
}

type FingerprintResult struct {
	Hash       string // SHA-256 hex
	Components FingerprintComponents
}

type CiphClientLog struct {
	Method      string
	URL         string
	Status      int
	RequestBody string  // encrypted, truncated
	ResponseBody string // encrypted, truncated
	Fingerprint string  // truncated
	Timestamp   int64
	ECDH        *ECDHLogInfo
}

type CiphServerLog struct {
	Method      string
	URL         string
	Status      int
	RequestBody string  // encrypted, truncated
	ResponseBody string // encrypted, truncated
	Fingerprint string  // truncated
	Timestamp   int64
	ECDH        *ECDHLogInfo
}

type ECDHLogInfo struct {
	ClientPublicKey string // truncated for display
	SharedSecretDerived bool
}

type EncryptRequest struct {
	Plaintext []byte
	Key       string // base64url
}

type DecryptRequest struct {
	Ciphertext string // base64url
	Key        string // base64url
}
