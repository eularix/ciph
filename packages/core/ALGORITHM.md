# Algorithm Specification — @ciph/core

## Encryption Algorithm

**AES-256-GCM** (Advanced Encryption Standard, 256-bit key, Galois/Counter Mode)

| Property        | Value                        |
|-----------------|------------------------------|
| Algorithm       | AES-GCM                      |
| Key length      | 256 bits (32 bytes)          |
| IV length       | 12 bytes (96 bits)           |
| Auth tag length | 16 bytes (128 bits)          |
| Encoding        | Base64 (URL-safe)            |

### Why AES-256-GCM?

- **Authenticated encryption** — detects tampering via auth tag
- **Hardware-accelerated** on all modern CPUs (AES-NI instruction set)
- **Streaming-compatible** — suitable for large payloads
- **NIST approved**, widely audited

---

## Ciphertext Format

All encrypted output is a single Base64 string encoding:

```
[ IV (12 bytes) ][ Auth Tag (16 bytes) ][ Encrypted Data (n bytes) ]
      ^                  ^                        ^
  prepended          appended by              actual ciphertext
  before encrypt     GCM mode
```

**Encoded as:** `base64url(IV + AuthTag + Ciphertext)`

This format ensures the IV and tag always travel with the ciphertext — no separate fields needed.

---

## Key Derivation

The encryption key is derived from the **fingerprint string**, not used raw:

```
SECRETKEY (from .env)   +   fingerprint (device-bound string)
         \                        /
          \                      /
           HKDF-SHA256 (32 bytes)
                  |
            AES-256-GCM Key
```

- **HKDF** (HMAC-based Key Derivation Function) per RFC 5869
- Salt: `SECRETKEY`
- Info: `"ciph-v1"`
- Length: 32 bytes

This means the same payload encrypted on two different devices produces **different ciphertext** — replay attacks from a different device are cryptographically invalid.

---

## Fingerprint

### Components

| Component       | Source                                     | Included by Default |
|-----------------|--------------------------------------------|---------------------|
| `ip`            | Provided by backend, injected by middleware | Backend only        |
| `userAgent`     | `navigator.userAgent` / `req.headers['user-agent']` | Yes        |
| `screen`        | `screen.width + "x" + screen.height`       | Yes (configurable)  |
| `timezone`      | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Yes (configurable) |
| `customFields`  | User-defined key-value pairs               | Optional            |

### Fingerprint Generation

```
components = { userAgent, screen, timezone, ...customFields }
raw        = JSON.stringify(components, sorted keys)
fingerprint = SHA-256(raw) → hex string (64 chars)
```

Sorted keys ensure deterministic output regardless of object property order.

### Fingerprint Encryption (for X-Fingerprint header)

```
X-Fingerprint = base64url( AES-256-GCM-Encrypt(fingerprint, SECRETKEY) )
```

The fingerprint itself is encrypted using the raw SECRETKEY (not derived key) so the backend can decrypt it independently before deriving the per-request key.

---

## Full Request Encryption Flow

```
1. Generate fingerprint F from device components
2. Encrypt F with SECRETKEY → X-Fingerprint header value
3. Derive key K = HKDF(SECRETKEY, F)
4. Generate random IV (12 bytes)
5. ciphertext = AES-256-GCM-Encrypt(plainBody, K, IV)
6. output = base64url(IV + AuthTag + ciphertext)
7. Send request with:
   - Header: X-Fingerprint: <encrypted fingerprint>
   - Body:   <output>
```

## Full Response Decryption Flow (Backend → Frontend)

```
1. Backend receives X-Fingerprint header
2. Decrypt X-Fingerprint with SECRETKEY → fingerprint F
3. Validate F against current request IP + UA
4. Derive key K = HKDF(SECRETKEY, F)
5. Decrypt request body with K
6. Process request normally
7. Encrypt response body with same K
8. Send encrypted response
```

---

## Performance Characteristics

| Payload Size | Engine         | Typical Latency |
|--------------|----------------|-----------------|
| < 100 KB     | Web Crypto API | < 0.1 ms        |
| 100–500 KB   | Web Crypto API | 0.1–0.5 ms      |
| > 500 KB     | @ciph/core-native (Rust) | < 0.1 ms |

> Note: `@ciph/core-native` is a separate optional package. `@ciph/core` automatically falls back to Node.js crypto if native is unavailable.
