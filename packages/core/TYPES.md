# TypeScript Types — @ciph/core

All public types exported from `@ciph/core`.

---

## Configuration

```typescript
/**
 * Core configuration passed to all Ciph operations.
 */
export interface CiphCoreConfig {
  /** 
   * Shared secret key. Must be identical on frontend and backend.
   * Minimum 32 characters. Stored in .env — never hardcoded.
   */
  secret: string

  /**
   * Controls which components are included in fingerprint generation.
   */
  fingerprintOptions?: FingerprintOptions
}

export interface FingerprintOptions {
  /** Include screen resolution. Default: true */
  includeScreen?: boolean

  /** Include timezone. Default: true */
  includeTimezone?: boolean

  /** Additional custom fields to include in fingerprint */
  customFields?: Record<string, string>
}
```

---

## Fingerprint

```typescript
/**
 * Raw components used to generate a device fingerprint.
 */
export interface FingerprintComponents {
  /** Client IP address. Backend-provided only. */
  ip?: string

  /** User-Agent string */
  userAgent?: string

  /** Screen resolution, e.g. "1920x1080" */
  screen?: string

  /** IANA timezone, e.g. "Asia/Jakarta" */
  timezone?: string

  /** Any additional custom fields */
  [key: string]: string | undefined
}

/**
 * Result of fingerprint generation.
 */
export interface FingerprintResult {
  /** SHA-256 hex digest of sorted components (64 chars) */
  fingerprint: string

  /** The components used to generate this fingerprint */
  components: FingerprintComponents
}
```

---

## Encryption / Decryption

```typescript
/**
 * Result of an encryption operation.
 */
export interface EncryptResult {
  /** Base64url-encoded string: IV + AuthTag + Ciphertext */
  ciphertext: string

  /** The IV used (base64url). Embedded in ciphertext, exposed for debugging only. */
  iv: string
}

/**
 * Result of a decryption operation.
 */
export interface DecryptResult {
  /** Decrypted plain text */
  plaintext: string
}
```

---

## Errors

```typescript
/**
 * All Ciph error codes.
 */
export type CiphErrorCode =
  | "CIPH001" // X-Fingerprint header missing
  | "CIPH002" // Fingerprint decryption failed (wrong secret)
  | "CIPH003" // Fingerprint mismatch (IP or UA changed)
  | "CIPH004" // Request body decryption failed
  | "CIPH005" // Payload too large
  | "CIPH006" // Response encryption failed

/**
 * Structured error thrown by all @ciph/* packages.
 */
export class CiphError extends Error {
  constructor(
    public readonly code: CiphErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = "CiphError"
  }
}

/**
 * Error response shape sent over HTTP.
 */
export interface CiphErrorResponse {
  code: CiphErrorCode
  message: string
}
```

---

## DevTools Event (Internal)

> Used internally by `@ciph/client` and `@ciph/hono` to emit logs to devtools packages. Not part of public API but documented for devtools implementors.

```typescript
/**
 * Log entry emitted by @ciph/client after each request completes.
 */
export interface CiphClientLog {
  id: string               // nanoid, unique per request
  method: string           // GET | POST | PUT | PATCH | DELETE
  url: string              // full URL
  status: number           // HTTP status code
  duration: number         // ms from send to decrypted response
  timestamp: string        // ISO 8601

  request: {
    plainBody: unknown | null      // null for GET
    encryptedBody: string | null   // null for GET
    headers: Record<string, string>
  }

  response: {
    plainBody: unknown
    encryptedBody: string
    headers: Record<string, string>
  }

  fingerprint: {
    value: string          // fingerprint hex
    cached: boolean        // was fingerprint taken from cache?
    mismatchRetried: boolean
  }

  excluded: boolean        // true if route matched excludeRoutes
}

/**
 * Log entry emitted by @ciph/hono after each request completes.
 */
export interface CiphServerLog {
  id: string
  method: string
  route: string            // matched Hono route pattern
  status: number
  duration: number
  timestamp: string

  request: {
    plainBody: unknown | null
    encryptedBody: string | null
    headers: Record<string, string>
    ip: string
    userAgent: string
  }

  response: {
    plainBody: unknown
    encryptedBody: string
  }

  fingerprint: {
    value: string
    ipMatch: boolean
    uaMatch: boolean
  }

  excluded: boolean
  error: CiphErrorCode | null
}
```

---

## Public API Surface

```typescript
// Encryption
export function encrypt(plaintext: string, key: string): Promise<EncryptResult>
export function decrypt(ciphertext: string, key: string): Promise<DecryptResult>

// Key derivation
export function deriveKey(secret: string, fingerprint: string): Promise<string>

// Fingerprint
export function generateFingerprint(components: FingerprintComponents, options?: FingerprintOptions): Promise<FingerprintResult>
export function encryptFingerprint(fingerprint: string, secret: string): Promise<string>
export function decryptFingerprint(encrypted: string, secret: string): Promise<string>
export function validateFingerprint(
  stored: FingerprintComponents,
  incoming: FingerprintComponents
): boolean

// Utilities
export function randomBytes(length: number): Uint8Array
export function toBase64url(bytes: Uint8Array): string
export function fromBase64url(str: string): Uint8Array
```
