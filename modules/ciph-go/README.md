# Ciph for Go

Transparent HTTP encryption for Go backends. ECDH P-256 asymmetric encryption with AES-256-GCM.

## Packages

### `core`

Zero-dependency crypto primitives:
- ECDH P-256 key generation
- ECDH shared secret derivation
- HKDF key derivation (session + request keys)
- AES-256-GCM encrypt/decrypt
- Fingerprint generation and validation

**Install:**
```bash
go get github.com/Eularix/ciph/modules/ciph-go/core
```

**Usage:**
```go
import "github.com/Eularix/ciph/modules/ciph-go/core"

// Generate server key pair (once at startup)
keyPair, _ := core.GenerateServerKeyPair()
serverPrivateKey := keyPair.PrivateKey
serverPublicKey := keyPair.PublicKey

// Client: Generate ephemeral key pair
clientKeyPair, _ := core.GenerateClientKeyPair()

// Derive shared secret
rawShared, _ := core.DeriveSharedSecret(clientKeyPair.PrivateKey, serverPublicKey)

// Derive session key
sessionKey, _ := core.DeriveSessionKey(rawShared)

// Encrypt fingerprint with session key
fingerprint := core.FingerprintComponents{
  UserAgent: "Mozilla/5.0...",
  Screen: "1920x1080",
  Timezone: "UTC",
  IP: "192.168.1.1",
}
encFingerprint, _ := core.EncryptFingerprintComponents(fingerprint, sessionKey)

// Derive request key
fpHash := core.GetFingerprintHash(fingerprint)
requestKey, _ := core.DeriveRequestKey(sessionKey, fpHash)

// Encrypt body
plaintext := []byte(`{"user":"alice"}`)
result, _ := core.Encrypt(plaintext, requestKey)
ciphertext := result.Ciphertext

// Decrypt body
decrypted, _ := core.Decrypt(ciphertext, requestKey)
```

### `middleware`

Framework-agnostic HTTP middleware. Works with `net/http`, Fiber, Gin, Echo, etc.

**Install:**
```bash
go get github.com/Eularix/ciph/modules/ciph-go/middleware
```

**Usage with net/http:**
```go
import (
  "net/http"
  "github.com/Eularix/ciph/modules/ciph-go/middleware"
)

func main() {
  config := &middleware.Config{
    PrivateKey: os.Getenv("CIPH_PRIVATE_KEY"),
    StrictFingerprint: true,
    MaxPayloadSize: 10 * 1024 * 1024,
  }

  ciph, _ := middleware.New(config)

  // Wrap all handlers
  mux := http.NewServeMux()
  mux.HandleFunc("/api/users", handleUsers)
  
  wrapped := ciph.Wrap(mux)
  http.ListenAndServe(":3000", wrapped)
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
  // Request body is auto-decrypted
  // Response body is auto-encrypted
  w.Header().Set("Content-Type", "application/json")
  w.Write([]byte(`{"id":1,"name":"alice"}`))
}
```

**Usage with Fiber:**
```go
import "github.com/gofiber/fiber/v2"

app := fiber.New()

// Adapt middleware to Fiber
app.Use(func(c *fiber.Ctx) error {
  r := c.Request()
  w := c.Response()
  
  ciph.Wrap(http.HandlerFunc(func(hw http.ResponseWriter, hr *http.Request) {
    c.Next()
  })).ServeHTTP(w, r)
  
  return nil
})

app.Post("/api/users", handleUsers)
app.Listen(":3000")
```

**Usage with Gin:**
```go
import "github.com/gin-gonic/gin"

router := gin.Default()

// Adapt middleware to Gin
router.Use(func(c *gin.Context) {
  r := c.Request
  w := c.Writer
  
  ciph.Wrap(http.HandlerFunc(func(hw http.ResponseWriter, hr *http.Request) {
    c.Request = hr // Update request with decrypted body
    c.Next()
  })).ServeHTTP(w, r)
})

router.POST("/api/users", handleUsers)
router.Run(":3000")
```

## Configuration

```go
type Config struct {
  PrivateKey       string   // base64url P-256 private key (required)
  ExcludeRoutes    []string // Routes to skip encryption (default: ["/health", "/ciph/public-key", "/ciph", "/ciph/*"])
  StrictFingerprint bool     // Validate IP + UA (default: true, set false behind proxy)
  MaxPayloadSize   int64     // Max request size in bytes (default: 10MB)
  AllowUnencrypted bool      // Fall back to plain (default: false, never in production)
}
```

## Key Generation

```bash
# Generate server key pair (store CIPH_PRIVATE_KEY in secret manager)
ciph-keygen generate

# Output:
# CIPH_PRIVATE_KEY=base64url...
# CIPH_PUBLIC_KEY=base64url...
```

Or via Go:
```go
keyPair, _ := core.GenerateServerKeyPair()
fmt.Println("CIPH_PRIVATE_KEY=" + keyPair.PrivateKey)
fmt.Println("CIPH_PUBLIC_KEY=" + keyPair.PublicKey)
```

## Error Codes

| Code | HTTP | Trigger |
|------|------|---------|
| CIPH001 | 401 | Missing X-Client-PublicKey or X-Fingerprint header |
| CIPH002 | 401 | Invalid/unparseable client public key |
| CIPH003 | 401 | Fingerprint IP/UA mismatch |
| CIPH004 | 400 | Body or fingerprint decrypt failed |
| CIPH005 | 413 | Payload exceeds maxPayloadSize |
| CIPH006 | 500 | Response encrypt failed |
| CIPH007 | 401 | ECDH key derivation failed |

## Interop with JS

Go backend + JS frontend (React, Vue, Svelte):

```
Client (@ciph/client or @ciph/react)
  ├─ Generate ephemeral P-256 keypair
  ├─ Send X-Client-PublicKey header
  ├─ Encrypt request body with request_key
  └─ Encrypt fingerprint with session_key
       ↓
Server (ciph-go/middleware)
  ├─ Receive client public key
  ├─ ECDH → shared_secret
  ├─ Derive session_key + request_key
  ├─ Decrypt fingerprint + validate
  ├─ Decrypt body
  └─ Encrypt response
       ↓
Client
  └─ Decrypt response body
```

Both sides must:
- Use P-256 ECDH
- Use HKDF-SHA256 with same info strings ("ciph-v2-session", "ciph-v2-request")
- Use AES-256-GCM for encryption
- Validate fingerprint (IP + UA)

## TODOs

- [ ] Fiber adapter package
- [ ] Gin adapter package
- [ ] Echo adapter package
- [ ] DevTools logging (SSE endpoint)
- [ ] Key rotation support
- [ ] X25519 migration path
