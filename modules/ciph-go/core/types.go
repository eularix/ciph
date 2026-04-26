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

// CiphServerLog matches the @ciph/core CiphServerLog interface.
// JSON field names match the TypeScript interface for interop with devtools inspector.
type CiphServerLog struct {
	ID        string              `json:"id"`
	Method    string              `json:"method"`
	Route     string              `json:"route"`
	Status    int                 `json:"status"`
	Duration  int64               `json:"duration"` // milliseconds
	Timestamp string              `json:"timestamp"`
	Request   CiphServerLogReq    `json:"request"`
	Response  CiphServerLogRes    `json:"response"`
	Fingerprint CiphServerLogFP   `json:"fingerprint"`
	Excluded  bool                `json:"excluded"`
	Error     *string             `json:"error"` // error code or null
	ECDH      *ECDHLogInfo        `json:"ecdh,omitempty"`
}

type CiphServerLogReq struct {
	PlainBody     interface{}       `json:"plainBody"`
	EncryptedBody *string           `json:"encryptedBody"`
	Headers       map[string]string `json:"headers"`
	IP            string            `json:"ip"`
	UserAgent     string            `json:"userAgent"`
}

type CiphServerLogRes struct {
	PlainBody     interface{} `json:"plainBody"`
	EncryptedBody string      `json:"encryptedBody"`
}

type CiphServerLogFP struct {
	Value   string `json:"value"`
	IPMatch bool   `json:"ipMatch"`
	UAMatch bool   `json:"uaMatch"`
}

type CiphClientLog struct {
	Method      string `json:"method"`
	URL         string `json:"url"`
	Status      int    `json:"status"`
	RequestBody string `json:"requestBody"`  // encrypted, truncated
	ResponseBody string `json:"responseBody"` // encrypted, truncated
	Fingerprint string `json:"fingerprint"`  // truncated
	Timestamp   int64  `json:"timestamp"`
	ECDH        *ECDHLogInfo `json:"ecdh,omitempty"`
}

type ECDHLogInfo struct {
	ClientPublicKey    string `json:"clientPublicKey"` // truncated for display
	SharedSecretDerived bool  `json:"sharedSecretDerived"`
}

type EncryptRequest struct {
	Plaintext []byte
	Key       string // base64url
}

type DecryptRequest struct {
	Ciphertext string // base64url
	Key        string // base64url
}
