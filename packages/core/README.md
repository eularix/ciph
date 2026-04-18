# @ciph/core

Zero-dependency cryptographic primitives for transparent HTTP encryption. Core building block for all Ciph packages.

## Features

- **AES-256-GCM encryption** — Industry-standard authenticated encryption
- **ECDH key exchange** — Elliptic curve Diffie-Hellman for asymmetric key negotiation
- **HKDF key derivation** — HMAC-based key derivation function (SHA-256)
- **Device fingerprinting** — Per-device salt for encryption variation
- **Web Crypto API** — Browser/Deno/Bun support
- **Node.js crypto** — Native Node.js support
- **Zero dependencies** — No external packages

## Install

```bash
npm install @ciph/core
# or
pnpm add @ciph/core
```

## Quick Start

```typescript
import {
  encrypt,
  decrypt,
  deriveKey,
  generateFingerprint,
} from '@ciph/core'

// 1. Generate device fingerprint
const fingerprint = await generateFingerprint({
  userAgent: navigator.userAgent,
  screen: { width: window.innerWidth, height: window.innerHeight },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

// 2. Derive encryption key
const key = await deriveKey(
  'your-shared-secret-min-32-chars',
  fingerprint.hash
)

// 3. Encrypt data
const data = JSON.stringify({ message: 'hello' })
const encrypted = await encrypt(data, key)
// → EncryptResult { ciphertext: 'base64url(...)', iv: '...', tag: '...' }

// 4. Decrypt data
const decrypted = await decrypt(encrypted.ciphertext, key)
// → 'your plaintext'
```

## API Reference

### `encrypt(plaintext: string, key: string): Promise<EncryptResult>`

Encrypts plaintext with AES-256-GCM.

**Params:**
- `plaintext` — Text to encrypt
- `key` — Base64url-encoded 32-byte key from `deriveKey()`

**Returns:**
```typescript
{
  ciphertext: string      // base64url(IV + AuthTag + Ciphertext)
  iv: string              // 12-byte initialization vector (base64url)
  tag: string             // 16-byte authentication tag (base64url)
}
```

**Throws:** `CiphError` if encryption fails

---

### `decrypt(ciphertext: string, key: string): Promise<string>`

Decrypts ciphertext with AES-256-GCM.

**Params:**
- `ciphertext` — Base64url-encoded output from `encrypt()`
- `key` — Same key used for encryption

**Returns:** Decrypted plaintext

**Throws:** `CiphError` if decryption fails (wrong key, corrupted data, etc.)

---

### `deriveKey(secret: string, fingerprint: string): Promise<string>`

Derives 32-byte AES key using HKDF-SHA256.

**Params:**
- `secret` — Shared secret (min 32 characters)
- `fingerprint` — Device fingerprint hash from `generateFingerprint()`

**Returns:** Base64url-encoded 32-byte key

**Algorithm:**
```
HKDF-SHA256(
  secret = <your secret>,
  ikm = <fingerprint hash>,
  info = "ciph-v1",
  length = 32 bytes
)
```

---

### `generateFingerprint(components: FingerprintComponents, options?: FingerprintOptions): Promise<FingerprintResult>`

Creates per-device fingerprint.

**Params:**
```typescript
{
  userAgent?: string              // navigator.userAgent
  screen?: { width, height }      // window.innerWidth/Height
  timezone?: string               // Intl.DateTimeFormat().resolvedOptions().timeZone
  language?: string               // navigator.language
  plugins?: string[]              // navigator.plugins
  hardwareConcurrency?: number    // navigator.hardwareConcurrency
  deviceMemory?: number           // navigator.deviceMemory
  customFields?: Record<string, string>  // Any custom data
}
```

**Options:**
```typescript
{
  includeScreen?: boolean         // default: true
  includeTimezone?: boolean       // default: true
  includeLanguage?: boolean       // default: false
  includePlugins?: boolean        // default: false
}
```

**Returns:**
```typescript
{
  hash: string          // SHA-256 of sorted JSON fingerprint
  components: object    // Original components used
  timestamp: number     // When fingerprint was generated
}
```

---

### `encryptFingerprint(fingerprint: string, secret: string): Promise<string>`

Encrypts fingerprint hash with shared secret (for X-Fingerprint header).

**Params:**
- `fingerprint` — Hash from `generateFingerprint()`
- `secret` — Shared secret

**Returns:** Base64url-encoded encrypted fingerprint

---

### `decryptFingerprint(encrypted: string, secret: string): Promise<string>`

Decrypts fingerprint from X-Fingerprint header.

**Throws:** `CiphError` if decryption fails (wrong secret)

---

### `validateFingerprint(stored: string, incoming: string): boolean`

Compares two fingerprints for equality.

**Returns:** `true` if identical, `false` otherwise

---

### `randomBytes(length: number): Uint8Array`

Generates cryptographically random bytes.

**Params:**
- `length` — Number of random bytes to generate

**Returns:** Uint8Array of random bytes

---

### `toBase64url(bytes: Uint8Array): string`

Converts bytes to base64url string.

---

### `fromBase64url(str: string): Uint8Array`

Converts base64url string to bytes.

---

## Error Handling

```typescript
import { CiphError, CiphErrorCode } from '@ciph/core'

try {
  const decrypted = await decrypt(ciphertext, key)
} catch (err) {
  if (err instanceof CiphError) {
    console.error(`Ciph error: ${err.code} — ${err.message}`)
    // Code examples: "CIPH_INVALID_KEY", "CIPH_DECRYPT_FAILED"
  }
}
```

## Algorithms

- **Encryption:** AES-256-GCM (NIST approved)
- **Key Derivation:** HKDF-SHA256 (RFC 5869)
- **Fingerprint Hash:** SHA-256
- **Key Exchange:** ECDH P-256 (for v2)

## Browser Support

- Chrome 37+
- Firefox 34+
- Safari 11+
- Edge 79+
- Deno 1.0+
- Bun 0.1+
- Node.js 15+ (via `node:crypto`)

Uses Web Crypto API when available, falls back to Node.js `crypto` module.

## Runtime Detection

```typescript
// Automatically detects environment
// No config needed — works in browser, Node.js, Deno, Bun
```

## Performance

- **encrypt()** — ~1-2ms per 1KB
- **decrypt()** — ~1-2ms per 1KB
- **deriveKey()** — ~0.5ms (hardware-dependent)
- **generateFingerprint()** — ~0.1ms

(Benchmarks on M1 Mac with 1KB payload)

## Security Considerations

- **Minimum secret length:** 32 characters
- **Key reuse:** Each fingerprint = unique key (per device)
- **No key storage:** Keys derived per-request (stateless)
- **Nonce format:** 12-byte random IV per encryption
- **Auth tag:** 16-byte Galois/Counter Mode tag (authenticated)

## Examples

### Encrypt & decrypt JSON

```typescript
const payload = { userId: 123, action: 'update' }
const plaintext = JSON.stringify(payload)

const encrypted = await encrypt(plaintext, key)
const decrypted = await decrypt(encrypted.ciphertext, key)
const restored = JSON.parse(decrypted)
```

### Fingerprint + key derivation

```typescript
const fp = await generateFingerprint({
  userAgent: navigator.userAgent,
  screen: { width: 1920, height: 1080 },
})

const key = await deriveKey('my-secret-xyz...', fp.hash)
// Same device, same fp.hash → same key (stateless)
// Different device → different fp.hash → different key
```

### Device-specific encryption

```typescript
// Device A
const fpA = await generateFingerprint(...)
const keyA = await deriveKey(secret, fpA.hash)
const cipherA = await encrypt('data', keyA)

// Device B — can't decrypt Device A's data without Device A's fingerprint
const fpB = await generateFingerprint(...)
const keyB = await deriveKey(secret, fpB.hash)
// cipherA ≠ decrypt(cipherA, keyB) — different fingerprint = different key
```

## TypeScript

All exports are fully typed.

```typescript
import type {
  CiphError,
  CiphErrorCode,
  EncryptResult,
  DecryptResult,
  FingerprintResult,
  FingerprintComponents,
  FingerprintOptions,
} from '@ciph/core'
```

## License

MIT
